package main

import (
  "flag"
  "fmt"
  "html/template"
  "net/http"
  "net/url"
  "path"
  "regexp"
  "strconv"
  "strings"
  "time"

  "ddolben/notes/bookmarks"
  "ddolben/notes/data"
)

var tagsSplitRegex = regexp.MustCompile(`[\w-]+`)

var gDb data.NotesDatabase

var styleSheetString = `
.note {
  border: solid 1px #ccc;
  border-radius: 8px;
  margin-bottom: 5px;
  padding: 3px 5px;
  position: relative;
}
.note:hover {
  box-shadow: 0 0 5px black;
}
.label {
  padding-right: 5px;
}
.bottom-padded {
  padding-bottom: 3px;
}
.padded-input {
  padding: 3px 5px;
}
.app-width {
  max-width: 1000px;
}
.flex-rows-container {
  display: flex;
  flex-direction: column;
}
.flex-cols-container {
  display: flex;
  flex-direction: row;
}
.flex-fill {
  flex-grow: 1;
}
.flex-max-width {
  flex-grow: 1000;
}
.note-line {
  display: block;
  margin-bottom: 3px;
}
.note-title {
  font-weight: bold;
}
.tag {
  background-color: #eee;
  margin-right: 3px;
  padding: 1px 2px;
}
.tag > a {
  color: #555;
  text-decoration: none;
}
.tag > a:hover {
  color: black;
  text-decoration: underline;
}
.hover-controls {
  position: absolute;
  visibility: hidden;
  bottom: 2px;
  right: 3px;
  background: white;
}
.note:hover > .hover-controls {
  visibility: visible;
}
.button {
  font: inherit;
  color: black;
  cursor: pointer;
  text-decoration: none;
  padding: 2px 3px;
  background: white;
  border: solid 1px #ccc;
  border-radius: 3px;
  display: inline-block;
}
.button:hover {
  text-decoration: underline;
}
`

var listTemplate *template.Template
var listTemplateString = `
<html>
<head>
  <title>My Notes</title>
  <link rel="stylesheet" type="text/css" href="/style.css" />
</head>
<body class="flex-cols-container">
<div class="flex-fill"></div>
<div class="app-width flex-max-width">
<div>
  <a href="/">Home</a> |
  <a href="/bookmarks">Bookmarks</a>
</div>
<hr />
<form action="/api/add" method="POST">
  <div class="flex-rows-container app-width">
    <div class="flex-cols-container bottom-padded">
      <span class="label padded-input">Title:</span>
      <input class="flex-fill padded-input" type="text" name="title" />
    </div>
    <div class="flex-cols-container bottom-padded"><textarea name="body" class="flex-fill padded-input" rows="4"></textarea></div>
    <div class="flex-cols-container bottom-padded">
      <span class="label padded-input">Tags:</span>
      <input class="flex-fill padded-input" name="tags" type="text" width="300px" />
    </div>
    <div class="flex-cols-container"><span class="flex-fill"></span><button type="submit">Save</button></div>
  </div>
</form>
<hr />
<div>
{{range .Notes}}
  <div class="note app-width">
    <span class="hover-controls">
      ({{.ID}})
      {{formatTime .Created}}
      <a class="button" href="/edit?id={{.ID}}">edit</a>
      <a class="button" href="/api/delete?id={{.ID}}">X</a>
    </span>
    <span>
      {{if .Title}}
        <div class="note-line note-title">{{.Title}}</div>
      {{end}}
      {{if .Body}}
        <div class="note-line">{{htmlify .Body}}</div>
      {{end}}
      <span>{{range .Tags}}<span class="tag"><a href="/?tag={{.}}">{{.}}</a></span>{{end}}</span>
    </span>
  </div>
{{end}}
</div>
</div>
<div class="flex-fill"></div>
</body>
</html>
`

var editTemplate *template.Template
var editTemplateString = `
<html>
<head>
  <title>Edit: {{.ID}}</title>
  <link rel="stylesheet" type="text/css" href="/style.css" />
</head>
<body class="flex-cols-container">
<div class="flex-fill"></div>
<div class="app-width flex-max-width">
  <form action="/api/update" method="POST">
  <input type="hidden" name="id" value="{{.ID}}" />
  <div>
    <a class="button" href="/">Cancel</a>
    <button type="submit" class="button" href="/">Save</a>
  </div>
  <hr />
  <div>
    <div class="flex-rows-container app-width">
      <div class="flex-cols-container bottom-padded">
        <span class="label padded-input">Title:</span>
        <input class="flex-fill padded-input" type="text" name="title" value="{{.Body}}"/>
      </div>
      <div class="flex-cols-container bottom-padded"><textarea name="body" class="flex-fill padded-input" rows="4">{{.Body}}</textarea></div>
      <div class="flex-cols-container bottom-padded">
        <span class="label padded-input">Tags:</span>
        <input class="flex-fill padded-input" name="tags" type="text" width="300px" value="{{joinStrings .Tags ", "}}"/>
      </div>
    </div>
  </div>
  </form>
</div>
<div class="flex-fill"></div>
</body>
</html>
`

