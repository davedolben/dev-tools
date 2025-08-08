package listthing

import (
	"database/sql"
	"fmt"
	"log"
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"
)

type ListItem struct {
	ID       int64      `json:"id"`
	Name     string     `json:"name"`
	Children []ListItem `json:"children"`
}

type List struct {
	ID    int64      `json:"id"`
	Name  string     `json:"name"`
	Items []ListItem `json:"items"`
}

var db *sql.DB

func InitDB(dbPath string) error {
	var err error
	db, err = sql.Open("sqlite", dbPath)
	if err != nil {
		return fmt.Errorf("error opening database: %v", err)
	}

	return migrateDB(db)
}

func SetupRoutes(r *gin.Engine, dbPath string) {
	// Initialize database
	if err := InitDB(dbPath); err != nil {
		log.Fatalf("Failed to initialize database: %v", err)
	}

	listGroup := r.Group("/api/lists")
	{
		listGroup.POST("/list", CreateList)
		listGroup.GET("/list/:id", GetList)
		listGroup.PUT("/list/:id", UpdateList)
		listGroup.PUT("/item/:id", UpdateListItem)
	}
}

func CreateList(c *gin.Context) {
	var request struct {
		Name string `json:"name" binding:"required"`
	}

	if err := c.ShouldBindJSON(&request); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request body: " + err.Error()})
		return
	}

	result, err := db.Exec(`
		INSERT INTO lists (name, created_at, updated_at)
		VALUES (?, UNIXEPOCH(), UNIXEPOCH())
	`, request.Name)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create list: " + err.Error()})
		return
	}

	id, err := result.LastInsertId()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to get list ID"})
		return
	}

	list := List{
		ID:    id,
		Name:  request.Name,
		Items: []ListItem{},
	}

	c.JSON(http.StatusCreated, list)
}

func GetList(c *gin.Context) {
	id := c.Param("id")

	rows, err := db.Query(`
		SELECT
			id,
			name
		FROM list_items
		WHERE list_id = ? AND parent_id IS NULL
		ORDER BY rank ASC`,
		id)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	var list List
	for rows.Next() {
		var item ListItem
		err = rows.Scan(&item.ID, &item.Name)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		list.Items = append(list.Items, item)
	}

	c.JSON(http.StatusOK, list)
}

func UpdateList(c *gin.Context) {
	listID := c.Param("id")
	var request struct {
		Name  string  `json:"name" binding:"required"`
		Items []int64 `json:"items"`
	}

	if err := c.ShouldBindJSON(&request); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request body: " + err.Error()})
		return
	}

	// Parse the ID for the response
	id, err := strconv.ParseInt(listID, 10, 64)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Invalid list ID"})
		return
	}

	// Verify list exists
	var exists bool
	err = db.QueryRow("SELECT EXISTS(SELECT 1 FROM lists WHERE id = ?)", listID).Scan(&exists)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to verify list"})
		return
	}
	if !exists {
		c.JSON(http.StatusNotFound, gin.H{"error": "List not found"})
		return
	}

	// Start a transaction
	tx, err := db.Begin()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to start transaction"})
		return
	}
	defer tx.Rollback()

	// Update the list's name
	_, err = tx.Exec(`
		UPDATE lists 
		SET name = ?, updated_at = UNIXEPOCH()
		WHERE id = ?
	`, request.Name, listID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update list: " + err.Error()})
		return
	}

	// Update the list's top-level items using the helper function
	if err := updateItems(tx, id, nil, request.Items); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	// Commit the transaction
	if err = tx.Commit(); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to commit transaction: " + err.Error()})
		return
	}

	// Return the updated list
	list := List{
		ID:    id,
		Name:  request.Name,
		Items: []ListItem{}, // We could populate this if needed
	}

	c.JSON(http.StatusOK, list)
}

