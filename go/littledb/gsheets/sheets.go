package main

import (
  "errors"
  "fmt"
  "log"
  "reflect"
  "time"

  "google.golang.org/api/sheets/v4"
)

type SheetsDB struct {
  srv *sheets.Service
  // TODO: move to query
  sheetId string
  ranges map[reflect.Type]string
}

type sheetColumn struct {
  Name string
  FieldIndex int
  ColIndex int
}

func (db *SheetsDB) Register(t interface{}, dataRange string) *SheetsDB {
  db.ranges[reflect.ValueOf(t).Type()] = dataRange
  return db
}

func (db *SheetsDB) Query(data interface{}) error {
  vPtr := reflect.ValueOf(data)
  if vPtr.Kind() != reflect.Ptr {
    return errors.New("not a pointer")
  }

  vContainer := vPtr.Elem()
  if vContainer.Kind() != reflect.Slice {
    return errors.New("not a slice")
  }

  tElem := vContainer.Type().Elem()

  cols := []sheetColumn{}

  log.Printf("%+v", tElem)
  for i := 0; i < tElem.NumField(); i++ {
    f := tElem.Field(i)
    log.Printf("%+v", f)
    name, ok := f.Tag.Lookup("littledb")
    if !ok || name == "-" {
      continue
    }
    cols = append(cols, sheetColumn{
      Name: name,
      FieldIndex: i,
      ColIndex: -1,
    })
  }

  dataRange, ok := db.ranges[tElem]
  if !ok {
    return fmt.Errorf("no spreadsheet range registered for type: %+v", tElem)
  }
  rsp, err := db.srv.Spreadsheets.Values.Get(db.sheetId, dataRange).Do()
  if err != nil {
    return err
  }

  headers := rsp.Values[0]
  for i, h := range headers {
    for j := range cols {
      if cols[j].Name == h {
        cols[j].ColIndex = i
      }
    }
  }

  log.Printf("%+v", cols)

  containerLen := len(rsp.Values) - 1
  vContainer.Set(reflect.MakeSlice(vContainer.Type(), containerLen, containerLen))
  for i, row := range rsp.Values[1:] {
    vRow := vContainer.Index(i)
    for _, col := range cols {
      vField := vRow.Field(col.FieldIndex)

      // Special case handling for date strings
      vRowData := reflect.ValueOf(row[col.ColIndex])
      if vField.Type() == reflect.ValueOf(time.Time{}).Type() && vRowData.Kind() == reflect.String {
        timestamp, err := stringToTime(vRowData.String())
        if err != nil {
          return err
        }
        vField.Set(reflect.ValueOf(timestamp))
        continue
      }

      if vField.Type() != vRowData.Type() {
        log.Fatalf("type mismatch %+v != %+v", vField.Type(), reflect.ValueOf(row[col.ColIndex]).Type())
      }
      vField.Set(reflect.ValueOf(row[col.ColIndex]))
    }
  }

  return nil
}

func NewSheetsDB(srv *sheets.Service, sheetId string) (*SheetsDB, error) {
  return &SheetsDB{
    srv: srv,
    sheetId: sheetId,
    ranges: make(map[reflect.Type]string),
  }, nil
}

