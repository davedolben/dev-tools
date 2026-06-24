package main

import (
	"bufio"
	"database/sql"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"time"

	_ "modernc.org/sqlite"
)

const (
	dbFileName    = "annotations.db"
	schemaVersion = 1
)

type Annotation struct {
	Filename    string
	Name        string
	Description string
	UpdatedAt   time.Time
}

type App struct {
	db     *sql.DB
	dbPath string
	dbDir  string
}

func main() {
	if len(os.Args) < 2 {
		printUsage()
		os.Exit(1)
	}

	command := os.Args[1]

	switch command {
	case "lookup":
		if len(os.Args) != 3 {
			fmt.Fprintf(os.Stderr, "Usage: %s lookup <filename>\n", os.Args[0])
			os.Exit(1)
		}
		if err := runLookup(os.Args[2]); err != nil {
			fmt.Fprintf(os.Stderr, "Error: %v\n", err)
			os.Exit(1)
		}
	case "upsert":
		if len(os.Args) != 4 {
			fmt.Fprintf(os.Stderr, "Usage: %s upsert <filename> <name>\n", os.Args[0])
			os.Exit(1)
		}
		if err := runUpsert(os.Args[2], os.Args[3]); err != nil {
			fmt.Fprintf(os.Stderr, "Error: %v\n", err)
			os.Exit(1)
		}
	case "move":
		if len(os.Args) != 4 {
			fmt.Fprintf(os.Stderr, "Usage: %s move <old-filename> <new-filename>\n", os.Args[0])
			os.Exit(1)
		}
		if err := runMove(os.Args[2], os.Args[3]); err != nil {
			fmt.Fprintf(os.Stderr, "Error: %v\n", err)
			os.Exit(1)
		}
	case "cleanup":
		if len(os.Args) != 2 {
			fmt.Fprintf(os.Stderr, "Usage: %s cleanup\n", os.Args[0])
			os.Exit(1)
		}
		if err := runCleanup(); err != nil {
			fmt.Fprintf(os.Stderr, "Error: %v\n", err)
			os.Exit(1)
		}
	case "list":
		if len(os.Args) != 2 {
			fmt.Fprintf(os.Stderr, "Usage: %s list\n", os.Args[0])
			os.Exit(1)
		}
		if err := runList(); err != nil {
			fmt.Fprintf(os.Stderr, "Error: %v\n", err)
			os.Exit(1)
		}
	default:
		fmt.Fprintf(os.Stderr, "Unknown command: %s\n", command)
		printUsage()
		os.Exit(1)
	}
}

func printUsage() {
	fmt.Fprintf(os.Stderr, "Usage: %s <command> [args]\n", os.Args[0])
	fmt.Fprintln(os.Stderr, "\nCommands:")
	fmt.Fprintln(os.Stderr, "  lookup <filename>              Look up metadata for a file")
	fmt.Fprintln(os.Stderr, "  upsert <filename> <name>       Add or update metadata for a file")
	fmt.Fprintln(os.Stderr, "  move <old-file> <new-file>     Move metadata from old filename to new filename")
	fmt.Fprintln(os.Stderr, "  cleanup                        Remove metadata for files that no longer exist")
	fmt.Fprintln(os.Stderr, "  list                           List all annotated files")
}

func findDatabaseDir() (string, error) {
	currentDir, err := os.Getwd()
	if err != nil {
		return "", fmt.Errorf("failed to get current directory: %w", err)
	}

	dir := currentDir
	for {
		dbPath := filepath.Join(dir, dbFileName)
		if _, err := os.Stat(dbPath); err == nil {
			return dir, nil
		}

		parent := filepath.Dir(dir)
		if parent == dir {
			return currentDir, nil
		}
		dir = parent
	}
}

func openDatabase(createIfNotExist bool) (*App, error) {
	dbDir, err := findDatabaseDir()
	if err != nil {
		return nil, err
	}

	dbPath := filepath.Join(dbDir, dbFileName)

	if !createIfNotExist {
		if _, err := os.Stat(dbPath); os.IsNotExist(err) {
			return nil, fmt.Errorf("database not found (searched up from current directory)")
		}
	}

	db, err := sql.Open("sqlite", dbPath)
	if err != nil {
		return nil, fmt.Errorf("failed to open database: %w", err)
	}

	app := &App{
		db:     db,
		dbPath: dbPath,
		dbDir:  dbDir,
	}

	if err := app.initSchema(); err != nil {
		db.Close()
		return nil, err
	}

	return app, nil
}

