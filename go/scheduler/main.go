package main

import (
	"flag"
	"fmt"
	"log"
	"time"
)

type TestTask struct {
  Name string
}
func (t *TestTask) Run() error {
  fmt.Printf("Ran task %q\n", t.Name)
  return nil
}

type IntervalSchedule struct {
  Interval time.Duration
}
func (t *IntervalSchedule) IsDue(lastRun time.Time, evalTimestamp time.Time) bool {
  nextRun := lastRun.Add(t.Interval)
  return evalTimestamp.After(nextRun)
}
func (t *IntervalSchedule) ToString() string {
  return fmt.Sprintf("[Interval schedule] every: %v", t.Interval)
}

func main() {
  fFilename := flag.String("filename", "./scheduler-data.json", "file to store scheduler state")
  flag.Parse()

  storage, err := NewFileStorage(*fFilename)
  if err != nil {
    log.Fatal(err)
  }

  scheduler := &Scheduler{
    Storage: storage,
    Tasks: []*ScheduledTask{
      {
        ID: "hello-world-minute",
        Task: &TestTask{
          Name: "hello, world (every minute)",
        },
        Schedule: &IntervalSchedule{
          Interval: time.Minute,
        },
      },
      {
        ID: "hello-world",
        Task: &TestTask{
          Name: "hello, world",
        },
        Schedule: &IntervalSchedule{
          Interval: 10 * time.Second,
        },
      },
    },
  }

  scheduler.Start()
}

