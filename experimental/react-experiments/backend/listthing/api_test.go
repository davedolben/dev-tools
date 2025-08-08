package listthing

import (
	"database/sql"
	"os"
	"path/filepath"
	"testing"

	_ "github.com/glebarez/go-sqlite"
)

func setupTestDB(t *testing.T) (*sql.DB, string) {
	// Create a temporary directory for the test database
	tempDir, err := os.MkdirTemp("", "listthing_test_*")
	if err != nil {
		t.Fatalf("Failed to create temp directory: %v", err)
	}

	dbPath := filepath.Join(tempDir, "test.db")

	// Open the database
	db, err := sql.Open("sqlite", dbPath)
	if err != nil {
		t.Fatalf("Failed to open test database: %v", err)
	}

	// Run migrations
	if err := migrateDB(db); err != nil {
		t.Fatalf("Failed to run migrations: %v", err)
	}

	return db, tempDir
}

func cleanupTestDB(t *testing.T, db *sql.DB, tempDir string) {
	if db != nil {
		db.Close()
	}
	if tempDir != "" {
		os.RemoveAll(tempDir)
	}
}

func createTestList(t *testing.T, db *sql.DB, name string) int64 {
	result, err := db.Exec(`
		INSERT INTO lists (name, created_at, updated_at)
		VALUES (?, UNIXEPOCH(), UNIXEPOCH())
	`, name)
	if err != nil {
		t.Fatalf("Failed to create test list: %v", err)
	}

	id, err := result.LastInsertId()
	if err != nil {
		t.Fatalf("Failed to get list ID: %v", err)
	}

	return id
}

func createTestItem(t *testing.T, db *sql.DB, listID int64, name string, rank int, parentID *int64) int64 {
	var result sql.Result
	var err error

	if parentID != nil {
		result, err = db.Exec(`
			INSERT INTO list_items (list_id, name, rank, parent_id, created_at, updated_at)
			VALUES (?, ?, ?, ?, UNIXEPOCH(), UNIXEPOCH())
		`, listID, name, rank, *parentID)
	} else {
		result, err = db.Exec(`
			INSERT INTO list_items (list_id, name, rank, parent_id, created_at, updated_at)
			VALUES (?, ?, ?, NULL, UNIXEPOCH(), UNIXEPOCH())
		`, listID, name, rank)
	}

	if err != nil {
		t.Fatalf("Failed to create test item: %v", err)
	}

	id, err := result.LastInsertId()
	if err != nil {
		t.Fatalf("Failed to get item ID: %v", err)
	}

	return id
}

// ChildInfo represents a child item with its ID and rank
type ChildInfo struct {
	ID   int64
	Rank int
}

func getChildren(t *testing.T, db *sql.DB, parentID int64) []ChildInfo {
	rows, err := db.Query(`
		SELECT id, rank FROM list_items 
		WHERE parent_id = ? 
		ORDER BY rank ASC
	`, parentID)
	if err != nil {
		t.Fatalf("Failed to get children: %v", err)
	}
	defer rows.Close()

	var children []ChildInfo
	for rows.Next() {
		var child ChildInfo
		if err := rows.Scan(&child.ID, &child.Rank); err != nil {
			t.Fatalf("Failed to scan child: %v", err)
		}
		children = append(children, child)
	}

	return children
}

