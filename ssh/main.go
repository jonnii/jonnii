package main

import (
	"bytes"
	"context"
	_ "embed"
	"errors"
	"fmt"
	"net"
	"os"
	"os/signal"
	"strconv"
	"sync"
	"syscall"
	"time"

	"github.com/charmbracelet/ssh"
	"github.com/charmbracelet/wish"
	"github.com/charmbracelet/wish/logging"
)

//go:embed rr.gif
var rickRollGif []byte

const (
	defaultHost        = "0.0.0.0"
	defaultPort        = "22"
	defaultWidth       = 80
	defaultHostKeyPath = ".ssh/id_ed25519"
	maxWidth           = 200
	minWidth           = 20
)

// Config holds server configuration
type Config struct {
	Host        string
	Port        string
	Width       int
	AspectRatio float64
	HostKeyPath string
}

func loadConfig() Config {
	cfg := Config{
		Host:        defaultHost,
		Port:        defaultPort,
		Width:       defaultWidth,
		AspectRatio: defaultAspectRatio,
		HostKeyPath: defaultHostKeyPath,
	}

	if port := os.Getenv("PORT"); port != "" {
		cfg.Port = port
	}
	if width := os.Getenv("ASCII_WIDTH"); width != "" {
		if w, err := strconv.Atoi(width); err == nil {
			switch {
			case w < minWidth:
				cfg.Width = minWidth
			case w > maxWidth:
				cfg.Width = maxWidth
			default:
				cfg.Width = w
			}
		}
	}
	if ratio := os.Getenv("ASPECT_RATIO"); ratio != "" {
		if r, err := strconv.ParseFloat(ratio, 64); err == nil && r > 0 {
			cfg.AspectRatio = r
		}
	}
	if keyPath := os.Getenv("HOST_KEY_PATH"); keyPath != "" {
		cfg.HostKeyPath = keyPath
	}

	return cfg
}

func main() {
	cfg := loadConfig()

	// If --demo flag, just play animation locally
	if len(os.Args) > 1 && os.Args[1] == "--demo" {
		playDemo(cfg)
		return
	}

	// Pre-extract frames at startup
	frames, err := extractFrames(cfg)
	if err != nil {
		fmt.Printf("Error extracting frames: %v\n", err)
		os.Exit(1)
	}
	if len(frames) == 0 {
		fmt.Println("Error: no frames extracted from GIF")
		os.Exit(1)
	}
	fmt.Printf("Loaded %d animation frames\n", len(frames))

	s, err := wish.NewServer(
		wish.WithAddress(net.JoinHostPort(cfg.Host, cfg.Port)),
		wish.WithHostKeyPath(cfg.HostKeyPath),
		wish.WithIdleTimeout(5*time.Minute),
		wish.WithMaxTimeout(10*time.Minute),
		wish.WithMiddleware(
			rickRollMiddleware(frames),
			logging.Middleware(),
		),
	)
	if err != nil {
		fmt.Printf("Could not create server: %v\n", err)
		os.Exit(1)
	}

	done := make(chan os.Signal, 1)
	signal.Notify(done, os.Interrupt, syscall.SIGINT, syscall.SIGTERM)

	fmt.Printf("Starting SSH server on %s:%s\n", cfg.Host, cfg.Port)
	go func() {
		if err = s.ListenAndServe(); err != nil && !errors.Is(err, ssh.ErrServerClosed) {
			fmt.Printf("Could not start server: %v\n", err)
			done <- nil
		}
	}()

	<-done

	fmt.Println("Stopping SSH server...")
	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()
	if err := s.Shutdown(ctx); err != nil && !errors.Is(err, ssh.ErrServerClosed) {
		fmt.Printf("Could not stop server: %v\n", err)
	}
}

func extractFrames(cfg Config) ([]Frame, error) {
	converter := NewGifASCII(cfg.Width, 0)
	converter.AspectRatio = cfg.AspectRatio
	return converter.ExtractFrames(bytes.NewReader(rickRollGif))
}

