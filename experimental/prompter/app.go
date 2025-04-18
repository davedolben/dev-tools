package main

import (
	"context"
	"fmt"
	"io"
	"os/exec"
	"time"
)

// CommandOutput represents the output of a command execution
type CommandOutput struct {
	Stdout string `json:"stdout"`
	Stderr string `json:"stderr"`
	Error  string `json:"error,omitempty"`
}

// App struct
type App struct {
	ctx context.Context
}

// NewApp creates a new App application struct
func NewApp() *App {
	return &App{}
}

// startup is called when the app starts. The context is saved
// so we can call the runtime methods
func (a *App) startup(ctx context.Context) {
	a.ctx = ctx
}

// Greet returns a greeting for the given name
func (a *App) Greet(name string) string {
	return fmt.Sprintf("Hello %s, It's show time!", name)
}

func (a *App) AsyncEcho(message string) string {
	time.Sleep(time.Second * 3)
	return fmt.Sprintf("async echo: %s", message)
}

func (a *App) Execute(command string, args []string) CommandOutput {
	cmd := exec.Command(command, args...)
	
	// Create pipes for stdout and stderr
	stdout, err := cmd.StdoutPipe()
	if err != nil {
		return CommandOutput{
			Error: fmt.Sprintf("Error creating stdout pipe: %v", err),
		}
	}
	
	stderr, err := cmd.StderrPipe()
	if err != nil {
		return CommandOutput{
			Error: fmt.Sprintf("Error creating stderr pipe: %v", err),
		}
	}

	// Start the command
	if err := cmd.Start(); err != nil {
		return CommandOutput{
			Error: fmt.Sprintf("Error starting command: %v", err),
		}
	}

	// Read the output
	stdoutBytes, err := io.ReadAll(stdout)
	if err != nil {
		return CommandOutput{
			Error: fmt.Sprintf("Error reading stdout: %v", err),
		}
	}

	stderrBytes, err := io.ReadAll(stderr)
	if err != nil {
		return CommandOutput{
			Error: fmt.Sprintf("Error reading stderr: %v", err),
		}
	}

	// Wait for the command to finish
	if err := cmd.Wait(); err != nil {
		return CommandOutput{
			Stdout: string(stdoutBytes),
			Stderr: string(stderrBytes),
			Error:  fmt.Sprintf("Command failed: %v", err),
		}
	}

	return CommandOutput{
		Stdout: string(stdoutBytes),
		Stderr: string(stderrBytes),
	}
}

func (a *App) ExecuteInNewWindow(command string, args []string) CommandOutput {
	// Construct the command with arguments
	cmdStr := command
	for _, arg := range args {
		cmdStr += " " + arg
	}

	// Create the AppleScript command
	appleScript := fmt.Sprintf(`
		tell application "iTerm"
			create window with default profile
			tell current window
				tell current session
					write text "%s"
				end tell
			end tell
		end tell
	`, cmdStr)

	// Execute the AppleScript command
	cmd := exec.Command("osascript", "-e", appleScript)
	stdout, err := cmd.StdoutPipe()
	if err != nil {
		return CommandOutput{
			Error: fmt.Sprintf("Error creating stdout pipe: %v", err),
		}
	}

	stderr, err := cmd.StderrPipe()
	if err != nil {
		return CommandOutput{
			Error: fmt.Sprintf("Error creating stderr pipe: %v", err),
		}
	}

	if err := cmd.Start(); err != nil {
		return CommandOutput{
			Error: fmt.Sprintf("Error starting AppleScript: %v", err),
		}
	}

	stdoutBytes, err := io.ReadAll(stdout)
	if err != nil {
		return CommandOutput{
			Error: fmt.Sprintf("Error reading stdout: %v", err),
		}
	}

	stderrBytes, err := io.ReadAll(stderr)
	if err != nil {
		return CommandOutput{
			Error: fmt.Sprintf("Error reading stderr: %v", err),
		}
	}

	if err := cmd.Wait(); err != nil {
		return CommandOutput{
			Stdout: string(stdoutBytes),
			Stderr: string(stderrBytes),
			Error:  fmt.Sprintf("AppleScript failed: %v", err),
		}
	}

	return CommandOutput{
		Stdout: string(stdoutBytes),
		Stderr: string(stderrBytes),
	}
}
