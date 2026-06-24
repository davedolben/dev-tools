package main

import (
	"context"
	"fmt"
	"log"
	"net/http"
	"net/url"
	"os"

	"github.com/davedolben/dev-tools/go/babysitter"
	"github.com/mark3labs/mcp-go/mcp"
	"github.com/mark3labs/mcp-go/server"
)

func babysitterURL() string {
	if u := os.Getenv("BABYSITTER_URL"); u != "" {
		return u
	}
	return "http://localhost:8888"
}

func sendSignal(sig babysitter.Signal) error {
	vals := url.Values{
		"type": {sig.Type},
		"key":  {sig.Key},
		"id":   {sig.ID},
	}
	if sig.Cmd != "" {
		vals.Set("cmd", sig.Cmd)
	}
	if sig.Cwd != "" {
		vals.Set("cwd", sig.Cwd)
	}

	resp, err := http.PostForm(babysitterURL()+"/api/babysitter/signal", vals)
	if err != nil {
		return fmt.Errorf("failed to send signal: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return fmt.Errorf("unexpected status code: %d", resp.StatusCode)
	}
	return nil
}

func handleStartTask(_ context.Context, req mcp.CallToolRequest) (*mcp.CallToolResult, error) {
	key := req.GetString("key", "")
	id := req.GetString("id", "")
	if key == "" || id == "" {
		return mcp.NewToolResultError("key and id are required"), nil
	}

	err := sendSignal(babysitter.Signal{
		Type: babysitter.SignalTypeStart,
		Key:  key,
		ID:   id,
		Cmd:  req.GetString("cmd", ""),
		Cwd:  req.GetString("cwd", ""),
	})
	if err != nil {
		return mcp.NewToolResultError(err.Error()), nil
	}

	return mcp.NewToolResultText(fmt.Sprintf("started task %s/%s", key, id)), nil
}

func handleFinishTask(_ context.Context, req mcp.CallToolRequest) (*mcp.CallToolResult, error) {
	key := req.GetString("key", "")
	id := req.GetString("id", "")
	if key == "" || id == "" {
		return mcp.NewToolResultError("key and id are required"), nil
	}

	// Extract success boolean from arguments
	args := req.GetArguments()
	successVal, ok := args["success"]
	if !ok {
		return mcp.NewToolResultError("success is required"), nil
	}
	success, ok := successVal.(bool)
	if !ok {
		return mcp.NewToolResultError("success must be a boolean"), nil
	}

	sigType := babysitter.SignalTypeFailure
	if success {
		sigType = babysitter.SignalTypeSuccess
	}

	err := sendSignal(babysitter.Signal{
		Type: sigType,
		Key:  key,
		ID:   id,
		Cmd:  req.GetString("cmd", ""),
		Cwd:  req.GetString("cwd", ""),
	})
	if err != nil {
		return mcp.NewToolResultError(err.Error()), nil
	}

	return mcp.NewToolResultText(fmt.Sprintf("finished task %s/%s (success=%v)", key, id, success)), nil
}

func main() {
	s := server.NewMCPServer("babysitter", "1.0.0",
		server.WithToolCapabilities(false),
	)

	startTool := mcp.NewTool("start_task",
		mcp.WithDescription("Signal that a task has started"),
		mcp.WithString("key", mcp.Required(), mcp.Description("Task group key")),
		mcp.WithString("id", mcp.Required(), mcp.Description("Unique task identifier")),
		mcp.WithString("cmd", mcp.Description("Command being run")),
		mcp.WithString("cwd", mcp.Description("Working directory")),
	)

	finishTool := mcp.NewTool("finish_task",
		mcp.WithDescription("Signal that a task has finished"),
		mcp.WithString("key", mcp.Required(), mcp.Description("Task group key")),
		mcp.WithString("id", mcp.Required(), mcp.Description("Unique task identifier")),
		mcp.WithBoolean("success", mcp.Required(), mcp.Description("Whether the task succeeded")),
		mcp.WithString("cmd", mcp.Description("Command that was run")),
		mcp.WithString("cwd", mcp.Description("Working directory")),
	)

	s.AddTool(startTool, handleStartTask)
	s.AddTool(finishTool, handleFinishTask)

	if err := server.ServeStdio(s); err != nil {
		log.Fatalf("server error: %v", err)
	}
}