func TestUpdateItemChildren(t *testing.T) {
	db, tempDir := setupTestDB(t)
	defer cleanupTestDB(t, db, tempDir)

	// Create a test list
	listID := createTestList(t, db, "Test List")

	// Create a parent item
	parentID := createTestItem(t, db, listID, "Parent Item", 0, nil)

	t.Run("Add new children", func(t *testing.T) {
		// Start a transaction
		tx, err := db.Begin()
		if err != nil {
			t.Fatalf("Failed to start transaction: %v", err)
		}
		defer tx.Rollback()

		// Test adding new children (using 0 to indicate new items)
		childIDs := []int64{0, 0, 0} // Three new items

		err = updateItems(tx, listID, &parentID, childIDs)
		if err != nil {
			t.Fatalf("Failed to update item children: %v", err)
		}

		// Commit the transaction
		if err = tx.Commit(); err != nil {
			t.Fatalf("Failed to commit transaction: %v", err)
		}

		// Verify children were created
		children := getChildren(t, db, parentID)
		if len(children) != 3 {
			t.Errorf("Expected 3 children, got %d", len(children))
		}

		// Verify the children have the correct rank
		for i, child := range children {
			if child.Rank != i {
				t.Errorf("Expected child %d to have rank %d, got %d", child.ID, i, child.Rank)
			}
		}
	})

	t.Run("Remove existing children", func(t *testing.T) {
		// First, create some children
		child1 := createTestItem(t, db, listID, "Child 1", 0, &parentID)
		child2 := createTestItem(t, db, listID, "Child 2", 1, &parentID)
		child3 := createTestItem(t, db, listID, "Child 3", 2, &parentID)

		// Start a transaction
		tx, err := db.Begin()
		if err != nil {
			t.Fatalf("Failed to start transaction: %v", err)
		}
		defer tx.Rollback()

		// Test removing child2 (keep only child1 and child3)
		childIDs := []int64{child1, child3}

		err = updateItems(tx, listID, &parentID, childIDs)
		if err != nil {
			t.Fatalf("Failed to update item children: %v", err)
		}

		// Commit the transaction
		if err = tx.Commit(); err != nil {
			t.Fatalf("Failed to commit transaction: %v", err)
		}

		// Verify only child1 and child3 remain
		children := getChildren(t, db, parentID)
		if len(children) != 2 {
			t.Errorf("Expected 2 children, got %d", len(children))
		}

		// Verify child2 was orphaned
		var parentIDCheck *int64
		err = db.QueryRow("SELECT parent_id FROM list_items WHERE id = ?", child2).Scan(&parentIDCheck)
		if err != nil {
			t.Fatalf("Failed to check parent_id for child2: %v", err)
		}
		if parentIDCheck == nil || *parentIDCheck != -1 {
			t.Errorf("Expected child2 to be orphaned (parent_id = -1), got %v", parentIDCheck)
		}

		// Verify remaining children have correct ranks
		expectedRanks := []int{0, 1}
		for i, child := range children {
			if child.Rank != expectedRanks[i] {
				t.Errorf("Expected child %d to have rank %d, got %d", child.ID, expectedRanks[i], child.Rank)
			}
		}
	})

	t.Run("Reorder existing children", func(t *testing.T) {
		// Create some children
		child1 := createTestItem(t, db, listID, "Child 1", 0, &parentID)
		child2 := createTestItem(t, db, listID, "Child 2", 1, &parentID)
		child3 := createTestItem(t, db, listID, "Child 3", 2, &parentID)

		// Start a transaction
		tx, err := db.Begin()
		if err != nil {
			t.Fatalf("Failed to start transaction: %v", err)
		}
		defer tx.Rollback()

		// Test reordering: child3, child1, child2
		childIDs := []int64{child3, child1, child2}

		err = updateItems(tx, listID, &parentID, childIDs)
		if err != nil {
			t.Fatalf("Failed to update item children: %v", err)
		}

		// Commit the transaction
		if err = tx.Commit(); err != nil {
			t.Fatalf("Failed to commit transaction: %v", err)
		}

		// Verify the new order
		children := getChildren(t, db, parentID)
		if len(children) != 3 {
			t.Errorf("Expected 3 children, got %d", len(children))
		}

		// Verify the order is correct: child3, child1, child2
		expectedOrder := []int64{child3, child1, child2}
		for i, child := range children {
			if child.ID != expectedOrder[i] {
				t.Errorf("Expected child at position %d to be %d, got %d", i, expectedOrder[i], child.ID)
			}

			// Verify rank matches position
			if child.Rank != i {
				t.Errorf("Expected child %d to have rank %d, got %d", child.ID, i, child.Rank)
			}
		}
	})

	t.Run("Mixed operations: add, remove, and reorder", func(t *testing.T) {
		// Create some initial children
		child1 := createTestItem(t, db, listID, "Child 1", 0, &parentID)
		child2 := createTestItem(t, db, listID, "Child 2", 1, &parentID)

		// Start a transaction
		tx, err := db.Begin()
		if err != nil {
			t.Fatalf("Failed to start transaction: %v", err)
		}
		defer tx.Rollback()

		// Test mixed operations: remove child1, keep child2, add 2 new items
		childIDs := []int64{child2, 0, 0} // child2, new item, new item

		err = updateItems(tx, listID, &parentID, childIDs)
		if err != nil {
			t.Fatalf("Failed to update item children: %v", err)
		}

		// Commit the transaction
		if err = tx.Commit(); err != nil {
			t.Fatalf("Failed to commit transaction: %v", err)
		}

		// Verify results
		children := getChildren(t, db, parentID)
		if len(children) != 3 {
			t.Errorf("Expected 3 children, got %d", len(children))
		}

		// Verify child1 was orphaned
		var parentIDCheck *int64
		err = db.QueryRow("SELECT parent_id FROM list_items WHERE id = ?", child1).Scan(&parentIDCheck)
		if err != nil {
			t.Fatalf("Failed to check parent_id for child1: %v", err)
		}
		if parentIDCheck == nil || *parentIDCheck != -1 {
			t.Errorf("Expected child1 to be orphaned (parent_id = -1), got %v", parentIDCheck)
		}

		// Verify child2 is still there and at the correct position
		if children[0].ID != child2 {
			t.Errorf("Expected first child to be child2 (%d), got %d", child2, children[0].ID)
		}

		// Verify ranks are correct
		for i, child := range children {
			if child.Rank != i {
				t.Errorf("Expected child %d to have rank %d, got %d", child.ID, i, child.Rank)
			}
		}
	})
}

