package main

import (
	"flag"
	"fmt"
	"log"
	"net/http"
	"net/http/httputil"
	"net/url"
	"os"
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

type ProxyMapping struct {
  URLPrefix string
  ProxyDestination *url.URL
}

type MappedDirServer struct {
  // Custom mappings from URL dir to actual dir.
  Mappings []DirMapping
  ProxyMappings []ProxyMapping
  StaticServer http.Handler

  ReverseProxies map[string]*httputil.ReverseProxy
}

func copyHeader(dst, src http.Header) {
  for k, vv := range src {
    for _, v := range vv {
      dst.Add(k, v)
    }
  }
}

// If the URL has a mapped dir associated with it, serve that. Otherwise, just do a normal fileserve operation.
func (sv *MappedDirServer) ServeHTTP(w http.ResponseWriter, r *http.Request) {
  urlPath := r.URL.Path
  for _, m := range sv.Mappings {
    if strings.HasPrefix(urlPath, m.URLPrefix) {
      f, err := os.Stat(m.ActualDir)
      if err != nil {
        http.Error(w, err.Error(), 400)
        return
      }
      if f.IsDir() {
        http.StripPrefix(m.URLPrefix, http.FileServer(http.Dir(m.ActualDir))).ServeHTTP(w, r)
      } else {
        http.ServeFile(w, r, m.ActualDir)
      }
      return
    }
  }
  for _, m := range sv.ProxyMappings {
    if strings.HasPrefix(urlPath, m.URLPrefix) {
      r.Host = m.ProxyDestination.Host
      sv.ReverseProxies[m.URLPrefix].ServeHTTP(w, r)
      return
    }
  }
  sv.StaticServer.ServeHTTP(w, r)
}

func main() {
  fDir := flag.String("dir", ".", "Directory to serve")
  fPort := flag.Int("port", 8080, "Port on which to serve")

  flag.Usage = func() {
    fmt.Fprintf(flag.CommandLine.Output(), "Usage of %s:\n", os.Args[0])
    fmt.Fprintf(flag.CommandLine.Output(), "  Custom path mappings can be specified on the command line.\n")
    fmt.Fprintf(flag.CommandLine.Output(), "  These can also be proxy definitions (if 'directory' starts with http).\n")
    fmt.Fprintf(flag.CommandLine.Output(), "  These can also be single files (if 'directory' is a file and not a dir):\n")
    fmt.Fprintf(flag.CommandLine.Output(), "    <url_prefix>:<directory>\n\n")
    flag.PrintDefaults()
  }

  flag.Parse()

  var mappings []DirMapping
  var proxyMappings []ProxyMapping
  reverseProxies := make(map[string]*httputil.ReverseProxy)

  for _, pair := range flag.Args() {
    s := strings.SplitN(pair, ":", 2)
    if len(s) != 2 {
      log.Fatalf("bad mapping: %q", pair)
    }
    if (strings.HasPrefix(s[1], "http")) {
      remote, err := url.Parse(s[1])
      if err != nil {
        log.Fatal(err)
      }
      proxyMappings = append(proxyMappings, ProxyMapping{
        URLPrefix: s[0],
        ProxyDestination: remote,
      })
      reverseProxies[s[0]] = httputil.NewSingleHostReverseProxy(remote)
      log.Printf("proxying %s -> %s", s[0], s[1])
    } else {
      mappings = append(mappings, DirMapping{
        URLPrefix: s[0],
        ActualDir: s[1],
      })
      log.Printf("mapping url %s to dir %s", s[0], s[1])
    }
  }

  sv := &MappedDirServer{
    Mappings: mappings,
    ProxyMappings: proxyMappings,
    StaticServer: http.FileServer(http.Dir(*fDir)),
    ReverseProxies: reverseProxies,
  }

  http.Handle("/", &HTTPLogger{ h: sv })

  host := fmt.Sprintf(":%d", *fPort)
  log.Printf("serving on %s", host)
  log.Fatal(http.ListenAndServe(host, nil))
}

