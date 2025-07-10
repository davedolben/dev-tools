package main

import (
	"flag"
	"fmt"
	"log"
	"net/http"
	"path"
	"slices"

	"github.com/davedolben/dev-tools/experimental/react-experiments/calendar"
	"github.com/davedolben/dev-tools/experimental/react-experiments/commander"
	"github.com/gin-contrib/static"
	"github.com/gin-gonic/gin"
)

func main() {
	fPort := flag.Int("port", 8100, "port to listen on")
	fCalendarDBPath := flag.String("calendar-db", "calendar.db", "path to calendar database")
	fStaticDir := flag.String("static-dir", "", "path to static files")
	flag.Parse()

	// Create Gin router
	r := gin.Default()

	// Setup routes
	calendar.SetupRoutes(r, *fCalendarDBPath)
	commander.SetupRoutes(r)

	if *fStaticDir != "" {
		r.Use(static.Serve("/", static.LocalFile(*fStaticDir, false)))
	}

	// Set up redirection middleware to serve index.html for specific routes
	r.Use(func(c *gin.Context) {
		if slices.Contains([]string{"/calendar"}, c.Request.URL.Path) {
			http.ServeFile(c.Writer, c.Request, path.Join(*fStaticDir, "index.html"))
		}
	})

	// Start server
	host := fmt.Sprintf(":%d", *fPort)
	fmt.Printf("Listening on %s\n", host)
	if err := r.Run(host); err != nil {
		log.Fatalf("Failed to start server: %v", err)
	}
}
