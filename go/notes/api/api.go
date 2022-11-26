package api

import (
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"path/filepath"
	"strconv"

	"github.com/davedolben/dev-tools/go/notes/data"

	"github.com/go-chi/chi/v5"
	"github.com/go-chi/chi/v5/middleware"
)

var gDb data.NotesDatabase
var gBlobStore data.BlobStore

func InitDatabase(root string) {
  var err error
  gDb, err = data.NewTextDatabase(filepath.Join(root, "bookmarks.json"))
  if err != nil {
    panic(err)
  }
}

func InitKVStore(root string) {
  var err error
  gBlobStore, err = data.NewFileBlobStore(filepath.Join(root, "blobs.json"))
  if err != nil {
    panic(err)
  }
}

func UseDatabase(db data.NotesDatabase) {
	gDb = db
}

// TODO: use chi stuff
func queryFromValues(values url.Values) *data.NotesQuery {
  q := &data.NotesQuery{}
  if len(values["tag"]) > 0 {
    q.Tags = values["tag"]
  }
  return q
}

func getBookmarks(w http.ResponseWriter, r *http.Request) {
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
    Bookmarks []data.Note `json:"bookmarks"`
  }{
    Bookmarks: sortedNotes,
  }

  bs, err := json.Marshal(&data)
	if err != nil {
    fmt.Printf("Error serving list: %s\n", err)
    http.Error(w, "Error serving list", 500)
		return
  }

	fmt.Fprintf(w, "%s", string(bs))
}

func handleAdd(w http.ResponseWriter, r *http.Request) {
  bs, err := io.ReadAll(r.Body)
  if err != nil {
    http.Error(w, err.Error(), 500)
    return
  }

  note := struct {
    Item *data.Note `json:"item"`
  }{
    Item: &data.Note{},
  }
  if err := json.Unmarshal(bs, &note); err != nil {
    http.Error(w, err.Error(), 500)
    return
  }

  if err := gDb.Add(note.Item); err != nil {
    http.Error(w, err.Error(), 500)
    return
  }

  if err := gDb.Flush(); err != nil {
    http.Error(w, err.Error(), 500)
    return
  }

  fmt.Fprintf(w, "{}")
}

func handleUpdate(w http.ResponseWriter, r *http.Request) {
  itemId, err := strconv.ParseInt(chi.URLParam(r, "id"), 10, 64)
  if err != nil {
    http.Error(w, err.Error(), 500)
    return
  }

  bs, err := io.ReadAll(r.Body)
  if err != nil {
    http.Error(w, err.Error(), 500)
    return
  }

  note := struct {
    Item *data.Note `json:"item"`
  }{
    Item: &data.Note{},
  }
  if err := json.Unmarshal(bs, &note); err != nil {
    http.Error(w, err.Error(), 500)
    return
  }

  // Just in case
  note.Item.ID = itemId

  if err := gDb.Update(itemId, note.Item); err != nil {
    http.Error(w, err.Error(), 500)
    return
  }

  if err := gDb.Flush(); err != nil {
    http.Error(w, err.Error(), 500)
    return
  }

  fmt.Fprintf(w, "{}")
}

func handleDelete(w http.ResponseWriter, r *http.Request) {
  itemId, err := strconv.ParseInt(chi.URLParam(r, "id"), 10, 64)
  if err != nil {
    http.Error(w, err.Error(), 500)
    return
  }

  if err := gDb.Delete(itemId); err != nil {
    http.Error(w, err.Error(), 500)
    return
  }

  if err := gDb.Flush(); err != nil {
    http.Error(w, err.Error(), 500)
    return
  }

  fmt.Fprintf(w, "{}")
}

func handleGetBlob(w http.ResponseWriter, r *http.Request) {
  id := chi.URLParam(r, "id")
  data, err := gBlobStore.Get(id)
  if err != nil {
    http.Error(w, err.Error(), 500)
    return
  }
  fmt.Fprintf(w, "%s", data)
}

func handleSetBlob(w http.ResponseWriter, r *http.Request) {
  id := chi.URLParam(r, "id")

  data, err := io.ReadAll(r.Body)
  if err != nil {
    http.Error(w, err.Error(), 500)
    return
  }

  if err := gBlobStore.Set(id, string(data)); err != nil {
    http.Error(w, err.Error(), 500)
    return
  }

  fmt.Fprintf(w, "{ \"success\": true }")
}

func RegisterHandlers(s *http.ServeMux) {
	r := chi.NewRouter()
	r.Use(middleware.Logger)

	r.Get("/bookmarks/", getBookmarks)
	r.Put("/bookmarks/", handleAdd)
	r.Post("/bookmarks/{id}", handleUpdate)
	r.Delete("/bookmarks/{id}", handleDelete)

	r.Get("/kv/{id}", handleGetBlob)
	r.Post("/kv/{id}", handleSetBlob)

	r.Get("/", func(w http.ResponseWriter, r *http.Request) {
		fmt.Fprintf(w, "{}")
	})
	s.Handle("/", r)
}
