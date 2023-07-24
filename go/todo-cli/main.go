package main

import (
	"fmt"
	"os"
)

func main() {
  filename := os.Args[1]
  items := parseFile(filename)
  //recursivePrint(items.Items, "")

  categories := findCategories(items.Items)
  for _, category := range categories {
    categoryColor.Printf("%s\n", category.Text)
    if len(category.Children) > 8 {
      alertColor.Printf("Too many items in this category: %d > 8", len(category.Children))
      fmt.Println("")
    }
    fmt.Println("")
    printThreads(category.Children, items.AllItems)
    fmt.Println("")
    fmt.Println("")
  }
}
