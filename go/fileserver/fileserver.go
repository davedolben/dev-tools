package main

import (
  "flag"
  "fmt"
  "log"
  "net/http"
  "strings"
)

type HTTPLogger struct {
  h http.Handler
}

func (hl *HTTPLogger) ServeHTTP(w http.ResponseWriter, r *http.Request) {
  log.Printf("%s", r.URL.String())
  hl.h.ServeHTTP(w, r)
}

type DirMapping struct {
  URLPrefix string
  ActualDir string
}

type MappedDirServer struct {
  // Custom mappings from URL dir to actual dir.
  Mappings []DirMapping
  StaticServer http.Handler
}

// If the URL has a mapped dir associated with it, serve that. Otherwise, just do a normal fileserve operation.
func (sv *MappedDirServer) ServeHTTP(w http.ResponseWriter, r *http.Request) {
  path := r.URL.Path
  for _, m := range sv.Mappings {
    if strings.HasPrefix(path, m.URLPrefix) {
      http.StripPrefix(m.URLPrefix, http.FileServer(http.Dir(m.ActualDir))).ServeHTTP(w, r)
      return
    }
  }
  sv.StaticServer.ServeHTTP(w, r)
}

func main() {
  fDir := flag.String("dir", ".", "Directory to serve")
  fPort := flag.Int("port", 8080, "Port on which to serve")
  flag.Parse()

  var mappings []DirMapping
  for _, pair := range flag.Args() {
    s := strings.Split(pair, ":")
    if len(s) != 2 {
      log.Fatal("bad mapping: %q", pair)
    }
    mappings = append(mappings, DirMapping{
      URLPrefix: s[0],
      ActualDir: s[1],
    })
  }

  sv := &MappedDirServer{
    Mappings: mappings,
    StaticServer: http.FileServer(http.Dir(*fDir)),
  }

  http.Handle("/", &HTTPLogger{ h: sv })

  host := fmt.Sprintf(":%d", *fPort)
  log.Printf("serving on %s", host)
  log.Fatal(http.ListenAndServe(host, nil))
}

