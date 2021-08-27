package main

type DB interface {
  // Query the table/sheet/etc. registered for a given type and populate the fields in the data structure.
  // 'data' must be a pointer to a slice
  Query(data interface{}) error
}

