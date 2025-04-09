#!/usr/bin/env bash

script_dir=$(cd "$(dirname "$0")" && pwd)

echo "> Building frontend..."
cd "$script_dir/frontend"
npm run build

echo "> Building backend..."
cd "$script_dir/backend"
go build -o "$script_dir/dist/backend/server" .

echo "Done!"
