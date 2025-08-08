package listthing

import (
	"database/sql"

	"github.com/davedolben/dev-tools/experimental/react-experiments/sqlutil"
)

var migrations = []sqlutil.Migration{
	{
		Version: 1,
		Up: func(db *sql.DB) error {
			_, err := db.Exec(`
				CREATE TABLE IF NOT EXISTS list_items (
					id INTEGER PRIMARY KEY AUTOINCREMENT,
					list_id INTEGER NOT NULL,
					name TEXT NOT NULL,
					rank INTEGER NOT NULL,
					parent_id INTEGER,
					created_at INTEGER,
					updated_at INTEGER
				);
				CREATE TABLE IF NOT EXISTS lists (
					id INTEGER PRIMARY KEY AUTOINCREMENT,
					name TEXT NOT NULL,
					created_at INTEGER,
					updated_at INTEGER
				);`)
			return err
		},
	},
}

func migrateDB(db *sql.DB) error {
	return sqlutil.MigrateDB(db, migrations)
}
