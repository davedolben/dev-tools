package bookmarks

import (
  "fmt"
  "html/template"
  "net/http"
  "net/url"
  "path"
  "regexp"
  "strconv"
  "strings"
  "time"

  "ddolben/notes/data"
)

var tagsSplitRegex = regexp.MustCompile(`[\w-]+`)

var gDb data.NotesDatabase

var listTemplate *template.Template
var listTemplateString = `
<html>
<head>
  <title>My Bookmarks</title>
  <link rel="stylesheet" type="text/css" href="/style.css" />
</head>
<body class="flex-cols-container">
<div class="flex-fill"></div>
<div class="app-width flex-max-width">
<div>
  <a href="/">Home</a> |
  <a href="/bookmarks">Bookmarks</a> |
  <a href="javascript: function archive() { var d=document,l=d.location; d.location='http://localhost:8080/bookmarks?fill_url='+encodeURIComponent(l.href)+'&fill_title='+encodeURIComponent(d.title); } archive();">Enqueue</a> |
  <span>
    <a href="javascript: function suspend() { var d=document,l=d.location; d.location='http://localhost:8080/bookmarks?fill_url='+encodeURIComponent(l.href)+'&fill_title='+encodeURIComponent(d.title)+'&fill_tags=suspended&auto_submit'; } suspend();">Suspend</a> (auto-submit)
  </span>
</div>
<hr />
<form id="add-form" action="/api/bookmarks/add" method="POST">
  <div class="flex-rows-container app-width">
    <div class="flex-cols-container bottom-padded">
      <span class="label padded-input">Title:</span>
      <input class="flex-fill padded-input" type="text" name="title" value="{{.FillTitle}}"/>
    </div>
    <div class="flex-cols-container bottom-padded">
      <span class="label padded-input">URL:</span>
      <input class="flex-fill padded-input" type="text" name="url" value="{{.FillURL}}"/>
    </div>
    <div class="flex-cols-container bottom-padded">
      <span class="label padded-input">Description:</span>
      <textarea class="flex-fill padded-input" name="body"></textarea>
    </div>
    <div class="flex-cols-container bottom-padded">
      <span class="label padded-input">Tags:</span>
      <input id="tags-input" class="flex-fill padded-input" name="tags" type="text" value="{{joinStrings .FillTags ", "}}"/>
    </div>
    <div class="flex-cols-container">
      <span>
        Helpers: 
        <a href="#" id="send-shortcut-link">Bookmark</a> |
        <a href="#" id="view-shortcut-link">View List</a>
      </span>
      <span class="flex-fill"></span>
      <span>
        <button type="submit">Save</button>
      </span>
    </div>
  </div>
</form>

<script type="text/javascript">
// Mini script to update the shortcut link as the user adds new tags.
(function() {
  let tags_input = document.querySelector("#tags-input");
  let send_link = document.querySelector("#send-shortcut-link");
  let view_link = document.querySelector("#view-shortcut-link");

  let on_update = (e) => {
    let tags = tags_input.value.split(',');
    for (let i = 0; i < tags.length; i++) {
      tags[i] = tags[i].trim();
    }
    let tags_string = tags.join(', ');

    let send_url_tags = "";
    let view_url_tags = "";
    for (let i = 0; i < tags.length; i++) {
      tags[i] = tags[i].trim();
      send_url_tags += "&fill_tags=" + tags[i];
      view_url_tags += "&tag=" + tags[i];
    }

    let new_send_link = "javascript: function suspend() { var d=document,l=d.location; d.location='http://localhost:8080/bookmarks?fill_url='+encodeURIComponent(l.href)+'&fill_title='+encodeURIComponent(d.title)+'" + send_url_tags + "&auto_submit'; } suspend();";
    let new_view_link = "/bookmarks?" + view_url_tags;

    send_link.href = new_send_link;
    send_link.title = "Tags: " + tags_string + " (Autosubmit}";
    send_link.innerHTML = "Bookmark (" + tags_string + ")";
    view_link.href = new_view_link;
    view_link.title = "Tags: " + tags_string;
    view_link.innerHTML = "View List (" + tags_string + ")";
  };

  tags_input.onchange = on_update;
  tags_input.onkeyup = on_update;
})();
</script>

<hr />
<div>
{{range .Bookmarks}}
  <div class="note app-width">
    <span class="hover-controls">
      <div>
        ({{.ID}})
        {{formatTime .Created}}
        <a class="button" href="/api/bookmarks/delete?id={{.ID}}&redirect={{$.Redirect}}">X</a>
      </div>
    </span>
    <span>
      <div class="note-line">
        <span class="note-title">
          {{if .URL}}
            {{if .Title}}
              <a href="{{.URL}}">{{.Title}}</a>
            {{else}}
              <a href="{{.URL}}">{{.URL}}</a>
            {{end}}
          {{else}}
            <span>{{.Title}}</span>
          {{end}}
        </span>
        <span>{{range .Tags}}<span class="tag"><a href="/bookmarks?tag={{.}}">{{.}}</a></span>{{end}}</span>
      </div>
      {{if .Body}}
        <div class="note-body">{{htmlify .Body}}</div>
      {{end}}
    </span>
  </div>
{{end}}
</div>
</div>
<div class="flex-fill"></div>

{{ if .AutoSubmit }}
<script type="text/javascript">
// Auto-submit the form
document.querySelector("#add-form").submit();
</script>
{{ end }}
</body>
</html>
`

