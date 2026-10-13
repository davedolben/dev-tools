// Bouncing DVD logo screensaver for the terminal. Run with: go run dvd.go
package main

import (
	"fmt"
	"math/rand"
	"os"
	"os/signal"
	"strings"
	"syscall"
	"time"
	"unsafe"
)

var logo = []string{
	` ____  ` + `__     __` + ` ____  `,
	`|  _ \ ` + `\ \   / /` + `|  _ \ `,
	`| | | |` + ` \ \ / / ` + `| | | |`,
	`| |_| |` + `  \ V /  ` + `| |_| |`,
	`|____/ ` + `   \_/   ` + `|____/ `,
	`   ~~~~~ VIDEO ~~~~~   `,
}

var colors = []int{31, 32, 33, 34, 35, 36, 91, 92, 93, 94, 95, 96}

// termSize uses the TIOCGWINSZ ioctl directly to avoid a dependency on golang.org/x/term.
func termSize() (cols, rows int) {
	var ws struct{ Row, Col, X, Y uint16 }
	_, _, errno := syscall.Syscall(syscall.SYS_IOCTL, os.Stdout.Fd(), uintptr(syscall.TIOCGWINSZ), uintptr(unsafe.Pointer(&ws)))
	if errno != 0 || ws.Col == 0 || ws.Row == 0 {
		return 80, 24
	}
	return int(ws.Col), int(ws.Row)
}

func nextColor(cur int) int {
	for {
		c := colors[rand.Intn(len(colors))]
		if c != cur {
			return c
		}
	}
}

func main() {
	logoW, logoH := len(logo[0]), len(logo)

	fmt.Print("\x1b[?1049h\x1b[?25l")
	restore := func() { fmt.Print("\x1b[0m\x1b[?25h\x1b[?1049l") }
	defer restore()

	sig := make(chan os.Signal, 1)
	signal.Notify(sig, os.Interrupt, syscall.SIGTERM)

	// Terminal cells are roughly twice as tall as they are wide, so move vertically at
	// half speed to make the diagonal look like 45 degrees. Both steps are whole cells so
	// every frame moves diagonally; a fractional vy would alternate flat and diagonal steps.
	x, y := 0.0, 0.0
	vx, vy := 2.0, 1.0
	color := nextColor(0)

	ticker := time.NewTicker(200 * time.Millisecond)
	defer ticker.Stop()

	for {
		select {
		case <-sig:
			return
		case <-ticker.C:
		}

		// Polling the size every frame is cheap and handles resizes without SIGWINCH plumbing.
		cols, rows := termSize()
		maxX := float64(max(cols-logoW, 0))
		maxY := float64(max(rows-logoH, 0))

		x += vx
		y += vy
		bounced := false
		if x <= 0 {
			x, vx, bounced = 0, abs(vx), true
		} else if x >= maxX {
			x, vx, bounced = maxX, -abs(vx), true
		}
		if y <= 0 {
			y, vy, bounced = 0, abs(vy), true
		} else if y >= maxY {
			y, vy, bounced = maxY, -abs(vy), true
		}
		if bounced {
			color = nextColor(color)
		}

		var b strings.Builder
		b.WriteString("\x1b[2J")
		fmt.Fprintf(&b, "\x1b[%dm", color)
		col, row := int(x), int(y)
		for i, line := range logo {
			if row+i >= rows {
				break
			}
			if len(line) > cols-col {
				line = line[:max(cols-col, 0)]
			}
			fmt.Fprintf(&b, "\x1b[%d;%dH%s", row+i+1, col+1, line)
		}
		b.WriteString("\x1b[0m")
		os.Stdout.WriteString(b.String())
	}
}

func abs(f float64) float64 {
	if f < 0 {
		return -f
	}
	return f
}