// updateItems updates the items of a parent (either a list for top-level items or a list item for children)
// If parentID is nil, it updates top-level items (parent_id = NULL)
// If parentID is not nil, it updates child items (parent_id = parentID)
func updateItems(tx *sql.Tx, listID int64, parentID *int64, itemIDs []int64) error {
	var query string
	var args []interface{}

	if parentID == nil {
		// Top-level items: parent_id IS NULL
		query = `
			SELECT id FROM list_items 
			WHERE list_id = ? AND parent_id IS NULL
			ORDER BY rank ASC
		`
		args = []interface{}{listID}
	} else {
		// Child items: parent_id = ?
		query = `
			SELECT id FROM list_items 
			WHERE parent_id = ? 
			ORDER BY rank ASC
		`
		args = []interface{}{*parentID}
	}

	// Get current items from database
	rows, err := tx.Query(query, args...)
	if err != nil {
		return fmt.Errorf("failed to get current items: %v", err)
	}
	defer rows.Close()

	var currentItems []int64
	for rows.Next() {
		var itemID int64
		err = rows.Scan(&itemID)
		if err != nil {
			return fmt.Errorf("failed to scan item ID: %v", err)
		}
		currentItems = append(currentItems, itemID)
	}

	// Find items to remove (in current but not in request)
	itemsToRemove := make([]int64, 0)
	for _, currentID := range currentItems {
		found := false
		for _, requestID := range itemIDs {
			if currentID == requestID {
				found = true
				break
			}
		}
		if !found {
			itemsToRemove = append(itemsToRemove, currentID)
		}
	}

	// Orphan items that are no longer in the items list
	for _, removeID := range itemsToRemove {
		// We use -1 to indicate an explicitly orphaned item.
		_, err = tx.Exec("UPDATE list_items SET parent_id = -1, updated_at = UNIXEPOCH() WHERE id = ?", removeID)
		if err != nil {
			return fmt.Errorf("failed to orphan item: %v", err)
		}
	}

	// Process the new items order
	for rank, itemID := range itemIDs {
		if itemID == 0 {
			// This is a new item, create it
			var parentIDValue interface{}
			if parentID == nil {
				parentIDValue = nil
			} else {
				parentIDValue = *parentID
			}

			_, err = tx.Exec(`
				INSERT INTO list_items (list_id, name, rank, parent_id, created_at, updated_at)
				VALUES (?, ?, ?, ?, UNIXEPOCH(), UNIXEPOCH())
			`, listID, "New Item", rank, parentIDValue)
			if err != nil {
				return fmt.Errorf("failed to create new item: %v", err)
			}
		} else {
			// This is an existing item, update its rank and set the parent_id
			var parentIDValue interface{}
			if parentID == nil {
				parentIDValue = nil
			} else {
				parentIDValue = *parentID
			}

			_, err = tx.Exec(`
				UPDATE list_items 
				SET rank = ?, parent_id = ?, updated_at = UNIXEPOCH()
				WHERE id = ?
			`, rank, parentIDValue, itemID)
			if err != nil {
				return fmt.Errorf("failed to update item rank: %v", err)
			}
		}
	}

	return nil
}

func UpdateListItem(c *gin.Context) {
	itemIDStr := c.Param("id")

	// Parse the ID for the response
	itemID, err := strconv.ParseInt(itemIDStr, 10, 64)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Invalid item ID"})
		return
	}

	var request struct {
		Name     string  `json:"name" binding:"required"`
		Children []int64 `json:"children"`
	}

	if err := c.ShouldBindJSON(&request); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request body: " + err.Error()})
		return
	}

	// Verify item exists
	var exists bool
	err = db.QueryRow("SELECT EXISTS(SELECT 1 FROM list_items WHERE id = ?)", itemID).Scan(&exists)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to verify item"})
		return
	}
	if !exists {
		c.JSON(http.StatusNotFound, gin.H{"error": "Item not found"})
		return
	}

	// Start a transaction
	tx, err := db.Begin()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to start transaction"})
		return
	}
	defer tx.Rollback()

	// Update the item's name
	_, err = tx.Exec(`
		UPDATE list_items 
		SET name = ?, updated_at = UNIXEPOCH()
		WHERE id = ?
	`, request.Name, itemID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update item: " + err.Error()})
		return
	}

	// Get the list_id from the parent item
	var listID int64
	err = tx.QueryRow("SELECT list_id FROM list_items WHERE id = ?", itemID).Scan(&listID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to get parent list_id: " + err.Error()})
		return
	}

	// Update the item's children using the helper function
	if err := updateItems(tx, listID, &itemID, request.Children); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	// Commit the transaction
	if err = tx.Commit(); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to commit transaction: " + err.Error()})
		return
	}

	// Return the updated item
	item := ListItem{
		ID:       itemID,
		Name:     request.Name,
		Children: []ListItem{}, // We could populate this if needed
	}

	c.JSON(http.StatusOK, item)
}
