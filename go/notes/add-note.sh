#!/bin/bash

set -e

# Check if required commands are available
if ! command -v curl &> /dev/null; then
    echo "Error: curl is required but not installed." >&2
    exit 1
fi

if ! command -v jq &> /dev/null; then
    echo "Error: jq is required but not installed." >&2
    exit 1
fi

# Get title from command line argument or prompt
if [ -n "$1" ]; then
    title="$1"
else
    read -p "Enter note title: " title
fi

# Check if title is empty
if [ -z "$title" ]; then
    echo "Error: Title cannot be empty" >&2
    exit 1
fi

# Server endpoint
SERVER="http://localhost:8123"
ENDPOINT="${SERVER}/api/v2/bookmarks/"

# Build JSON payload using jq
payload=$(jq -n \
    --arg title "$title" \
    '{item: {id: -1, title: $title, tags: ["personal", "random-thought"]}}')

# Send PUT request
response=$(curl -s -w "\n%{http_code}" -X PUT \
    -H "Content-Type: application/json" \
    -d "$payload" \
    "$ENDPOINT")

# Extract HTTP status code (last line)
http_code=$(echo "$response" | tail -n 1)
body=$(echo "$response" | sed '$d')

# Check if request was successful
if [ "$http_code" -eq 200 ] || [ "$http_code" -eq 201 ]; then
    echo "Note added successfully!"
    exit 0
else
    echo "Error: Failed to add note (HTTP $http_code)" >&2
    echo "$body" >&2
    exit 1
fi
