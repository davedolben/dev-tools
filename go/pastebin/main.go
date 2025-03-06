package main

import (
	"encoding/json"
	"flag"
	"fmt"
	"io/ioutil"
	"log"
	"math/rand"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"time"
)

const (
	charSet      = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"
	idLength     = 8
	htmlTemplate = `
<!DOCTYPE html>
<html>
<head>
    <title>Simple Pastebin</title>
    <style>
        body {
            font-family: Arial, sans-serif;
            max-width: 800px;
            margin: 0 auto;
            padding: 20px;
        }
        h1 {
            color: #333;
        }
        #editor {
            width: 100%;
            min-height: 300px;
            border: 1px solid #ccc;
            padding: 10px;
            margin-bottom: 20px;
            white-space: pre-wrap;
            font-family: monospace;
            font-size: 14px;
            overflow: auto;
            box-sizing: border-box;
        }
        #controls {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 15px;
        }
        .save-options {
            display: flex;
            align-items: center;
            gap: 10px;
        }
        #custom-id {
            padding: 8px;
            border: 1px solid #ccc;
            border-radius: 4px;
            font-size: 14px;
        }
        button {
            background-color: #4CAF50;
            color: white;
            border: none;
            padding: 10px 20px;
            text-align: center;
            text-decoration: none;
            display: inline-block;
            font-size: 16px;
            cursor: pointer;
            border-radius: 4px;
        }
        button:hover {
            background-color: #45a049;
        }
        #status {
            color: #666;
        }
        #paste-url {
            margin-top: 10px;
            padding: 10px;
            background-color: #f8f8f8;
            border: 1px solid #ddd;
            display: none;
        }
        a {
            color: #2196F3;
            text-decoration: none;
        }
        a:hover {
            text-decoration: underline;
        }
    </style>
</head>
<body>
    <h1>Simple Pastebin</h1>
    <div id="editor" contenteditable="true"></div>
    <div id="controls">
        <div class="save-options">
            <button id="save">Save</button>
            <input type="text" id="custom-id" placeholder="Custom ID (optional)" />
        </div>
        <span id="status"></span>
    </div>
    <div id="paste-url"></div>

    <script>
        document.addEventListener('DOMContentLoaded', function() {
            const editor = document.getElementById('editor');
            const saveButton = document.getElementById('save');
            const customIdInput = document.getElementById('custom-id');
            const status = document.getElementById('status');
            const pasteUrl = document.getElementById('paste-url');
            
            // Get ID from URL if present
            const pathParts = window.location.pathname.split('/');
            const id = pathParts.length > 1 ? pathParts[1] : '';
            
            // If an ID is present in the URL, load that paste
            if (id) {
                fetch('/api/paste/' + id)
                    .then(response => {
                        if (!response.ok) {
                            throw new Error('Paste not found');
                        }
                        return response.text();
                    })
                    .then(data => {
                        editor.textContent = data;
                        status.textContent = 'Paste loaded.';
                    })
                    .catch(error => {
                        status.textContent = error.message;
                    });
            }
            
            // Save button click handler
            saveButton.addEventListener('click', function() {
                const content = editor.textContent || editor.innerText;
                const customId = customIdInput.value.trim();
                
                if (!content.trim()) {
                    status.textContent = 'Cannot save empty paste.';
                    return;
                }
                
                status.textContent = 'Saving...';
                
                // Create request options
                const requestOptions = {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'text/plain'
                    },
                    body: content
                };
                
                // Add custom ID to URL if provided
                let saveUrl = '/api/save';
                if (customId) {
                    saveUrl += '?id=' + encodeURIComponent(customId);
                }
                
                fetch(saveUrl, requestOptions)
                .then(response => {
                    if (!response.ok) {
                        return response.json().then(err => {
                            throw new Error(err.error || 'Error saving paste');
                        });
                    }
                    return response.json();
                })
                .then(data => {
                    const url = window.location.origin + '/' + data.id;
                    status.textContent = 'Saved!';
                    pasteUrl.innerHTML = 'Your paste is available at: <a href="' + url + '">' + url + '</a>';
                    pasteUrl.style.display = 'block';
                    
                    // Update URL without reloading the page
                    window.history.pushState({}, '', '/' + data.id);
                    
                    // Clear custom ID input
                    customIdInput.value = '';
                })
                .catch(error => {
                    status.textContent = 'Error saving paste: ' + error.message;
                });
            });
        });
    </script>
</body>
</html>
`
)

