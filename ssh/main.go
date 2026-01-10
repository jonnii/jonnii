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
	"syscall"
	"time"

	"github.com/charmbracelet/ssh"
	"github.com/charmbracelet/wish"
	"github.com/charmbracelet/wish/logging"
)

//go:embed rr.gif
var rickRollGif []byte

const (
	defaultHost = "0.0.0.0"
	defaultPort = "22"
)

func main() {
	// If --demo flag, just play animation locally
	if len(os.Args) > 1 && os.Args[1] == "--demo" {
		playDemo()
		return
	}

	host := defaultHost
	port := os.Getenv("PORT")
	if port == "" {
		port = defaultPort
	}

	s, err := wish.NewServer(
		wish.WithAddress(net.JoinHostPort(host, port)),
		wish.WithHostKeyPath(".ssh/id_ed25519"),
		wish.WithMiddleware(
			rickRollMiddleware(),
			logging.Middleware(),
		),
	)
	if err != nil {
		fmt.Printf("Could not create server: %v\n", err)
		os.Exit(1)
	}

	done := make(chan os.Signal, 1)
	signal.Notify(done, os.Interrupt, syscall.SIGINT, syscall.SIGTERM)

	fmt.Printf("Starting SSH server on %s:%s\n", host, port)
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

func rickRollMiddleware() wish.Middleware {
	// Pre-extract frames at startup
	converter := NewGifASCII(80, 0)
	frames, err := converter.ExtractFrames(bytes.NewReader(rickRollGif))
	if err != nil {
		fmt.Printf("Warning: could not extract gif frames: %v\n", err)
		frames = []string{"[Could not load animation]"}
	}

	return func(next ssh.Handler) ssh.Handler {
		return func(sess ssh.Session) {
			// Clear screen and hide cursor
			fmt.Fprint(sess, "\x1b[?25l") // Hide cursor
			fmt.Fprint(sess, ClearScreen())

			// Channel to signal stop
			stopChan := make(chan struct{})

			// Read input in background to detect Ctrl+C
			go func() {
				buf := make([]byte, 1)
				for {
					n, err := sess.Read(buf)
					if err != nil || (n > 0 && buf[0] == 0x03) {
						close(stopChan)
						return
					}
				}
			}()

			// Play animation loop
		animationLoop:
			for {
				for _, frame := range frames {
					select {
					case <-stopChan:
						break animationLoop
					case <-sess.Context().Done():
						break animationLoop
					default:
						fmt.Fprint(sess, MoveCursorHome())
						fmt.Fprint(sess, frame)
						time.Sleep(time.Duration(converter.FrameDelay) * time.Millisecond)
					}
				}
			}

			// Show cursor and clear screen before exit
			fmt.Fprint(sess, "\x1b[?25h") // Show cursor
			fmt.Fprint(sess, ClearScreen())
			fmt.Fprintln(sess, "Never gonna give you up! Goodbye!")
		}
	}
}

func playDemo() {
	converter := NewGifASCII(80, 0)
	frames, err := converter.ExtractFrames(bytes.NewReader(rickRollGif))
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
	for {
		for _, frame := range frames {
			select {
			case <-sigChan:
				return
			default:
				fmt.Print(MoveCursorHome())
				fmt.Print(frame)
				time.Sleep(time.Duration(converter.FrameDelay) * time.Millisecond)
			}
		}
	}
}
