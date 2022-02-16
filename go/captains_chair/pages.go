package main

import (
  "encoding/json"
  "fmt"
  "html/template"
  "net/http"
)

var indexTemplate = template.Must(template.New("index").Parse(`
<html>
<head>
  <title>Captain's Chair</title>
  <style type="text/css">
    .button {
      border: solid 1px black;
      padding: 10px 16px;
      margin: 5px 8px;
      cursor: pointer;
    }
    .button:hover {
      border: solid 3px black;
      padding: 8px 14px;
    }
  </style>
</head>
<body>
  <div>
    {{range .Actions}}
    <div class="button" onclick="doAction('{{.Name}}')">{{.Name}}</div>
    {{end}}
  </div>
  <script>
    function doAction(action) {
      console.log(action);
      fetch("/do?action=" + action, {
        method: "POST"
      }).then(resp => resp.json())
        .then(data => console.log(data));
    }
  </script>
</body>
</html>
`))

type pageAction struct {
  Name string
}

func serveIndex(pageActions []pageAction) http.HandlerFunc {
  return func(w http.ResponseWriter, r* http.Request) {
    data := struct {
      Actions []pageAction
    }{
      Actions: pageActions,
    }
    err := indexTemplate.Execute(w, data)
    if err != nil {
      fmt.Fprintf(w, "%s", err.Error())
    }
  }
}

func handleRunAction(conf *ConfigFile) http.HandlerFunc {
  return func(w http.ResponseWriter, r* http.Request) {
    out, err := doAction(r.FormValue("action"), conf)
    if err != nil {
      fmt.Fprintf(w, "{\"error\": \"%s\"}", err.Error())
    }
    bs, err := json.Marshal(struct {
      Output string `json:"output"`
    }{
      Output: out,
    })
    if err != nil {
      fmt.Fprintf(w, "{\"error\": \"%s\"}", err.Error())
    }
    fmt.Fprintf(w, "%s", string(bs))
  }
}

func registerHandlers(conf *ConfigFile) {
  var pageActions []pageAction
  for _, a := range conf.Actions {
    pageActions = append(pageActions, pageAction{
      Name: a.Name,
    })
  }

  http.HandleFunc("/do", handleRunAction(conf))
  http.HandleFunc("/", serveIndex(pageActions))
}

