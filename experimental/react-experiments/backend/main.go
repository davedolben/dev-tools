package main

import (
	"flag"
	"fmt"
	"log"

	"github.com/davedolben/dev-tools/experimental/react-experiments/calendar"
	"github.com/gin-gonic/gin"
)

func main() {
	fPort := flag.Int("port", 8100, "port to listen on")
	fCalendarDBPath := flag.String("calendar-db", "calendar.db", "path to calendar database")
	flag.Parse()

	// Initialize database
	if err := calendar.InitDB(*fCalendarDBPath); err != nil {
		log.Fatalf("Failed to initialize database: %v", err)
	}

	// Create Gin router
	r := gin.Default()

	// Setup routes
	calendar.SetupRoutes(r)

	// Start server
	host := fmt.Sprintf(":%d", *fPort)
	fmt.Printf("Listening on %s\n", host)
	if err := r.Run(host); err != nil {
		log.Fatalf("Failed to start server: %v", err)
	}
}
