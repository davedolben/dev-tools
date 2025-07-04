package calendar

import (
	"database/sql"
	"log"
	"net/http"
	"strconv"
	"time"

	"github.com/gin-gonic/gin"
	_ "github.com/glebarez/go-sqlite"
)

type Calendar struct {
	ID          int64     `json:"id"`
	Name        string    `json:"name"`
	Description string    `json:"description"`
	Color       string    `json:"color"`
	CreatedAt   time.Time `json:"created_at"`
	UpdatedAt   time.Time `json:"updated_at"`
}

type Event struct {
	ID          int64     `json:"id"`
	CalendarID  int64     `json:"calendar_id"`
	Title       string    `json:"title"`
	Description string    `json:"description"`
	StartTime   time.Time `json:"start_time"`
	Length      int       `json:"length"`
	CreatedAt   time.Time `json:"created_at"`
	UpdatedAt   time.Time `json:"updated_at"`
}

var db *sql.DB

func SetupRoutes(r *gin.Engine) {
	calendarGroup := r.Group("/api/calendars")
	{
		calendarGroup.GET("", GetCalendars)
		calendarGroup.POST("", CreateCalendar)
		calendarGroup.GET("/:id/events", GetCalendarEvents)
		calendarGroup.POST("/:id/events", CreateEvent)
		calendarGroup.PUT("/events/:eventId", UpdateEvent)
		calendarGroup.DELETE("/events/:eventId", DeleteEvent)
	}
}

func GetCalendars(c *gin.Context) {
	rows, err := db.Query("SELECT id, name, description, COALESCE(color, '#cccccc') as color, created_at, updated_at FROM calendars")
	if err != nil {
		log.Println("Failed to fetch calendars:", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch calendars"})
		return
	}
	defer rows.Close()

	var calendars []Calendar
	for rows.Next() {
		var cal Calendar
		err := rows.Scan(&cal.ID, &cal.Name, &cal.Description, &cal.Color, &cal.CreatedAt, &cal.UpdatedAt)
		if err != nil {
			log.Println("Failed to scan calendar:", err)
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to scan calendar"})
			return
		}
		calendars = append(calendars, cal)
	}

	c.JSON(http.StatusOK, calendars)
}

func GetCalendarEvents(c *gin.Context) {
	calendarID := c.Param("id")

	rows, err := db.Query(`
		SELECT id, calendar_id, title, description, start_time, length, created_at, updated_at 
		FROM events 
		WHERE calendar_id = ?
	`, calendarID)
	if err != nil {
		log.Println("Failed to fetch events:", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch events"})
		return
	}
	defer rows.Close()

	var events []Event
	for rows.Next() {
		var event Event
		err := rows.Scan(
			&event.ID,
			&event.CalendarID,
			&event.Title,
			&event.Description,
			&event.StartTime,
			&event.Length,
			&event.CreatedAt,
			&event.UpdatedAt,
		)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to scan event"})
			return
		}
		events = append(events, event)
	}

	c.JSON(http.StatusOK, events)
}

func CreateCalendar(c *gin.Context) {
	var cal Calendar
	if err := c.ShouldBindJSON(&cal); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request body"})
		return
	}

	result, err := db.Exec(`
		INSERT INTO calendars (name, description, color, created_at, updated_at)
		VALUES (?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
	`, cal.Name, cal.Description, cal.Color)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create calendar"})
		return
	}

	id, err := result.LastInsertId()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to get calendar ID"})
		return
	}

	cal.ID = id
	c.JSON(http.StatusCreated, cal)
}

func CreateEvent(c *gin.Context) {
	calendarID := c.Param("id")
	var event Event
	if err := c.ShouldBindJSON(&event); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request body"})
		return
	}

	// Verify calendar exists
	var exists bool
	err := db.QueryRow("SELECT EXISTS(SELECT 1 FROM calendars WHERE id = ?)", calendarID).Scan(&exists)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to verify calendar"})
		return
	}
	if !exists {
		c.JSON(http.StatusNotFound, gin.H{"error": "Calendar not found"})
		return
	}

	result, err := db.Exec(`
		INSERT INTO events (calendar_id, title, description, start_time, length, created_at, updated_at)
		VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
	`, calendarID, event.Title, event.Description, event.StartTime, event.Length)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create event"})
		return
	}

	id, err := result.LastInsertId()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to get event ID"})
		return
	}

	event.ID = id
	event.CalendarID, _ = strconv.ParseInt(calendarID, 10, 64)
	c.JSON(http.StatusCreated, event)
}

func UpdateEvent(c *gin.Context) {
	eventID := c.Param("eventId")
	var event Event
	if err := c.ShouldBindJSON(&event); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request body"})
		return
	}

	// Verify event exists
	var exists bool
	err := db.QueryRow("SELECT EXISTS(SELECT 1 FROM events WHERE id = ?)", eventID).Scan(&exists)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to verify event"})
		return
	}
	if !exists {
		c.JSON(http.StatusNotFound, gin.H{"error": "Event not found"})
		return
	}

	_, err = db.Exec(`
		UPDATE events 
		SET title = ?, description = ?, start_time = ?, length = ?, updated_at = CURRENT_TIMESTAMP
		WHERE id = ?
	`, event.Title, event.Description, event.StartTime, event.Length, eventID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update event"})
		return
	}

	event.ID, _ = strconv.ParseInt(eventID, 10, 64)
	c.JSON(http.StatusOK, event)
}

func DeleteEvent(c *gin.Context) {
	eventID := c.Param("eventId")

	// Verify event exists
	var exists bool
	err := db.QueryRow("SELECT EXISTS(SELECT 1 FROM events WHERE id = ?)", eventID).Scan(&exists)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to verify event"})
		return
	}
	if !exists {
		c.JSON(http.StatusNotFound, gin.H{"error": "Event not found"})
		return
	}

	// Delete the event
	_, err = db.Exec("DELETE FROM events WHERE id = ?", eventID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to delete event"})
		return
	}

	c.Status(http.StatusNoContent)
}
