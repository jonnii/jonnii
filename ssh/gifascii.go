package main

import (
	"fmt"
	"hash/fnv"
	"image"
	"image/gif"
	"io"
	"math/rand"
	"strconv"
	"strings"

	"golang.org/x/image/draw"
)

var defaultChars = []rune("108BRES")

const (
	defaultAspectRatio = 2.3 // Terminal character height/width ratio
)

// Frame represents a single ASCII frame with its display duration
type Frame struct {
	Content  string
	DelayMs  int // Delay in milliseconds before showing next frame
}

// GifASCII converts a GIF to ASCII art frames
type GifASCII struct {
	Width       int
	Height      int
	Chars       []rune
	AspectRatio float64 // Terminal character aspect ratio (default 2.3)
}

// NewGifASCII creates a new GifASCII converter
func NewGifASCII(width, height int) *GifASCII {
	return &GifASCII{
		Width:       width,
		Height:      height,
		Chars:       defaultChars,
		AspectRatio: defaultAspectRatio,
	}
}

// ExtractFrames reads a GIF and returns ASCII frames with timing info
func (g *GifASCII) ExtractFrames(r io.Reader) ([]Frame, error) {
	gifImg, err := gif.DecodeAll(r)
	if err != nil {
		return nil, fmt.Errorf("failed to decode gif: %w", err)
	}

	if len(gifImg.Image) == 0 {
		return nil, fmt.Errorf("gif contains no frames")
	}

	// Validate dimensions
	firstFrame := gifImg.Image[0]
	if firstFrame.Bounds().Dx() == 0 {
		return nil, fmt.Errorf("invalid gif: zero width")
	}
	if firstFrame.Bounds().Dy() == 0 {
		return nil, fmt.Errorf("invalid gif: zero height")
	}

	// Calculate output height maintaining aspect ratio
	if g.Height == 0 {
		ratio := float64(firstFrame.Bounds().Dy()) / float64(firstFrame.Bounds().Dx())
		g.Height = int(float64(g.Width) * ratio / g.AspectRatio)
		if g.Height == 0 {
			g.Height = 1 // Minimum height
		}
	}

	frames := make([]Frame, 0, len(gifImg.Image))
	for i, imgFrame := range gifImg.Image {
		asciiContent := g.frameToASCII(imgFrame, i)

		// GIF delay is in 100ths of a second, convert to milliseconds
		delayMs := 100 // Default 100ms if not specified
		if i < len(gifImg.Delay) && gifImg.Delay[i] > 0 {
			delayMs = gifImg.Delay[i] * 10
		}

		frames = append(frames, Frame{
			Content: asciiContent,
			DelayMs: delayMs,
		})
	}

	return frames, nil
}

// frameToASCII converts a single image frame to ASCII
// frameIndex is used to seed the random number generator for consistent output per frame
func (g *GifASCII) frameToASCII(img *image.Paletted, frameIndex int) string {
	// Resize the image
	resized := image.NewRGBA(image.Rect(0, 0, g.Width, g.Height))
	draw.BiLinear.Scale(resized, resized.Bounds(), img, img.Bounds(), draw.Over, nil)

	// Create a seeded random source for this frame
	// This ensures consistent character selection per frame (no flicker)
	h := fnv.New64a()
	h.Write([]byte(strconv.Itoa(frameIndex)))
	rng := rand.New(rand.NewSource(int64(h.Sum64())))

	// Pre-allocate buffer with estimated size
	// Each pixel: ~20 bytes for ANSI code + 1 char, plus newline per row
	estimatedSize := g.Width * g.Height * 22
	var buf strings.Builder
	buf.Grow(estimatedSize)

	// Reusable buffer for ANSI escape sequence
	ansiBuf := make([]byte, 0, 24)

	var lastR, lastG, lastB uint8 = 255, 255, 255 // Impossible starting value to force first color
	colorSet := false

	for y := 0; y < g.Height; y++ {
		for x := 0; x < g.Width; x++ {
			r, gr, b, _ := resized.At(x, y).RGBA()
			// Convert from 16-bit to 8-bit color
			r8, g8, b8 := uint8(r>>8), uint8(gr>>8), uint8(b>>8)

			// Only emit color code if color changed
			if !colorSet || r8 != lastR || g8 != lastG || b8 != lastB {
				ansiBuf = ansiBuf[:0]
				ansiBuf = append(ansiBuf, "\x1b[38;2;"...)
				ansiBuf = strconv.AppendUint(ansiBuf, uint64(r8), 10)
				ansiBuf = append(ansiBuf, ';')
				ansiBuf = strconv.AppendUint(ansiBuf, uint64(g8), 10)
				ansiBuf = append(ansiBuf, ';')
				ansiBuf = strconv.AppendUint(ansiBuf, uint64(b8), 10)
				ansiBuf = append(ansiBuf, 'm')
				buf.Write(ansiBuf)
				lastR, lastG, lastB = r8, g8, b8
				colorSet = true
			}

			buf.WriteRune(g.Chars[rng.Intn(len(g.Chars))])
		}
		buf.WriteString("\x1b[0m\n")
		colorSet = false // Reset after newline since we emit reset
	}

	return buf.String()
}

// ClearScreen returns ANSI escape sequence to clear screen and move cursor to top
func ClearScreen() string {
	return "\x1b[H\x1b[2J"
}

// MoveCursorHome returns ANSI escape sequence to move cursor to top-left
func MoveCursorHome() string {
	return "\x1b[H"
}
