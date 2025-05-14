package commander

import (
	"bytes"
	"os/exec"
)

// RunSubprocess runs a subprocess with the given command and arguments.
// It returns the combined output (stdout and stderr) and any error encountered.
func RunSubprocess(command string, args ...string) (string, error) {
	// Create the command
	cmd := exec.Command(command, args...)

	// Capture the output
	var output bytes.Buffer
	cmd.Stdout = &output
	cmd.Stderr = &output

	// Run the command
	err := cmd.Run()
	return output.String(), err
}