func TestUpdateListItems(t *testing.T) {
	db, tempDir := setupTestDB(t)
	defer cleanupTestDB(t, db, tempDir)

	// Create a test list
	listID := createTestList(t, db, "Test List")

	t.Run("Add new top-level items", func(t *testing.T) {
		// Start a transaction
		tx, err := db.Begin()
		if err != nil {
			t.Fatalf("Failed to start transaction: %v", err)
		}
		defer tx.Rollback()

		// Test adding new top-level items (using 0 to indicate new items)
		itemIDs := []int64{0, 0, 0} // Three new items

		err = updateItems(tx, listID, nil, itemIDs)
		if err != nil {
			t.Fatalf("Failed to update list items: %v", err)
		}

		// Commit the transaction
		if err = tx.Commit(); err != nil {
			t.Fatalf("Failed to commit transaction: %v", err)
		}

		// Verify items were created
		rows, err := db.Query(`
			SELECT id, rank FROM list_items 
			WHERE list_id = ? AND parent_id IS NULL
			ORDER BY rank ASC
		`, listID)
		if err != nil {
			t.Fatalf("Failed to get top-level items: %v", err)
		}
		defer rows.Close()

		var items []ChildInfo
		for rows.Next() {
			var item ChildInfo
			if err := rows.Scan(&item.ID, &item.Rank); err != nil {
				t.Fatalf("Failed to scan item: %v", err)
			}
			items = append(items, item)
		}

		if len(items) != 3 {
			t.Errorf("Expected 3 top-level items, got %d", len(items))
		}

		// Verify the items have the correct rank
		for i, item := range items {
			if item.Rank != i {
				t.Errorf("Expected item %d to have rank %d, got %d", item.ID, i, item.Rank)
			}
		}
	})

	t.Run("Remove existing top-level items", func(t *testing.T) {
		// First, create some top-level items
		item1 := createTestItem(t, db, listID, "Item 1", 0, nil)
		item2 := createTestItem(t, db, listID, "Item 2", 1, nil)
		item3 := createTestItem(t, db, listID, "Item 3", 2, nil)

		// Start a transaction
		tx, err := db.Begin()
		if err != nil {
			t.Fatalf("Failed to start transaction: %v", err)
		}
		defer tx.Rollback()

		// Test removing item2 (keep only item1 and item3)
		itemIDs := []int64{item1, item3}

		err = updateItems(tx, listID, nil, itemIDs)
		if err != nil {
			t.Fatalf("Failed to update list items: %v", err)
		}

		// Commit the transaction
		if err = tx.Commit(); err != nil {
			t.Fatalf("Failed to commit transaction: %v", err)
		}

		// Verify only item1 and item3 remain
		rows, err := db.Query(`
			SELECT id, rank FROM list_items 
			WHERE list_id = ? AND parent_id IS NULL
			ORDER BY rank ASC
		`, listID)
		if err != nil {
			t.Fatalf("Failed to get top-level items: %v", err)
		}
		defer rows.Close()

		var items []ChildInfo
		for rows.Next() {
			var item ChildInfo
			if err := rows.Scan(&item.ID, &item.Rank); err != nil {
				t.Fatalf("Failed to scan item: %v", err)
			}
			items = append(items, item)
		}

		if len(items) != 2 {
			t.Errorf("Expected 2 top-level items, got %d", len(items))
		}

		// Verify item2 was orphaned
		var parentIDCheck *int64
		err = db.QueryRow("SELECT parent_id FROM list_items WHERE id = ?", item2).Scan(&parentIDCheck)
		if err != nil {
			t.Fatalf("Failed to check parent_id for item2: %v", err)
		}
		if parentIDCheck == nil || *parentIDCheck != -1 {
			t.Errorf("Expected item2 to be orphaned (parent_id = -1), got %v", parentIDCheck)
		}

		// Verify remaining items have correct ranks
		expectedRanks := []int{0, 1}
		for i, item := range items {
			if item.Rank != expectedRanks[i] {
				t.Errorf("Expected item %d to have rank %d, got %d", item.ID, expectedRanks[i], item.Rank)
			}
		}
	})
}
