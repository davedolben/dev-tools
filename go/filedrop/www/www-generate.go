// +build ignore

package main

import (
  "log"

  "github.com/shurcooL/vfsgen"

  "github.com/davedolben/dev-tools/go/filedrop/www"
)

func main() {
  err := vfsgen.Generate(www.Assets, vfsgen.Options{
    Filename: "www/assets_generated.go",
    PackageName: "www",
    BuildTags: "!dev",
    VariableName: "Assets",
  })
  if err != nil {
    log.Fatal(err)
  }
}
