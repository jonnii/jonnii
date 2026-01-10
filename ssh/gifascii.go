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
	// Divide by 2.3 to account for terminal character aspect ratio
	if g.Height == 0 {
		ratio := float64(firstFrame.Bounds().Dy()) / float64(firstFrame.Bounds().Dx())
		g.Height = int(float64(g.Width) * ratio / 2.3)
		if g.Height == 0 {
			g.Height = 1 // Minimum height
		}
	}

	frames := make([]string, 0, len(gifImg.Image))
	for i, frame := range gifImg.Image {
		asciiFrame := g.frameToASCII(frame, i)
		frames = append(frames, asciiFrame)
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

	for y := 0; y < g.Height; y++ {
		for x := 0; x < g.Width; x++ {
			r, gr, b, _ := resized.At(x, y).RGBA()
			// Convert from 16-bit to 8-bit color
			r8, g8, b8 := uint8(r>>8), uint8(gr>>8), uint8(b>>8)

			// Build ANSI escape sequence efficiently
			ansiBuf = ansiBuf[:0]
			ansiBuf = append(ansiBuf, "\x1b[38;2;"...)
			ansiBuf = strconv.AppendUint(ansiBuf, uint64(r8), 10)
			ansiBuf = append(ansiBuf, ';')
			ansiBuf = strconv.AppendUint(ansiBuf, uint64(g8), 10)
			ansiBuf = append(ansiBuf, ';')
			ansiBuf = strconv.AppendUint(ansiBuf, uint64(b8), 10)
			ansiBuf = append(ansiBuf, 'm')

			buf.Write(ansiBuf)
			buf.WriteRune(g.Chars[rng.Intn(len(g.Chars))])
		}
		buf.WriteString("\x1b[0m\n")
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