func queryFromValues(values url.Values) *data.NotesQuery {
  q := &data.NotesQuery{}
  if len(values["tag"]) > 0 {
    q.Tags = values["tag"]
  }
  return q
}

func handleUnimplemented(w http.ResponseWriter, r *http.Request) {
  http.Error(w, "UNIMPLEMENTED", 500)
}

func serveList(w http.ResponseWriter, r *http.Request) {
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

  r.ParseForm()
  fillTags := r.Form["fill_tags"]

  redirect := "/bookmarks"
  currentTags := r.URL.Query()["tag"]
  if len(currentTags) > 0 {
    redirect += "?tag=" + strings.Join(r.URL.Query()["tag"], "&tag=")
  }
  autoSubmit := len(r.URL.Query()["auto_submit"]) > 0

  data := struct {
    Bookmarks []data.Note
    FillTitle string
    FillURL string
    FillTags []string
    Redirect string
    AutoSubmit bool
  }{
    Bookmarks: sortedNotes,
    FillTitle: r.FormValue("fill_title"),
    FillURL: r.FormValue("fill_url"),
    FillTags: fillTags,
    Redirect: redirect,
    AutoSubmit: autoSubmit,
  }

  if err := listTemplate.Execute(w, &data); err != nil {
    fmt.Printf("Error serving list: %s\n", err)
    http.Error(w, "Error serving list", 500)
  }
}

func handleAdd(w http.ResponseWriter, r *http.Request) {
  title := r.FormValue("title")
  body := r.FormValue("body")
  link := r.FormValue("url")
  tagsStr := r.FormValue("tags")
  tags := tagsSplitRegex.FindAllString(tagsStr, -1)

  note := &data.Note{
    Title: title,
    Body: body,
    URL: link,
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
  http.Redirect(w, r, "/bookmarks", http.StatusFound)
}

func handleDelete(w http.ResponseWriter, r *http.Request) {
  redirect := r.FormValue("redirect")

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
  http.Redirect(w, r, redirect, http.StatusFound)
}

func initDatabase(root string) {
  var err error
  gDb, err = data.NewTextDatabase(path.Join(root, "bookmarks.json"))
  if err != nil {
    panic(err)
  }
}

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
}

func RegisterHandlers(server *http.ServeMux, dataRoot string) {
  initDatabase(dataRoot)
  setupTemplates()

  server.HandleFunc("/api/bookmarks/add", handleAdd)
  server.HandleFunc("/api/bookmarks/delete", handleDelete)
  server.HandleFunc("/bookmarks", serveList)
}

