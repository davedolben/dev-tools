package main

import (
  "flag"
  "fmt"
  "log"
  "net/http"
)

type HTTPLogger struct {
  h http.Handler
}

func (hl *HTTPLogger) ServeHTTP(w http.ResponseWriter, r *http.Request) {
  log.Printf("%s", r.URL.String())
  hl.h.ServeHTTP(w, r)
}

func main() {
  fDir := flag.String("dir", ".", "Directory to serve")
  fPort := flag.Int("port", 8080, "Port on which to serve")
  flag.Parse()

  http.Handle("/", &HTTPLogger{ h: http.FileServer(http.Dir(*fDir)) })

  host := fmt.Sprintf(":%d", *fPort)
  log.Printf("serving on %s", host)
  log.Fatal(http.ListenAndServe(host, nil))
}

