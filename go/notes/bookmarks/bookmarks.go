package bookmarks

import (
  "fmt"
  "html/template"
  "log"
  "net/http"
  "net/url"
  "path"
  "regexp"
  "strconv"
  "strings"
  "time"

  "github.com/davedolben/dev-tools/go/notes/data"
)

var tagsSplitRegex = regexp.MustCompile(`[\w-_:/]+`)

var gDb data.NotesDatabase

var listTemplate *template.Template
var listTemplateString = `
<html>
<head>
  <title>My Bookmarks</title>
  <link rel="stylesheet" type="text/css" href="/style.css" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body class="flex-cols-container">
<div class="flex-fill"></div>
<div class="app-width flex-max-width">
<div>
  <a href="/">Home</a> |
  <a href="/bookmarks">Bookmarks</a>
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
        <a href="" id="send-shortcut-link-auto">Bookmark</a> (auto) |
        <a href="" id="send-shortcut-link-manual">Add</a> |
        <a href="" id="view-shortcut-link">List</a>
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
  let send_link_auto = document.querySelector("#send-shortcut-link-auto");
  let send_link_manual = document.querySelector("#send-shortcut-link-manual");
  let view_link = document.querySelector("#view-shortcut-link");

  let on_update = () => {
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

    let link_root = document.location.origin;

    let new_send_link_auto = "javascript: function bookmark() { var d=document,l=d.location; d.location='"+link_root+"/bookmarks?fill_url='+encodeURIComponent(l.href)+'&fill_title='+encodeURIComponent(d.title)+'" + send_url_tags + "&auto_submit'; } bookmark();";
    send_link_auto.href = new_send_link_auto;
    send_link_auto.title = "Tags: " + tags_string + " (Autosubmit)";
    send_link_auto.innerHTML = "Bookmark";
    if (tags_string) {
      send_link_auto.innerHTML += " (" + tags_string + ")";
    }

    let new_send_link_manual = "javascript: function bookmark() { var d=document,l=d.location; d.location='"+link_root+"/bookmarks?fill_url='+encodeURIComponent(l.href)+'&fill_title='+encodeURIComponent(d.title)+'" + send_url_tags + "'; } bookmark();";
    send_link_manual.href = new_send_link_manual;
    send_link_manual.title = "Tags: " + tags_string;
    send_link_manual.innerHTML = "Save";
    if (tags_string) {
      send_link_manual.innerHTML += " (" + tags_string + ")";
    }

    let new_view_link = "/bookmarks?" + view_url_tags;
    view_link.href = new_view_link;
    view_link.title = "Tags: " + tags_string;
    view_link.innerHTML = "View List";
    if (tags_string) {
      view_link.innerHTML += " (" + tags_string + ")";
    }
  };

  on_update();

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
              <a target="_blank" rel="noreferrer noopener" href="{{.URL}}">{{.Title}}</a>
            {{else}}
              <a target="_blank" rel="noreferrer noopener" href="{{.URL}}">{{.URL}}</a>
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

func serveGoLink(w http.ResponseWriter, r *http.Request) {
  golink := strings.TrimPrefix(r.URL.Path, "/go/")

  q := &data.NotesQuery{
    Tags: []string{"golink"},
  }

  bookmarks, err := gDb.Query(q)
  if err != nil {
    fmt.Printf("Error finding links: %s\n", err)
    http.Error(w, "Error finding links", 500)
    return
  }

  for _, bookmark := range bookmarks {
    if bookmark.Title == golink {
      log.Printf("redirecting to golink %q: %s", golink, bookmark.URL)
      http.Redirect(w, r, bookmark.URL, http.StatusFound)
      return
    }
  }

  fmt.Fprintf(w, "failed to find golink %q", golink)
}

func InitDatabase(root string) data.NotesDatabase {
  var err error
  gDb, err = data.NewTextDatabase(path.Join(root, "bookmarks.json"))
  if err != nil {
    panic(err)
  }
  return gDb
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

func RegisterHandlers(server *http.ServeMux) {
  setupTemplates()

  server.HandleFunc("/api/bookmarks/add", handleAdd)
  server.HandleFunc("/api/bookmarks/delete", handleDelete)

  server.HandleFunc("/api/v2/add", handleAdd)
  server.HandleFunc("/api/v2/delete", handleDelete)

  server.HandleFunc("/go/", serveGoLink)
  server.HandleFunc("/go", serveGoLink)
  server.HandleFunc("/bookmarks", serveList)
}