func rickRollMiddleware(frames []Frame) wish.Middleware {
	return func(next ssh.Handler) ssh.Handler {
		return func(sess ssh.Session) {
			// Validate frames
			if len(frames) == 0 {
				fmt.Fprintln(sess, "Error: no animation frames available")
				return
			}

			// Clear screen and hide cursor
			if _, err := fmt.Fprint(sess, "\x1b[?25l"); err != nil {
				return // Client disconnected
			}
			if _, err := fmt.Fprint(sess, ClearScreen()); err != nil {
				return
			}

			// Create cancellable context for cleanup
			ctx, cancel := context.WithCancel(sess.Context())
			defer cancel()

			// Channel to signal stop from Ctrl+C
			stopChan := make(chan struct{})
			var closeOnce sync.Once
			signalStop := func() {
				closeOnce.Do(func() {
					close(stopChan)
				})
			}

			// Read input in background to detect Ctrl+C
			go func() {
				buf := make([]byte, 1)
				for {
					select {
					case <-ctx.Done():
						return
					default:
						// Set read deadline to avoid blocking forever
						if deadline, ok := sess.(interface{ SetReadDeadline(time.Time) error }); ok {
							deadline.SetReadDeadline(time.Now().Add(100 * time.Millisecond))
						}

						n, err := sess.Read(buf)
						if err != nil {
							// Check if it's a timeout (expected) vs real error
							if netErr, ok := err.(net.Error); ok && netErr.Timeout() {
								continue
							}
							// Real error or EOF - signal stop
							signalStop()
							return
						}
						if n > 0 && buf[0] == 0x03 {
							signalStop()
							return
						}
					}
				}
			}()

			// Play animation loop with per-frame timing
			frameIdx := 0
		animationLoop:
			for {
				frame := frames[frameIdx]

				select {
				case <-stopChan:
					break animationLoop
				case <-sess.Context().Done():
					break animationLoop
				case <-time.After(time.Duration(frame.DelayMs) * time.Millisecond):
					if _, err := fmt.Fprint(sess, MoveCursorHome()); err != nil {
						break animationLoop
					}
					if _, err := fmt.Fprint(sess, frame.Content); err != nil {
						break animationLoop
					}
					frameIdx = (frameIdx + 1) % len(frames)
				}
			}

			// Show cursor and clear screen before exit
			fmt.Fprint(sess, "\x1b[?25h") // Show cursor
			fmt.Fprint(sess, ClearScreen())
			fmt.Fprintln(sess, "Never gonna give you up! Goodbye!")
		}
	}
}

func playDemo(cfg Config) {
	frames, err := extractFrames(cfg)
	if err != nil {
		fmt.Printf("Error: could not extract gif frames: %v\n", err)
		os.Exit(1)
	}
	if len(frames) == 0 {
		fmt.Println("Error: no frames extracted from GIF")
		os.Exit(1)
	}

	// Handle Ctrl+C
	sigChan := make(chan os.Signal, 1)
	signal.Notify(sigChan, os.Interrupt, syscall.SIGINT, syscall.SIGTERM)

	// Hide cursor and clear screen
	fmt.Print("\x1b[?25l")
	fmt.Print(ClearScreen())

	// Restore cursor on exit
	defer func() {
		fmt.Print("\x1b[?25h")
		fmt.Print(ClearScreen())
		fmt.Println("Never gonna give you up! Goodbye!")
	}()

	// Play animation loop with per-frame timing
	frameIdx := 0
	for {
		frame := frames[frameIdx]

		select {
		case <-sigChan:
			return
		case <-time.After(time.Duration(frame.DelayMs) * time.Millisecond):
			fmt.Print(MoveCursorHome())
			fmt.Print(frame.Content)
			frameIdx = (frameIdx + 1) % len(frames)
		}
	}
}
