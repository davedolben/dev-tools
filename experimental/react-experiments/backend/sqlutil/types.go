package sqlutil

import (
	"database/sql/driver"
	"encoding/json"
	"fmt"
	"time"
)

type Date time.Time

func (t *Date) Scan(value interface{}) error {
	switch v := value.(type) {
	case string:
		parsed, err := time.Parse("2006-01-02", v)
		if err != nil {
			return err
		}
		*t = Date(parsed)
	default:
		return fmt.Errorf("unsupported type: %T", value)
	}
	return nil
}

func (t *Date) Value() (driver.Value, error) {
	return (*time.Time)(t).Format("2006-01-02"), nil
}

func (t *Date) MarshalJSON() ([]byte, error) {
	// TODO: maybe we should use just the date string?
	return json.Marshal((*time.Time)(t).Format("2006-01-02"))
}

func (t *Date) UnmarshalJSON(data []byte) error {
	var s string
	if err := json.Unmarshal(data, &s); err != nil {
		return err
	}
	parsed, err := time.Parse("2006-01-02", s)
	if err != nil {
		return err
	}
	*t = Date(parsed)
	return nil
}

type TimeS time.Time

func (t *TimeS) Scan(value interface{}) error {
	switch v := value.(type) {
	case int64:
		*t = TimeS(time.Unix(v, 0))
	default:
		return fmt.Errorf("unsupported type: %T", value)
	}
	return nil
}

func (t *TimeS) Value() (driver.Value, error) {
	return (*time.Time)(t).Unix(), nil
}

func (t *TimeS) MarshalJSON() ([]byte, error) {
	return json.Marshal((time.Time)(*t))
}

func (t *TimeS) UnmarshalJSON(data []byte) error {
	return json.Unmarshal(data, (*time.Time)(t))
}