func (app *App) initSchema() error {
	_, err := app.db.Exec(`
		CREATE TABLE IF NOT EXISTS schema_version (
			version INTEGER PRIMARY KEY
		)
	`)
	if err != nil {
		return fmt.Errorf("failed to create schema_version table: %w", err)
	}

	var currentVersion int
	err = app.db.QueryRow("SELECT version FROM schema_version LIMIT 1").Scan(&currentVersion)
	if err != nil && err != sql.ErrNoRows {
		return fmt.Errorf("failed to query schema version: %w", err)
	}

	if currentVersion == 0 {
		if err := app.createInitialSchema(); err != nil {
			return err
		}

		_, err = app.db.Exec("INSERT INTO schema_version (version) VALUES (?)", schemaVersion)
		if err != nil {
			return fmt.Errorf("failed to insert schema version: %w", err)
		}
	}

	return nil
}

func (app *App) createInitialSchema() error {
	_, err := app.db.Exec(`
		CREATE TABLE IF NOT EXISTS annotations (
			filename TEXT PRIMARY KEY,
			name TEXT NOT NULL,
			description TEXT NOT NULL,
			updated_at DATETIME NOT NULL
		)
	`)
	if err != nil {
		return fmt.Errorf("failed to create annotations table: %w", err)
	}

	return nil
}

func (app *App) Close() error {
	return app.db.Close()
}

func (app *App) getRelativePath(filename string) (string, error) {
	absPath, err := filepath.Abs(filename)
	if err != nil {
		return "", fmt.Errorf("failed to get absolute path: %w", err)
	}

	relPath, err := filepath.Rel(app.dbDir, absPath)
	if err != nil {
		return "", fmt.Errorf("failed to get relative path: %w", err)
	}

	return relPath, nil
}

func (app *App) getAbsolutePath(relPath string) string {
	return filepath.Join(app.dbDir, relPath)
}

func runLookup(filename string) error {
	app, err := openDatabase(false)
	if err != nil {
		return err
	}
	defer app.Close()

	relPath, err := app.getRelativePath(filename)
	if err != nil {
		return err
	}

	var annotation Annotation
	err = app.db.QueryRow(
		"SELECT filename, name, description, updated_at FROM annotations WHERE filename = ?",
		relPath,
	).Scan(&annotation.Filename, &annotation.Name, &annotation.Description, &annotation.UpdatedAt)

	if err == sql.ErrNoRows {
		return fmt.Errorf("no annotation found for file: %s", filename)
	}
	if err != nil {
		return fmt.Errorf("failed to query annotation: %w", err)
	}

	fmt.Printf("Name: %s\n", annotation.Name)
	fmt.Printf("Description: %s\n", annotation.Description)
	fmt.Printf("Last Updated: %s\n", annotation.UpdatedAt.Format("2006-01-02 15:04:05"))

	return nil
}

func runUpsert(filename, name string) error {
	if _, err := os.Stat(filename); os.IsNotExist(err) {
		return fmt.Errorf("file does not exist: %s", filename)
	}

	app, err := openDatabase(true)
	if err != nil {
		return err
	}
	defer app.Close()

	relPath, err := app.getRelativePath(filename)
	if err != nil {
		return err
	}

	var existingDesc string
	err = app.db.QueryRow(
		"SELECT description FROM annotations WHERE filename = ?",
		relPath,
	).Scan(&existingDesc)
	if err != nil && err != sql.ErrNoRows {
		return fmt.Errorf("failed to query existing annotation: %w", err)
	}

	description, err := promptForDescription(filename, existingDesc)
	if err != nil {
		return err
	}

	_, err = app.db.Exec(`
		INSERT INTO annotations (filename, name, description, updated_at)
		VALUES (?, ?, ?, ?)
		ON CONFLICT(filename) DO UPDATE SET
			name = excluded.name,
			description = excluded.description,
			updated_at = excluded.updated_at
	`, relPath, name, description, time.Now())

	if err != nil {
		return fmt.Errorf("failed to upsert annotation: %w", err)
	}

	fmt.Printf("Successfully updated annotation for: %s\n", filename)
	return nil
}

func promptForDescription(filename, existingDesc string) (string, error) {
	tmpFile, err := os.CreateTemp("", "annotation-*.txt")
	if err != nil {
		return "", fmt.Errorf("failed to create temp file: %w", err)
	}
	tmpPath := tmpFile.Name()
	defer os.Remove(tmpPath)

	header := fmt.Sprintf("# Add description for: %s\n", filename)
	header += "# Lines starting with '#' will be ignored\n"
	header += "#\n"

	if existingDesc != "" {
		header += existingDesc
	}

	if _, err := tmpFile.WriteString(header); err != nil {
		tmpFile.Close()
		return "", fmt.Errorf("failed to write to temp file: %w", err)
	}
	tmpFile.Close()

	editor := os.Getenv("EDITOR")
	if editor == "" {
		editor = "vim"
	}

	cmd := exec.Command(editor, tmpPath)
	cmd.Stdin = os.Stdin
	cmd.Stdout = os.Stdout
	cmd.Stderr = os.Stderr

	if err := cmd.Run(); err != nil {
		return "", fmt.Errorf("failed to run editor: %w", err)
	}

	content, err := os.ReadFile(tmpPath)
	if err != nil {
		return "", fmt.Errorf("failed to read temp file: %w", err)
	}

	lines := strings.Split(string(content), "\n")
	var descLines []string
	for _, line := range lines {
		trimmed := strings.TrimSpace(line)
		if !strings.HasPrefix(trimmed, "#") {
			descLines = append(descLines, line)
		}
	}

	description := strings.TrimSpace(strings.Join(descLines, "\n"))
	if description == "" {
		return "", fmt.Errorf("description cannot be empty")
	}

	return description, nil
}

