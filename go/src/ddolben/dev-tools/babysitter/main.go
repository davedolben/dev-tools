package main

import (
  "flag"
  "fmt"
  "log"
  "net/http"
)

type Signal struct {
  Type string `json:"type"`
  Key string `json:"key"`
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
  log.Printf("signal: %s [%s]", sig.Key, sig.Type)
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

func main() {
  fPort := flag.Int("port", 8888, "HTTP port")
  fStaticDir := flag.String("static_dir", "www", "Directory with static files")
  flag.Parse()

  router := NewMessageRouter()

  registerHandlers(router)

  http.HandleFunc("/api/babysitter/signal", handleSignal(router))
  http.Handle("/", http.FileServer(http.Dir(*fStaticDir)))

  host := fmt.Sprintf(":%d", *fPort)
  log.Printf("serving on %s", host)
  http.ListenAndServe(host, nil)
}

