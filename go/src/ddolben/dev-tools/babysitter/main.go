package main

import (
  "flag"
  "fmt"
  "log"
  "net/http"
)

type Signal struct {
  Type string
  Key string
}

type MessageRouter struct {
  signalCh chan Signal
}

func NewMessageRouter() *MessageRouter {
  return &MessageRouter{
    signalCh: make(chan Signal, 100),
  }
}

func (r *MessageRouter) Signal(sig Signal) {
  r.signalCh <- sig
}

func (r *MessageRouter) OnSignal() chan Signal {
  return r.signalCh
}

func handleSignal(router *MessageRouter) http.HandlerFunc {
  return func(w http.ResponseWriter, r *http.Request) {
    key := r.FormValue("key")
    t := r.FormValue("type")
    router.Signal(Signal{
      Type: t,
      Key: key,
    })
    fmt.Fprintf(w, "thank you")
  }
}

func handleMonitor(w http.ResponseWriter, r *http.Request) {
  fmt.Fprintf(w, "Hello world")
}

func main() {
  fPort := flag.Int("port", 8888, "HTTP port")
  flag.Parse()

  router := NewMessageRouter()
  go func() {
    for sig := range router.OnSignal() {
      log.Printf("signal: %s [%s]", sig.Key, sig.Type)
    }
  }()

  http.HandleFunc("/api/babysitter/signal", handleSignal(router))
  http.HandleFunc("/", handleMonitor)

  host := fmt.Sprintf(":%d", *fPort)
  log.Printf("serving on %s", host)
  http.ListenAndServe(host, nil)
}

