package littledb

type QueryClauses struct {
  // TODO: clause tree goes here
}

type Executor interface {
  Query(*QueryClauses) error
}

type PartialQuery struct {
  Ex Executor
  Clauses *QueryClauses
}

func (pq *PartialQuery) Do() error {
  return pq.Ex.Query(pq.Clauses)
}

type DB interface {
  // Query the table/sheet/etc. registered for a given type and populate the fields in the data structure.
  // 'data' must be a pointer to a slice
  Query(data interface{}) *PartialQuery
}