func runMove(oldFilename, newFilename string) error {
	app, err := openDatabase(false)
	if err != nil {
		return err
	}
	defer app.Close()

	oldRelPath, err := app.getRelativePath(oldFilename)
	if err != nil {
		return err
	}

	newRelPath, err := app.getRelativePath(newFilename)
	if err != nil {
		return err
	}

	var exists bool
	err = app.db.QueryRow("SELECT EXISTS(SELECT 1 FROM annotations WHERE filename = ?)", oldRelPath).Scan(&exists)
	if err != nil {
		return fmt.Errorf("failed to check if old file exists: %w", err)
	}
	if !exists {
		return fmt.Errorf("no annotation found for old file: %s", oldFilename)
	}

	err = app.db.QueryRow("SELECT EXISTS(SELECT 1 FROM annotations WHERE filename = ?)", newRelPath).Scan(&exists)
	if err != nil {
		return fmt.Errorf("failed to check if new file exists: %w", err)
	}
	if exists {
		return fmt.Errorf("annotation already exists for new file: %s", newFilename)
	}

	_, err = app.db.Exec("UPDATE annotations SET filename = ? WHERE filename = ?", newRelPath, oldRelPath)
	if err != nil {
		return fmt.Errorf("failed to move annotation: %w", err)
	}

	fmt.Printf("Successfully moved annotation from %s to %s\n", oldFilename, newFilename)
	return nil
}

func runCleanup() error {
	app, err := openDatabase(false)
	if err != nil {
		return err
	}
	defer app.Close()

	rows, err := app.db.Query("SELECT filename FROM annotations")
	if err != nil {
		return fmt.Errorf("failed to query annotations: %w", err)
	}
	defer rows.Close()

	var orphaned []string
	for rows.Next() {
		var filename string
		if err := rows.Scan(&filename); err != nil {
			return fmt.Errorf("failed to scan filename: %w", err)
		}

		absPath := app.getAbsolutePath(filename)
		if _, err := os.Stat(absPath); os.IsNotExist(err) {
			orphaned = append(orphaned, filename)
		}
	}

	if err := rows.Err(); err != nil {
		return fmt.Errorf("error iterating rows: %w", err)
	}

	if len(orphaned) == 0 {
		fmt.Println("No orphaned annotations found.")
		return nil
	}

	fmt.Printf("Found %d orphaned annotation(s):\n", len(orphaned))
	for _, filename := range orphaned {
		fmt.Printf("  - %s\n", filename)
	}

	fmt.Print("\nDelete all orphaned annotations? (y/N): ")
	reader := bufio.NewReader(os.Stdin)
	response, err := reader.ReadString('\n')
	if err != nil {
		return fmt.Errorf("failed to read response: %w", err)
	}

	response = strings.TrimSpace(strings.ToLower(response))
	if response != "y" && response != "yes" {
		fmt.Println("Cleanup cancelled.")
		return nil
	}

	for _, filename := range orphaned {
		_, err := app.db.Exec("DELETE FROM annotations WHERE filename = ?", filename)
		if err != nil {
			return fmt.Errorf("failed to delete annotation for %s: %w", filename, err)
		}
	}

	fmt.Printf("Successfully deleted %d orphaned annotation(s).\n", len(orphaned))
	return nil
}

func runList() error {
	app, err := openDatabase(false)
	if err != nil {
		return err
	}
	defer app.Close()

	rows, err := app.db.Query("SELECT filename, name, description, updated_at FROM annotations ORDER BY filename")
	if err != nil {
		return fmt.Errorf("failed to query annotations: %w", err)
	}
	defer rows.Close()

	count := 0
	for rows.Next() {
		var annotation Annotation
		if err := rows.Scan(&annotation.Filename, &annotation.Name, &annotation.Description, &annotation.UpdatedAt); err != nil {
			return fmt.Errorf("failed to scan annotation: %w", err)
		}

		if count > 0 {
			fmt.Println()
		}
		fmt.Printf("File: %s\n", annotation.Filename)
		fmt.Printf("Name: %s\n", annotation.Name)
		fmt.Printf("Description: %s\n", annotation.Description)
		fmt.Printf("Last Updated: %s\n", annotation.UpdatedAt.Format("2006-01-02 15:04:05"))
		count++
	}

	if err := rows.Err(); err != nil {
		return fmt.Errorf("error iterating rows: %w", err)
	}

	if count == 0 {
		fmt.Println("No annotations found.")
	}

	return nil
}
