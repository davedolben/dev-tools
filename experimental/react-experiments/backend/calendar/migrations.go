package calendar

import (
	"database/sql"
	"fmt"
	"log"
)

type Migration struct {
	Version int
	Up      func(db *sql.DB) error
	// TODO: Down
}

var migrations = []Migration{
	{
		Version: 1,
		Up: func(db *sql.DB) error {
			_, err := db.Exec(`
				CREATE TABLE IF NOT EXISTS calendars (
					id INTEGER PRIMARY KEY AUTOINCREMENT,
					name TEXT NOT NULL,
					description TEXT,
					color TEXT,
					created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
					updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
				);
				CREATE TABLE IF NOT EXISTS events (
					id INTEGER PRIMARY KEY AUTOINCREMENT,
					calendar_id INTEGER NOT NULL,
					title TEXT NOT NULL,
					description TEXT,
					start_time DATETIME NOT NULL,
					length INTEGER NOT NULL,
					created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
					updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
					FOREIGN KEY (calendar_id) REFERENCES calendars(id)
				);`)
			return err
		},
	},
	{
		Version: 2,
		Up: func(db *sql.DB) error {
			// Check if color column exists in calendars table, if not add it
			_, err := db.Exec(`SELECT color FROM calendars LIMIT 1`)

			if err != nil {
				log.Println("Adding color column to calendars table")
				// Column doesn't exist, add it
				_, err = db.Exec(`ALTER TABLE calendars ADD COLUMN color TEXT`)
				if err != nil {
					return fmt.Errorf("error adding color column: %v", err)
				}
			}
			return nil
		},
	},
}

func InitDB(dbPath string) error {
	var err error
	db, err = sql.Open("sqlite", dbPath)
	if err != nil {
		return fmt.Errorf("error opening database: %v", err)
	}

	return MigrateDB(db)
}

func MigrateDB(db *sql.DB) error {
	// Add a migrations table
	_, err := db.Exec(`
		CREATE TABLE IF NOT EXISTS migrations (
			version INTEGER PRIMARY KEY NOT NULL,
			applied_at INTEGER DEFAULT UNIXEPOCH
		)`)
	if err != nil {
		return fmt.Errorf("error creating migrations table: %v", err)
	}

	// Get the highest applied migration version
	var highestAppliedVersion *int
	err = db.QueryRow(`SELECT MAX(version) FROM migrations`).Scan(&highestAppliedVersion)
	if err != nil {
		return fmt.Errorf("error getting highest applied migration version: %v", err)
	}
	if highestAppliedVersion == nil {
		highestAppliedVersion = new(int)
		*highestAppliedVersion = 0
	}

	log.Printf("Highest applied migration version: %d", *highestAppliedVersion)

	for _, migration := range migrations {
		// Check if migration has already been run
		if migration.Version <= *highestAppliedVersion {
			continue
		}

		err = migration.Up(db)
		if err != nil {
			return fmt.Errorf("error running migration %d: %v", migration.Version, err)
		}

		// Update the highest applied migration version
		_, err = db.Exec(`INSERT INTO migrations (version) VALUES (?)`, migration.Version)
		if err != nil {
			return fmt.Errorf("error updating highest applied migration version: %v", err)
		}

		log.Printf("Applied migration %d", migration.Version)
	}

	return nil
}
