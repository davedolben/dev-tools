package main

import (
  "fmt"
  "time"
  "log"
)

type ITask interface {
  Run() error
}

type ISchedule interface {
  IsDue(lastRun time.Time, evalTimestamp time.Time) bool
  ToString() string
}

type ScheduledTask struct {
  Name string
  Schedule ISchedule
  Task ITask
}

type Scheduler struct {
  Tasks []*ScheduledTask
}

func (s *Scheduler) Start() {
  for _, task := range s.Tasks {
    log.Printf("Registering task %q with schedule: %s", task.Name, task.Schedule.ToString())
  }

  // TODO: replace
  getTaskId := func (t *ScheduledTask) string {
    return fmt.Sprintf("%p", t)
  }
  lastRuntimes := make(map[string]time.Time)

  for {
    now := time.Now()
    for _, task := range s.Tasks {
      id := getTaskId(task)
      lastRuntime, found := lastRuntimes[id]
      if !found || task.Schedule.IsDue(lastRuntime, now) {
        log.Printf("Running task %q", task.Name)
        task.Task.Run()
        log.Printf("Finished running task %q", task.Name)
        lastRuntimes[id] = now
      }
    }
    time.Sleep(time.Second)
  }
}

//////////

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

