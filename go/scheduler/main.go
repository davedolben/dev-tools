package main

import (
  "fmt"
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
  scheduler := &Scheduler{
    Tasks: []*ScheduledTask{
      &ScheduledTask{
        Name: "Hello world",
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

