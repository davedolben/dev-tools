package main

import (
	"encoding/json"
	"errors"
	"log"
	"os"
	"time"
)

var ErrNotFound = errors.New("not found")

type FileStorage struct {
  Path string
  state map[string]string
}

func NewFileStorage(path string) (*FileStorage, error) {
  state := make(map[string]string)

  bs, err := os.ReadFile(path)
  if err != nil && !errors.Is(err, os.ErrNotExist) {
    return nil, err
  }

  if !errors.Is(err, os.ErrNotExist) {
    err = json.Unmarshal(bs, &state)
    if err != nil {
      return nil, err
    }
  }

  return &FileStorage{Path: path, state: state}, nil
}

func (fs *FileStorage) flush() error {
  bs, err := json.Marshal(fs.state)
  if err != nil {
    return err
  }
  return os.WriteFile(fs.Path, bs, 0644)
}

func (fs *FileStorage) Get(key string) (string, error) {
  value, found := fs.state[key]
  if !found {
    return "", ErrNotFound
  }
  return value, nil
}

func (fs *FileStorage) Set(key string, value string) error {
  fs.state[key] = value
  return fs.flush()
}

type ITask interface {
  Run() error
}

type ISchedule interface {
  IsDue(lastRun time.Time, evalTimestamp time.Time) bool
  ToString() string
}

type ScheduledTask struct {
  // Must be unique across tasks
  ID string
  Schedule ISchedule
  Task ITask
}

type Scheduler struct {
  Tasks []*ScheduledTask
  Storage *FileStorage
}

func (s *Scheduler) Start() {
  if s.Storage == nil {
    log.Fatalf("Storage is required")
  }

  for _, task := range s.Tasks {
    log.Printf("Registering task %q with schedule: %s", task.ID, task.Schedule.ToString())
  }

  getLastRuntime := func (t *ScheduledTask) (time.Time, bool) {
    value, err := s.Storage.Get(t.ID + "_last_runtime")
    if err == ErrNotFound {
      return time.Time{}, false
    }
    if err != nil {
      log.Fatal(err)
    }
    var tim time.Time
    err = tim.UnmarshalText([]byte(value))
    if err != nil {
      log.Fatal(err)
    }
    return tim, true
  }
  setLastRuntime := func (t *ScheduledTask, tim time.Time) {
    bs, err := tim.MarshalText()
    if err != nil {
      log.Fatal(err)
    }
    err = s.Storage.Set(t.ID + "_last_runtime", string(bs))
    if err != nil {
      log.Fatal(err)
    }
  }

  for {
    now := time.Now()
    for _, task := range s.Tasks {
      lastRuntime, found := getLastRuntime(task)
      if !found || task.Schedule.IsDue(lastRuntime, now) {
        log.Printf("Running task %q", task.ID)
        task.Task.Run()
        log.Printf("Finished running task %q", task.ID)
        setLastRuntime(task, now)
      }
    }
    time.Sleep(time.Second)
  }
}
