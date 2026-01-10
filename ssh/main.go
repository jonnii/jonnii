package main

import (
	"context"
	"errors"
	"fmt"
	"net"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/charmbracelet/lipgloss"
	"github.com/charmbracelet/ssh"
	"github.com/charmbracelet/wish"
	"github.com/charmbracelet/wish/logging"
)

const (
	defaultHost = "0.0.0.0"
	defaultPort = "22"
)

func main() {
	host := defaultHost
	port := os.Getenv("PORT")
	if port == "" {
		port = defaultPort
	}

	s, err := wish.NewServer(
		wish.WithAddress(net.JoinHostPort(host, port)),
		wish.WithHostKeyPath(".ssh/id_ed25519"),
		wish.WithMiddleware(
			easterEggMiddleware(),
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

func easterEggMiddleware() wish.Middleware {
	return func(next ssh.Handler) ssh.Handler {
		return func(sess ssh.Session) {
			renderer := lipgloss.NewRenderer(sess)

			// Styles
			titleStyle := renderer.NewStyle().
				Bold(true).
				Foreground(lipgloss.Color("#FF6B6B")).
				MarginBottom(1)

			subtitleStyle := renderer.NewStyle().
				Foreground(lipgloss.Color("#4ECDC4")).
				Italic(true)

			borderStyle := renderer.NewStyle().
				Foreground(lipgloss.Color("#95E1D3"))

			linkStyle := renderer.NewStyle().
				Foreground(lipgloss.Color("#F38181")).
				Underline(true)

			textStyle := renderer.NewStyle().
				Foreground(lipgloss.Color("#FAFAFA"))

			dimStyle := renderer.NewStyle().
				Foreground(lipgloss.Color("#666666"))

			// ASCII Art
			art := `
    ██╗ ██████╗ ███╗   ██╗███╗   ██╗██╗██╗
    ██║██╔═══██╗████╗  ██║████╗  ██║██║██║
    ██║██║   ██║██╔██╗ ██║██╔██╗ ██║██║██║
██  ██║██║   ██║██║╚██╗██║██║╚██╗██║██║██║
╚█████╔╝╚██████╔╝██║ ╚████║██║ ╚████║██║██║
 ╚════╝  ╚═════╝ ╚═╝  ╚═══╝╚═╝  ╚═══╝╚═╝╚═╝
`
			// Print with typing effect
			typewrite(sess, borderStyle.Render(art), 2*time.Millisecond)

			fmt.Fprintln(sess)

			title := titleStyle.Render("Welcome, curious traveler!")
			typewrite(sess, title, 20*time.Millisecond)
			fmt.Fprintln(sess)
			fmt.Fprintln(sess)

			subtitle := subtitleStyle.Render("You found the secret SSH entrance...")
			typewrite(sess, subtitle, 15*time.Millisecond)
			fmt.Fprintln(sess)
			fmt.Fprintln(sess)

			// Info
			lines := []string{
				textStyle.Render("I'm Jon, a software engineer who loves building things."),
				"",
				textStyle.Render("Find me at:"),
				"  " + linkStyle.Render("https://jonnii.com"),
				"  " + linkStyle.Render("https://github.com/jonnii"),
				"",
				dimStyle.Render("Thanks for SSH-ing in! Press Ctrl+C to exit."),
			}

			for _, line := range lines {
				typewrite(sess, line, 10*time.Millisecond)
				fmt.Fprintln(sess)
				time.Sleep(50 * time.Millisecond)
			}

			fmt.Fprintln(sess)

			// Keep connection open until user disconnects
			<-sess.Context().Done()
		}
	}
}

func typewrite(sess ssh.Session, text string, delay time.Duration) {
	for _, char := range text {
		fmt.Fprint(sess, string(char))
		time.Sleep(delay)
	}
}
