package main

import (
	"bufio"
	"fmt"
	"os"
	"regexp"
	"strings"

	"github.com/fatih/color"
)

type Item struct {
	Text string
	Children []*Item
	Tags []string
}

type Document struct {
	Items []*Item
	AllItems []*Item
}

type PeekingScanner struct {
	Scanner *bufio.Scanner
	value string
	hasValue bool
}

func (s *PeekingScanner) HasValue() bool {
	return s.hasValue
}

func (s *PeekingScanner) Scan() {
	s.hasValue = s.Scanner.Scan()
	s.value = s.Scanner.Text()
}

func (s *PeekingScanner) Text() string {
	return s.value
}

func recursivePrint(items []*Item, prefix string) {
	for _, item := range items {
		fmt.Printf("%s%s (%s)\n", prefix, item.Text, strings.Join(item.Tags, ","))
		recursivePrint(item.Children, prefix + "> ")
	}
}

var threadRegex = regexp.MustCompile("^(?:-[ \t]*)?@([a-zA-Z0-9-_/:]+)[ \t]*$")

func firstTaskInList (items []*Item) *Item {
	for _, item := range items {
		if strings.HasPrefix(item.Text, "-") {
			return item
		}
	}
	return nil
}

var categoryColor = color.New(color.FgHiBlue)
var threadColor = color.New(color.FgMagenta)
var emptyColor = color.New(color.FgHiBlack, color.CrossedOut)
var alertColor = color.New(color.FgWhite, color.BgRed)

func printThreads(threads []*Item, allItems []*Item) {
	for _, thread := range threads {
		threadMatch := threadRegex.FindStringSubmatch(thread.Text)
		if threadMatch != nil && threadMatch[1] != "" {
			children := searchByTag(allItems, []string{threadMatch[1]})
			task := firstTaskInList(children)
			if task != nil {
				fmt.Printf("%s ", task.Text)
				threadColor.Printf("(%s)", thread.Text)
				fmt.Printf("\n")
			} else {
				emptyColor.Printf("(0) %s\n", thread.Text)
			}
		} else {
			fmt.Printf("%s\n", thread.Text)
		}
	}
}

func searchByTag(items []*Item, tags []string) []*Item {
	var found []*Item
	for _, item := range items {
		for _, tag := range tags {
			if sliceContains(item.Tags, tag) {
				found = append(found, item)
				break
			}
		}
	}
	return found
}

func parseLines(scanner *PeekingScanner, indent string) []*Item {
	var items []*Item

	for {
		// Algorithm:
		//   Pull current line
		//   Advance scanner and pull next line
		//   If next line is the same indent, add current line to list and continue
		//   If next line is more indented, recurse and add children to current line
		//   If next line is less indented, add current line to list and return

		if !strings.HasPrefix(scanner.Text(), indent) {
			return items
		}

		currentLine := strings.TrimPrefix(scanner.Text(), indent)
		scanner.Scan()
		nextLine := scanner.Text()

		// If there isn't a next line, we're done (base case)
		if !scanner.HasValue() {
			items = append(items, &Item{ Text: currentLine })
			break
		}

		// If the next line is less indented, add the current line to the list and return
		if !strings.HasPrefix(nextLine, indent) {
			items = append(items, &Item{
				Text: currentLine,
			})
			break
		}

		// TODO: const
		moreIndentRegex := regexp.MustCompile("^([ \t]+).*")
		moreIndent := moreIndentRegex.FindStringSubmatch(strings.TrimPrefix(nextLine, indent))
		// If the next line is more indented, recurse on the following lines
		if moreIndent != nil && moreIndent[1] != "" {
			child := &Item{
				Text: currentLine,
				Children: parseLines(scanner, indent + moreIndent[1]),
			}
			items = append(items, child)
			continue
		}

		// If we've gotten this far, next line has the same indent so add it to the list and move on
		items = append(items, &Item{ Text: currentLine })
	}
	return items
}

func collectAllItems(items []*Item, inheritedTags []string) []*Item {
	var collected []*Item
	tagRegex := regexp.MustCompile("@([a-zA-Z0-9-_/:]+)")
	for _, item := range items {
		tagMatches := tagRegex.FindAllStringSubmatch(item.Text, -1)
		for _, match := range tagMatches {
			item.Tags = append(item.Tags, match[1])
		}
		// Also add any inherited tags from higher up
		item.Tags = append(item.Tags, inheritedTags...)

		// Check if this item is a thread definition, and if so push down the thread
		// name as a tag to its children.
		pushDownTags := make([]string, len(inheritedTags))
		threadMatch := threadRegex.FindStringSubmatch(item.Text)
		copy(pushDownTags, inheritedTags)
		if threadMatch != nil && threadMatch[1] != "" {
			pushDownTags = append(pushDownTags, threadMatch[1])
		}

		collected = append(collected, item)
		collected = append(collected, collectAllItems(item.Children, pushDownTags)...)
	}
	return collected
}

func findCategories(items []*Item) []*Item {
	var categories []*Item
	categoryRegex := regexp.MustCompile("^#[ \t]*([^:]+):[ \t]*$")
	for _, item := range items {
		categoryMatch := categoryRegex.FindStringSubmatch(item.Text)
		if categoryMatch != nil && categoryMatch[1] != "" {
			categories = append(categories, item)
		}
	}
	return categories
}

func parseFile(filename string) *Document {
	f, err := os.Open(filename)
	if err != nil {
		panic(err)
	}

	scanner := bufio.NewScanner(f)
	scanner.Split(bufio.ScanLines)
	pscanner := &PeekingScanner{
		Scanner: scanner,
	}
	pscanner.Scan()

	items := parseLines(pscanner, "")
	doc := &Document{
		Items: items,
		AllItems: collectAllItems(items, nil),
	}
	return doc
}
