package main

import (
  "fmt"
  "flag"
  "io"
  "log"
  "net/http"
  "os"
  "path"
  "path/filepath"

  "github.com/davedolben/dev-tools/go/filedrop/www"
)

var (
  dropDirectory = flag.String("directory", ".", "Directory in which to drop files.")
  port = flag.Int("port", 8080, "Port to serve on.")
	fHostname = flag.String("host", "", "Host to serve on.")
)

func ReceiveFile(w http.ResponseWriter, r *http.Request) {
  file, header, err := r.FormFile("file")
  if err != nil {
    log.Fatal(err)
  }
  defer file.Close()
  fmt.Printf("Received file: %s\n", header.Filename)
  //var Buf bytes.Buffer
  //io.Copy(&Buf, file)
  //contents := Buf.String()
  //fmt.Println(contents)
  //Buf.Reset()
  f, err := os.OpenFile(path.Join(*dropDirectory, header.Filename), os.O_WRONLY|os.O_CREATE, 0666)
  if err != nil {
    log.Fatal(err)
  }
  defer f.Close()
  io.Copy(f, file)
  fmt.Printf("Wrote file: %s\n", f.Name())

  http.Redirect(w, r, "/", http.StatusFound)
}

func main() {
  flag.Parse()

  // Make sure the directory exists.
  err := os.MkdirAll(*dropDirectory, 0777)
  if err != nil {
    log.Fatal(err)
  }

  absPath, err := filepath.Abs(*dropDirectory)
  if err != nil {
    log.Fatal(err)
  }
  fmt.Printf("Dropped files will appear in %s\n", absPath)

  http.HandleFunc("/upload", ReceiveFile)
  http.Handle("/", http.FileServer(www.Assets))
  host := fmt.Sprintf("%s:%d", *fHostname, *port)
  fmt.Printf("Serving at %s\n", host)
  http.ListenAndServe(host, nil)
}
