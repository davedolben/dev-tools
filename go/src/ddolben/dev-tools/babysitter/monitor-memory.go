package main

import (
	"html/template"
	"net/http"
	"sort"
	"strings"
)

type Command struct {
	Exe string
	Args []string
	Cwd string
}

type CommandAndCount struct {
	Cmd *Command
	Count int
}

func (c *Command) ToString() string {
	return c.Exe + ":" + strings.Join(c.Args, " ") + ":" + c.Cwd
}

type MonitorMemory struct {
	CommonCommands map[string]*CommandAndCount
	RecentCommands []*Command
}

func NewMonitorMemory() *MonitorMemory {
	return &MonitorMemory{
		CommonCommands: make(map[string]*CommandAndCount),
	}
}

func (mm *MonitorMemory) AddCommand(cmd *Command) {
	mm.RecentCommands = append(mm.RecentCommands, cmd)
	if len(mm.RecentCommands) > 10 {
		mm.RecentCommands = mm.RecentCommands[len(mm.RecentCommands)-10:]
	}
	key := cmd.ToString()
	if _, ok := mm.CommonCommands[key]; !ok {
		mm.CommonCommands[key] = &CommandAndCount{
			Cmd: cmd,
			Count: 0,
		}
	}
	mm.CommonCommands[key].Count++
}

var gMm *MonitorMemory

var historyTemplate *template.Template

func handleHistory(w http.ResponseWriter, r *http.Request) {
	var popular []*CommandAndCount
	for _, cmd := range gMm.CommonCommands {
		popular = append(popular, cmd)
	}
	sort.Slice(popular, func(i, j int) bool { return popular[i].Count >= popular[j].Count })
	data := struct {
		RecentCommands []*Command
		CommonCommands []*CommandAndCount
	}{
		RecentCommands: gMm.RecentCommands,
		CommonCommands: popular,
	}
	if err := historyTemplate.Execute(w, data); err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
}

func registerMemoryHandlers(router *MessageRouter, staticDir string) {
	gMm = NewMonitorMemory()

	go func() {
		ch := router.OnSignal()
		for {
			sig := <- ch
			if len(sig.Cmd) > 0 {
				gMm.AddCommand(&Command{
					Exe: sig.Cmd,
					Cwd: sig.Cwd,
				})
			}
		}
	}()

	historyTemplate = template.Must(template.ParseFiles(staticDir + "/history.html"))
  http.HandleFunc("/history", handleHistory)
}
