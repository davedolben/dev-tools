package sqlutil

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

func MigrateDB(db *sql.DB, migrations []Migration) error {
	// Add a migrations table
	_, err := db.Exec(`
		CREATE TABLE IF NOT EXISTS migrations (
			version INTEGER PRIMARY KEY NOT NULL,
			applied_at INTEGER
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
		_, err = db.Exec(`INSERT INTO migrations (version, applied_at) VALUES (?, UNIXEPOCH())`, migration.Version)
		if err != nil {
			return fmt.Errorf("error updating highest applied migration version: %v", err)
		}

		log.Printf("Applied migration %d", migration.Version)
	}

	return nil
}
