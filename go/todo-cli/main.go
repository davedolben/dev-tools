package main

import (
	"os"
)

func main() {
  filename := os.Args[1]
  items := parseFile(filename)
  recursivePrint(items.Items, "")

  recursivePrint(searchByTag(items.AllItems, []string{"now"}), "")
}