// Paste represents a saved paste
type Paste struct {
	ID      string    `json:"id"`
	Content string    `json:"content"`
	Created time.Time `json:"created"`
}

var dataDir string

func main() {
	rand.Seed(time.Now().UnixNano())

  fPort         := flag.Int("port", 8080, "Port to listen on")
  fDataDir      := flag.String("dir", "/tmp/pastebin", "Directory to store paste files")
  fHost         := flag.String("host", "localhost", "Host to listen on")
  flag.Parse()

  dataDir = *fDataDir

	// Ensure data directory exists
	if err := os.MkdirAll(*fDataDir, 0755); err != nil {
		log.Fatalf("Failed to create data directory: %v", err)
	}

	// Define HTTP handlers
	http.HandleFunc("/", handleRoot)
	http.HandleFunc("/api/save", handleSave)
	http.HandleFunc("/api/paste/", handleGetPaste)

	// Start the server
  host := fmt.Sprintf("%s:%d", *fHost, *fPort)
	fmt.Printf("Pastebin server running at http://%s\n", host)
	log.Fatal(http.ListenAndServe(host, nil))
}

// handleRoot serves the main page or a specific paste
func handleRoot(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "text/html")
	fmt.Fprint(w, htmlTemplate)
}

// handleSave saves a new paste
func handleSave(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	// Read the paste content
	body, err := ioutil.ReadAll(r.Body)
	if err != nil {
		http.Error(w, "Failed to read request body", http.StatusInternalServerError)
		return
	}
	defer r.Body.Close()

	content := string(body)
	if strings.TrimSpace(content) == "" {
		http.Error(w, "Empty paste content", http.StatusBadRequest)
		return
	}

	// Check if a custom ID was provided
	var id string
	customID := r.URL.Query().Get("id")
	
	if customID != "" {
		// Validate custom ID (only allow alphanumeric characters)
		if !isValidID(customID) {
			http.Error(w, `{"error":"Invalid custom ID. Only alphanumeric characters are allowed"}`, http.StatusBadRequest)
			return
		}
		
		// Check if ID already exists
		if _, err := os.Stat(filepath.Join(dataDir, customID+".txt")); err == nil {
			http.Error(w, `{"error":"Custom ID already in use"}`, http.StatusConflict)
			return
		}
		
		id = customID
	} else {
		// Generate a unique ID
		id = generateID()
	}

	// Save the paste content to a file
	err = ioutil.WriteFile(filepath.Join(dataDir, id+".txt"), []byte(content), 0644)
	if err != nil {
		http.Error(w, "Failed to save paste", http.StatusInternalServerError)
		return
	}

	// Return the paste ID
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{"id": id})
}

// handleGetPaste retrieves a paste by ID
func handleGetPaste(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	// Extract the paste ID from the URL
	parts := strings.Split(r.URL.Path, "/")
	if len(parts) < 3 {
		http.Error(w, "Invalid paste ID", http.StatusBadRequest)
		return
	}
	id := parts[len(parts)-1]

	// Read the paste file
	filePath := filepath.Join(dataDir, id+".txt")
	content, err := ioutil.ReadFile(filePath)
	if err != nil {
		if os.IsNotExist(err) {
			http.Error(w, "Paste not found", http.StatusNotFound)
		} else {
			http.Error(w, "Failed to read paste", http.StatusInternalServerError)
		}
		return
	}

	// Return the paste content
	w.Header().Set("Content-Type", "text/plain")
	w.Write(content)
}

// generateID creates a random string for paste IDs
func generateID() string {
	id := make([]byte, idLength)
	for i := range id {
		id[i] = charSet[rand.Intn(len(charSet))]
	}
	return string(id)
}

// isValidID checks if a custom ID contains only valid characters
func isValidID(id string) bool {
	if len(id) == 0 || len(id) > 64 {
		return false
	}
	
	for _, char := range id {
		if !strings.ContainsRune(charSet, char) {
			return false
		}
	}
	
	return true
}
