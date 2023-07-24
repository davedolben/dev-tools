#!/usr/bin/env bash

script_dir="$(cd "$(dirname "$0")" && pwd)"

color_clear="\e[0m"
color_red="\e[31m"
color_green="\e[32m"
color_blue="\e[94m"
color_yellow="\e[94m"

filename="$1"
if [ -z "$filename" ]; then
  echo "Please specify a filename"
  exit 1
fi

function print_logo() {
  echo "   ___         ______    _  __        "
  echo "  / _ \___    /  _/ /_  / |/ /__ _    __"
  echo " / // / _ \  _/ // __/ /    / _ \ |/|/ /"
  echo "/____/\___/ /___/\__/ /_/|_/\___/__,__/ "
}

function print_todo() {
  clear
  date
  echo ""
  print_logo
  echo ""
  echo ""

  "${script_dir}/../go-bin/darwin-arm64/todo-cli" "$filename"
}

print_todo

# Re-run on any changes to the target file
# This syntax seems to start up the two commands in parallel and concatenate their outputs into
# one stream.
#   Ref: https://catern.com/posts/pipes.html
#{ fswatch -0 "$filename" &
#  while true; do sleep 10; printf "ping\0"; done & } \
#  | while read -d "" event
fswatch -0 "$filename" | while read -d "" event
do
  print_todo
done
exit 0

