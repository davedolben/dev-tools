package calendar

import (
	"database/sql"

	"github.com/davedolben/dev-tools/experimental/react-experiments/sqlutil"
)

var migrations = []sqlutil.Migration{
	{
		Version: 1,
		Up: func(db *sql.DB) error {
			_, err := db.Exec(`
				CREATE TABLE IF NOT EXISTS calendars (
					id INTEGER PRIMARY KEY AUTOINCREMENT,
					name TEXT NOT NULL,
					description TEXT,
					color TEXT,
					skip_weekends BOOLEAN DEFAULT FALSE,
					-- SQLite supposedly doesn't have any datetime types, so we use unix epoch timestamps
					created_at INTEGER,
					updated_at INTEGER
				);
				CREATE TABLE IF NOT EXISTS events (
					id INTEGER PRIMARY KEY AUTOINCREMENT,
					calendar_id INTEGER NOT NULL,
					title TEXT NOT NULL,
					description TEXT,
					-- This should be a date in the format YYYY-MM-DD
					start_date TEXT NOT NULL,
					length INTEGER NOT NULL,
					-- SQLite supposedly doesn't have any datetime types, so we use unix epoch timestamps
					created_at INTEGER,
					updated_at INTEGER,
					FOREIGN KEY (calendar_id) REFERENCES calendars(id)
				);`)
			return err
		},
	},
}

func migrateDB(db *sql.DB) error {
	return sqlutil.MigrateDB(db, migrations)
}
