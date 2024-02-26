//
// A little CLI utility to give you a timer on the command line. Can be used in a && chain to
// delay some operation, and also show you the time remaining.
//

package main

import (
  "flag"
  "fmt"
  "math"
  "time"
)

// ASCII ESC character
var ESC = 27
// Move the cursor up one line and clear the line
var clearLine = fmt.Sprintf("%c[%dA%c[2K", ESC, 1, ESC)
// Move the cursor to position 0,0 in the terminal
//fmt.Printf("\033[0;0H")

func durationToString(d time.Duration) string {
  return fmt.Sprintf(
    "%02d:%02d:%02d",
    int32(math.Floor(d.Hours())),
    int32(math.Floor(d.Minutes())) % 60,
    int32(math.Floor(d.Seconds())) % 60,
  )
}

func main() {
  fDuration := flag.Duration("duration", 60*time.Second, "Duration in the format ##h##m##s")
  flag.Parse()

  targetTime := time.Now().Add(*fDuration)

  fmt.Println("")
  timeDiff := targetTime.Sub(time.Now())
  fmt.Printf("Remaining: %s\n", durationToString(timeDiff))

  ticker := time.NewTicker(time.Second)
  for time.Now().Before(targetTime) {
    timeDiff = targetTime.Sub(time.Now())
    fmt.Printf(clearLine)
    fmt.Printf("Remaining: %s\n", durationToString(timeDiff))
    <-ticker.C
  }
  ticker.Stop()
  fmt.Println("")
}

