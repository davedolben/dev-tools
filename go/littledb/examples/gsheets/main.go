package main

import (
  "context"
  "crypto/rand"
  "encoding/base64"
  "encoding/gob"
  "encoding/json"
  "io/ioutil"
  "fmt"
  "log"
  "net/http"
  "time"

  "github.com/gorilla/mux"
  "github.com/gorilla/sessions"
  "golang.org/x/oauth2"
  "golang.org/x/oauth2/google"
  "google.golang.org/api/option"
  "google.golang.org/api/sheets/v4"

  "github.com/davedolben/dev-tools/go/littledb/backends/gsheets"
)

// Credentials which stores google ids.
type Credentials struct {
    Cid     string `json:"client_id"`
    Csecret string `json:"client_secret"`
}

type CredentialsFile struct {
  Creds Credentials `json:"web"`
}

// User is a retrieved and authentiacted user.
type User struct {
    Sub string `json:"sub"`
    Name string `json:"name"`
    GivenName string `json:"given_name"`
    FamilyName string `json:"family_name"`
    Profile string `json:"profile"`
    Picture string `json:"picture"`
    Email string `json:"email"`
    EmailVerified string `json:"email_verified"`
    Gender string `json:"gender"`
}

var cred CredentialsFile
var conf *oauth2.Config
var state string
// TODO: in a prod environment this should be randomized
var store = sessions.NewCookieStore([]byte("session_key_12345"))

func randToken() string {
	b := make([]byte, 32)
	rand.Read(b)
	return base64.StdEncoding.EncodeToString(b)
}

func init() {
  gob.Register(&oauth2.Token{})

    file, err := ioutil.ReadFile("./credentials.json")
    if err != nil {
        log.Fatalf("File error: %v\n", err)
    }
    json.Unmarshal(file, &cred)

    if cred.Creds.Cid == "" || cred.Creds.Csecret == "" {
      panic("bad credentials")
    }

    conf = &oauth2.Config{
        ClientID:     cred.Creds.Cid,
        ClientSecret: cred.Creds.Csecret,
        RedirectURL:  "http://localhost:8000/auth",
        Scopes: []string{
            "https://www.googleapis.com/auth/spreadsheets",
        },
        Endpoint: google.Endpoint,
    }
}

func indexHandler(w http.ResponseWriter, r *http.Request) {
  fmt.Fprintf(w, `<a href="/login">Login</a> <br/> <a href="/sheets">Sheets</a>`)
}

type TimeWindow struct {
  What string `littledb:"What"`
  Date time.Time `littledb:"Date"`
  In time.Time `littledb:"In"`
  Out time.Time `littledb:"Out"`
}

func sheetsHandler(w http.ResponseWriter, r *http.Request) {
  sheetId := r.FormValue("sheet")

  session, _ := store.Get(r, "gsheets-demo")
  tokenGob := session.Values["oauth2_token"]
  log.Printf("%v", tokenGob)
  tok, ok := tokenGob.(*oauth2.Token)
  if !ok {
    fmt.Fprintf(w, "error unmarshaling token")
    return
  }

  ctx := context.Background()
  client := conf.Client(ctx, tok)
  srv, err := sheets.NewService(ctx, option.WithHTTPClient(client))
  if err != nil {
    fmt.Fprintf(w, "error creating service: %s", err.Error())
    return
  }

  db, err := gsheets.NewSheetsDB(srv, sheetId)
  if err != nil {
    fmt.Fprintf(w, "error building client: %s", err.Error())
    return
  }

  db.Register(TimeWindow{}, "Time Sheet!A1:E100")

  rows := []TimeWindow{}
  if err := db.Query(&rows); err != nil {
    fmt.Fprintf(w, "error querying spreadsheet: %s", err.Error())
    return
  }

  for _, row := range rows {
    log.Printf("%+v", row)
  }

  fmt.Fprintf(w, `Tried to do it!`)
}

func getLoginURL(state string) string {
    return conf.AuthCodeURL(state)
}

func authHandler(w http.ResponseWriter, r *http.Request) {
    // Handle the exchange code to initiate a transport.
    qState := r.FormValue("state")
    if qState != "state" {
      panic("bad state: " + qState)
    }

	tok, err := conf.Exchange(oauth2.NoContext, r.FormValue("code"))
	if err != nil {
    fmt.Fprintf(w, "failed to exchange token: %s", err.Error())
        return
	}

  session, _ := store.Get(r, "gsheets-demo")
  session.Values["oauth2_token"] = tok
  if err := session.Save(r, w); err != nil {
    fmt.Fprintf(w, "error saving session: %s", err.Error())
    return
  }

  log.Printf("%+v\n", tok)
  http.Redirect(w, r, "/", http.StatusFound)
}

func loginHandler(w http.ResponseWriter, r *http.Request) {
    state = "state"
    redir := getLoginURL(state)
    log.Printf("%s\n", redir)
    fmt.Fprintf(w, "%s", `<html><title>Golang Google</title> <body> <a href="` + redir + `">Login with Google!</a> </body></html>`)
}

func main() {
    router := mux.NewRouter()
    //router.Use(sessions.Sessions("goquestsession", store))
    //router.Static("/css", "./static/css")
    //router.Static("/img", "./static/img")
    //router.LoadHTMLGlob("templates/*")

    router.HandleFunc("/login", loginHandler)
    router.HandleFunc("/auth", authHandler)
    router.HandleFunc("/sheets", sheetsHandler)
    router.HandleFunc("/", indexHandler)

    http.Handle("/", router)
    host := ":8000"
    log.Printf("serving on %s", host)
    http.ListenAndServe(":8000", nil)
}

