package gsheets

import (
  "fmt"
  "time"
)

func stringToTime(str string) (time.Time, error) {
  fmts := []string{
    "1/2/2006",
    "01/02/2006",
    "03:04:05 PM",
    "3:04:05 PM",
    "03:04 PM",
    "3:04 PM",
    "15:04",
    "15:04:05",
  }
  for _, f := range fmts {
    time, err := time.Parse(f, str)
    if err == nil {
      return time, nil
    }
  }
  return time.Time{}, fmt.Errorf("failed to parse string to date: %q", str)
}

