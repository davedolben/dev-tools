package main

import (
  "fmt"
  "log"
  "time"
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
