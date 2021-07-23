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
  ID string `json:"id"`
  Cmd string `json:"cmd"`
  Cwd string `json:"cwd"`
}

type MessageRouter struct {
  channels map[chan Signal]struct{}
}

func NewMessageRouter() *MessageRouter {
  return &MessageRouter{
    channels: make(map[chan Signal]struct{}),
  }
}

func (r *MessageRouter) Signal(sig Signal) {
  log.Printf("signal: %+v", sig)
  for ch := range r.channels {
    ch <- sig
  }
}

func (r *MessageRouter) OnSignal() chan Signal {
  newCh := make(chan Signal, 100)
  r.channels[newCh] = struct{}{}
  return newCh
}

func (r *MessageRouter) UnregisterChannel(ch chan Signal) {
  delete(r.channels, ch)
}

func handleSignal(router *MessageRouter) http.HandlerFunc {
  return func(w http.ResponseWriter, r *http.Request) {
    key := r.FormValue("key")
    t := r.FormValue("type")
    id := r.FormValue("id")
    cmd := r.FormValue("cmd")
    cwd := r.FormValue("cwd")
    router.Signal(Signal{
      Type: t,
      Key: key,
      ID: id,
      Cmd: cmd,
      Cwd: cwd,
    })
    fmt.Fprintf(w, "thank you")
  }
}

func main() {
  fHost := flag.String("host", "", "HTTP host")
  fPort := flag.Int("port", 8888, "HTTP port")
  fStaticDir := flag.String("static_dir", "www", "Directory with static files")
  fUseSSL := flag.Bool("use_ssl", false, "If true, starts server over SSL. Requires ssl_cert and ssl_key args")
  fSSLCert := flag.String("ssl_cert", "Certificate.crt", "SSL certificate file")
  fSSLKey := flag.String("ssl_key", "Key.key", "SSL key file")
  flag.Parse()

  router := NewMessageRouter()

  registerHandlers(router)
  registerMemoryHandlers(router, *fStaticDir)

  http.HandleFunc("/api/babysitter/signal", handleSignal(router))
  http.Handle("/", http.FileServer(http.Dir(*fStaticDir)))

  host := fmt.Sprintf("%s:%d", *fHost, *fPort)
  log.Printf("serving on %s", host)
  if *fUseSSL {
    log.Printf("using SSL")
    log.Fatal(http.ListenAndServeTLS(host, *fSSLCert, *fSSLKey, nil))
  } else {
    log.Fatal(http.ListenAndServe(host, nil))
  }
}

