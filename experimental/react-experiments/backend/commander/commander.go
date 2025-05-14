package commander

import (
	"log"

	"github.com/gin-gonic/gin"
)

type CommandDefinition struct {
	ID          string               `json:"id"`
	Name        string               `json:"name"`
	Description string               `json:"description"`
	Handler     func(args any) error `json:"-"`
}

var commands = map[string]CommandDefinition{
	"hello_world": {
		Name:        "Hello World",
		Description: "Test command that prints 'Hello, World!'",
		Handler: func(args any) error {
			log.Println("Hello, world!")
			return nil
		},
	},
	"insert_emoji_command_tab": {
		Name:        "Insert Emoji (command+tab)",
		Description: "Test command that inserts an emoji.",
		Handler: func(args any) error {
			return insertEmoji("😊", true)
		},
	},
	"insert_emoji": {
		Name:        "Insert Emoji",
		Description: "Test command that inserts an emoji.",
		Handler: func(args any) error {
			return insertEmoji("😊", false)
		},
	},
}

func insertEmoji(emoji string, useCommandTab bool) error {
	appleScript := `
		set the clipboard to "` + emoji + `"
		tell application "System Events"
			` + (func() string {
		if useCommandTab {
			return `keystroke tab using {command down}
					delay 0.5`
		}
		return ""
	})() + `
			keystroke "v" using {command down}
		end tell`
	_, err := RunSubprocess("osascript", "-e", appleScript)
	if err != nil {
		return err
	}
	return nil
}

func SetupRoutes(r *gin.Engine) {
	commanderGroup := r.Group("/api/commander")
	{
		commanderGroup.GET("/commands", HandleGetCommands)
		commanderGroup.POST("/run/:id", HandleRunCommand)
	}
}

func HandleGetCommands(c *gin.Context) {
	commandsOut := make([]CommandDefinition, 0, len(commands))
	for k, command := range commands {
		commandsOut = append(commandsOut, command)
		commandsOut[len(commandsOut)-1].ID = k
	}
	data := struct {
		Commands []CommandDefinition `json:"commands"`
	}{
		Commands: commandsOut,
	}
	c.JSON(200, data)
}

func HandleRunCommand(c *gin.Context) {
	id := c.Param("id")
	if id == "" {
		c.JSON(400, gin.H{"error": "Command ID is required"})
		return
	}

	command := commands[id]
	if command.Handler == nil {
		c.JSON(404, gin.H{"error": "Command not found"})
		return
	}

	err := command.Handler(nil)
	if err != nil {
		c.JSON(500, gin.H{"error": err.Error()})
		return
	}

	// Here you would run the command with the given ID
	// For now, we'll just return a success message
	c.JSON(200, gin.H{"message": "Command executed successfully", "command_id": id})
}
