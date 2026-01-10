package main

import (
	"fmt"
	"image"
	"image/gif"
	"io"
	"math/rand"
	"strings"

	"golang.org/x/image/draw"
)

var defaultChars = []rune("108BRES")

// GifASCII converts a GIF to ASCII art frames
type GifASCII struct {
	Width      int
	Height     int
	Chars      []rune
	FrameDelay int // in milliseconds
}

// NewGifASCII creates a new GifASCII converter
func NewGifASCII(width, height int) *GifASCII {
	return &GifASCII{
		Width:      width,
		Height:     height,
		Chars:      defaultChars,
		FrameDelay: 50,
	}
}

// ExtractFrames reads a GIF and returns ASCII frames
func (g *GifASCII) ExtractFrames(r io.Reader) ([]string, error) {
	gifImg, err := gif.DecodeAll(r)
	if err != nil {
		return nil, fmt.Errorf("failed to decode gif: %w", err)
	}

	var frames []string

	// Calculate output height maintaining aspect ratio
	// Divide by 2.3 to account for terminal character aspect ratio
	if g.Height == 0 && len(gifImg.Image) > 0 {
		firstFrame := gifImg.Image[0]
		ratio := float64(firstFrame.Bounds().Dy()) / float64(firstFrame.Bounds().Dx())
		g.Height = int(float64(g.Width) * ratio / 2.3)
	}

	for _, frame := range gifImg.Image {
		asciiFrame := g.frameToASCII(frame)
		frames = append(frames, asciiFrame)
	}

	return frames, nil
}

// frameToASCII converts a single image frame to ASCII
func (g *GifASCII) frameToASCII(img *image.Paletted) string {
	// Resize the image
	resized := image.NewRGBA(image.Rect(0, 0, g.Width, g.Height))
	draw.BiLinear.Scale(resized, resized.Bounds(), img, img.Bounds(), draw.Over, nil)

	var buf strings.Builder

	for y := 0; y < g.Height; y++ {
		for x := 0; x < g.Width; x++ {
			r, gr, b, _ := resized.At(x, y).RGBA()
			// Convert from 16-bit to 8-bit color
			r8, g8, b8 := r>>8, gr>>8, b>>8

			// ANSI true color escape sequence
			buf.WriteString(fmt.Sprintf("\x1b[38;2;%d;%d;%dm", r8, g8, b8))
			buf.WriteRune(g.Chars[rand.Intn(len(g.Chars))])
		}
		buf.WriteString("\x1b[0m\n")
	}

	return buf.String()
}

// ClearScreen returns ANSI escape sequence to move cursor to top
func ClearScreen() string {
	return "\x1b[H\x1b[2J"
}

// MoveCursorHome returns ANSI escape sequence to move cursor to top-left
func MoveCursorHome() string {
	return "\x1b[H"
}
