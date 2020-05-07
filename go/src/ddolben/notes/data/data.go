package data

import (
  "encoding/json"
  "fmt"
  "io/ioutil"
  "os"
  "time"
)

type Note struct {
  Created time.Time `json:"created"`
  ID int64 `json:"id"`
  Title string `json:"title"`
  Body string `json:"body"`
  URL string `json:"url"`
  Tags []string `json:"tags"`
}

type NotesQuery struct {
  Tags []string
}

type NotesDatabase interface {
  Add(note *Note) error
  Delete(id int64) error
  Query(query *NotesQuery) ([]Note, error)
  Flush() error
}

type TextNotesDatabase struct {
  filename string
  notes []Note
  trash []Note
  nextId int64
}

type NotesDB struct {
  Notes []Note `json:"notes"`
  Trash []Note `json:"trash"`
}

func initIds(db *TextNotesDatabase) {
  // For now, just blanket adjust IDs to be sequential, because it's easy and guaranteed to be de-duped.
  for i := range db.notes {
    db.notes[i].ID = int64(i+1)
  }
  db.nextId = int64(len(db.notes)+1)
}

func fixMissingData(db *TextNotesDatabase) {
  now := time.Now()
  for i := range db.notes {
    if db.notes[i].Created.IsZero() {
      db.notes[i].Created = now
    }
  }
}

func NewTextDatabase(filename string) (NotesDatabase, error) {
  f, err := os.Open(filename)
  if err != nil && !os.IsNotExist(err) {
    return nil, err
  }

  db := &TextNotesDatabase{
    filename: filename,
  }

  if err == nil {
    defer f.Close()
    bytes, readErr := ioutil.ReadAll(f)
    if readErr != nil {
      return nil, readErr
    }
    var data NotesDB
    if parseErr := json.Unmarshal(bytes, &data); parseErr != nil {
      return nil, parseErr
    }
    db.notes = data.Notes
    db.trash = data.Trash
  }

  fixMissingData(db)
  initIds(db)

  return db, nil
}

func (db *TextNotesDatabase) Add(note *Note) error {
  db.notes = append(db.notes, Note{
    ID: db.nextId,
    Title: note.Title,
    Body: note.Body,
    URL: note.URL,
    Tags: note.Tags,
    Created: time.Now(),
  })
  db.nextId++
  return nil
}

func (db *TextNotesDatabase) Delete(id int64) error {
  for i, note := range db.notes {
    if note.ID == id {
      db.trash = append(db.trash, note)
      db.notes = append(db.notes[:i], db.notes[i+1:]...)
      return nil
    }
  }
  return fmt.Errorf("id not found")
}

func filterForTags(notes []Note, tags []string) []Note {
  resetTags := func(set *map[string]struct{}, tags []string) {
    for _, tag := range tags {
      (*set)[tag] = struct{}{}
    }
  }

  wantTags := make(map[string]struct{})
  resetTags(&wantTags, tags)

  var out []Note
  for _, note := range notes {
    for _, tag := range note.Tags {
      delete(wantTags, tag)
    }
    if len(wantTags) == 0 {
      out = append(out, note)
    }
    resetTags(&wantTags, tags)
  }
  return out
}

func (db *TextNotesDatabase) Query(query *NotesQuery) ([]Note, error) {
  if query == nil {
    return db.notes, nil
  }

  notes := db.notes

  if len(query.Tags) > 0 {
    notes = filterForTags(notes, query.Tags)
  }

  return notes, nil
}

func (db *TextNotesDatabase) Flush() error {
  data := NotesDB{
    Notes: db.notes,
    Trash: db.trash,
  }
  bs, err := json.Marshal(&data)
  if err != nil {
    return err
  }
  if err := ioutil.WriteFile(db.filename, bs, 0644); err != nil {
    return err
  }
  return nil
}