func setupTemplates() {
  tmplFuncs := template.FuncMap{
    "htmlify": func(s string) template.HTML {
      return template.HTML(strings.Replace(s, "\n", "<br/>", -1))
    },
    "formatTime": func(t time.Time) string {
      return t.Format(time.ANSIC)
    },
    "joinStrings": func(ss []string, separator string) string {
      return strings.Join(ss, separator)
    },
  }
  listTemplate = template.Must(template.New("list").Funcs(tmplFuncs).Parse(listTemplateString))
  editTemplate = template.Must(template.New("edit").Funcs(tmplFuncs).Parse(editTemplateString))
}

func queryFromValues(values url.Values) *data.NotesQuery {
  q := &data.NotesQuery{}
  if len(values["tag"]) > 0 {
    q.Tags = values["tag"]
  }
  return q
}

func serveListNotes(w http.ResponseWriter, r *http.Request) {
  notes, err := gDb.Query(queryFromValues(r.URL.Query()))
  if err != nil {
    fmt.Printf("Error serving list: %s\n", err)
    http.Error(w, "Error serving list", 500)
    return
  }

  // Reverse
  var sortedNotes []data.Note
  for i := len(notes)-1; i >= 0; i-- {
    sortedNotes = append(sortedNotes, notes[i])
  }

  data := struct {
    Notes []data.Note
  }{
    Notes: sortedNotes,
  }

  if err := listTemplate.Execute(w, &data); err != nil {
    fmt.Printf("Error serving list: %s\n", err)
    http.Error(w, "Error serving list", 500)
  }
}

func handleAddNote(w http.ResponseWriter, r *http.Request) {
  title := r.FormValue("title")
  body := r.FormValue("body")
  tagsStr := r.FormValue("tags")
  tags := tagsSplitRegex.FindAllString(tagsStr, -1)

  note := &data.Note{
    Title: title,
    Body: body,
    Tags: tags,
  }

  if err := gDb.Add(note); err != nil {
    http.Error(w, err.Error(), 500)
    return
  }
  if err := gDb.Flush(); err != nil {
    http.Error(w, err.Error(), 500)
    return
  }
  http.Redirect(w, r, "/", http.StatusFound)
}

func serveStyleSheet(w http.ResponseWriter, r *http.Request) {
  fmt.Fprintf(w, "%s", styleSheetString)
}

func handleDeleteNote(w http.ResponseWriter, r *http.Request) {
  idStr := r.FormValue("id")
  id, err := strconv.ParseInt(idStr, 10, 64)
  if err != nil {
    http.Error(w, err.Error(), 500)
    return
  }
  if id <= 0 {
    http.Error(w, "bad id", 500)
    return
  }
  if err := gDb.Delete(id); err != nil {
    http.Error(w, err.Error(), 500)
    return
  }
  if err := gDb.Flush(); err != nil {
    http.Error(w, err.Error(), 500)
    return
  }
  http.Redirect(w, r, "/", http.StatusFound)
}

func handleUpdateNote(w http.ResponseWriter, r *http.Request) {
  idStr := r.FormValue("id")
  id, err := strconv.ParseInt(idStr, 10, 64)
  if err != nil {
    http.Error(w, err.Error(), 500)
    return
  }
  if id <= 0 {
    http.Error(w, "bad id", 500)
    return
  }

  title := r.FormValue("title")
  body := r.FormValue("body")
  tags := r.FormValue("tags")

  fmt.Printf("Would update: %d\n%s\n%s\n%s", id, title, body, tags)

  //if err := gDb.Flush(); err != nil {
  //  http.Error(w, err.Error(), 500)
  //  return
  //}
  http.Redirect(w, r, "/", http.StatusFound)
}

func serveEdit(w http.ResponseWriter, r *http.Request) {
  note := &data.Note{
    ID: 1234,
    Title: "title",
    Body: "body goes here",
    Tags: []string{"one", "two"},
  }
  if err := editTemplate.Execute(w, note); err != nil {
    fmt.Printf("Error serving edit: %s\n", err)
    http.Error(w, "Error serving edit", 500)
  }
}

func main() {
  fHost := flag.String("host", "localhost", "host to serve on")
  fPort := flag.Int("port", 8080, "port to serve on")
  fDataRoot := flag.String("data_root", ".", "root directory for data")
  flag.Parse()

  var err error
  gDb, err = data.NewTextDatabase(path.Join(*fDataRoot, "notes.json"))
  if err != nil {
    panic(err)
  }

  setupTemplates()

  mux := http.NewServeMux()
  bookmarks.RegisterHandlers(mux, *fDataRoot)

  mux.HandleFunc("/api/add", handleAddNote)
  mux.HandleFunc("/api/delete", handleDeleteNote)
  mux.HandleFunc("/api/update", handleUpdateNote)
  mux.HandleFunc("/style.css", serveStyleSheet)
  mux.HandleFunc("/edit", serveEdit)
  mux.HandleFunc("/", serveListNotes)

  http.Handle("/", mux)

  host := fmt.Sprintf("%s:%d", *fHost, *fPort)
  fmt.Printf("Serving on %s\n", host)
  http.ListenAndServe(host, nil)
}

