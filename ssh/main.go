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
	"syscall"
	"time"

	"github.com/charmbracelet/ssh"
	"github.com/charmbracelet/wish"
	"github.com/charmbracelet/wish/logging"
)

//go:embed rr.gif
var rickRollGif []byte

const (
	defaultHost       = "0.0.0.0"
	defaultPort       = "22"
	defaultWidth      = 80
	defaultFrameDelay = 50
)

// Config holds server configuration
type Config struct {
	Host       string
	Port       string
	Width      int
	FrameDelay int
}

func loadConfig() Config {
	cfg := Config{
		Host:       defaultHost,
		Port:       defaultPort,
		Width:      defaultWidth,
		FrameDelay: defaultFrameDelay,
	}

	if port := os.Getenv("PORT"); port != "" {
		cfg.Port = port
	}
	if width := os.Getenv("ASCII_WIDTH"); width != "" {
		if w, err := strconv.Atoi(width); err == nil && w > 0 {
			cfg.Width = w
		}
	}
	if delay := os.Getenv("FRAME_DELAY"); delay != "" {
		if d, err := strconv.Atoi(delay); err == nil && d > 0 {
			cfg.FrameDelay = d
		}
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
	fmt.Printf("Loaded %d animation frames\n", len(frames))

	s, err := wish.NewServer(
		wish.WithAddress(net.JoinHostPort(cfg.Host, cfg.Port)),
		wish.WithHostKeyPath(".ssh/id_ed25519"),
		wish.WithIdleTimeout(5*time.Minute),
		wish.WithMaxTimeout(10*time.Minute),
		wish.WithMiddleware(
			rickRollMiddleware(frames, cfg.FrameDelay),
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

func extractFrames(cfg Config) ([]string, error) {
	converter := NewGifASCII(cfg.Width, 0)
	converter.FrameDelay = cfg.FrameDelay
	return converter.ExtractFrames(bytes.NewReader(rickRollGif))
}

func rickRollMiddleware(frames []string, frameDelay int) wish.Middleware {
	return func(next ssh.Handler) ssh.Handler {
		return func(sess ssh.Session) {
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
							select {
							case <-stopChan:
							default:
								close(stopChan)
							}
							return
						}
						if n > 0 && buf[0] == 0x03 {
							select {
							case <-stopChan:
							default:
								close(stopChan)
							}
							return
						}
					}
				}
			}()

			// Play animation loop
			ticker := time.NewTicker(time.Duration(frameDelay) * time.Millisecond)
			defer ticker.Stop()

			frameIdx := 0
		animationLoop:
			for {
				select {
				case <-stopChan:
					break animationLoop
				case <-sess.Context().Done():
					break animationLoop
				case <-ticker.C:
					if _, err := fmt.Fprint(sess, MoveCursorHome()); err != nil {
						break animationLoop
					}
					if _, err := fmt.Fprint(sess, frames[frameIdx]); err != nil {
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

	// Play animation loop
	ticker := time.NewTicker(time.Duration(cfg.FrameDelay) * time.Millisecond)
	defer ticker.Stop()

	frameIdx := 0
	for {
		select {
		case <-sigChan:
			return
		case <-ticker.C:
			fmt.Print(MoveCursorHome())
			fmt.Print(frames[frameIdx])
			frameIdx = (frameIdx + 1) % len(frames)
		}
	}
}
