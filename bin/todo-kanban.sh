#!/usr/bin/env bash

#
# Neat little script to parse a taskpaper file and extract certain items with specific tags.
#
# Note that you can additionally filter it by adding config lines into the taskpaper file like so:
#   $filter(...)   - Additionally filter everything to lines including this string
#   $exclude(...)  - Additionally filter out lines including this string
#

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

function print_bucket() {
  # filter/exclude lines with any tags after the first one
  local filters=
  local excludes=
  while [ "$#" -gt "0" ]; do
    if [[ "$1" =~ ^!.* ]]; then
      excludes+=" -e \"$(echo "$1" | sed -r 's/^!//')\""
    else
      filters+=" | grep -e \"$1\""
    fi
    shift
  done
  local cmd="cat \"$filename\""
  if [ ! -z "$filters" ]; then
    cmd+=" $filters"
  fi
  if [ ! -z "$excludes" ]; then
    cmd+=" | grep -v $excludes"
  fi

  # Trim off leading whitespace
  cmd+=" | sed -r \"s/^[ \t]+//g\""

  #echo "$cmd"

  # Highlight tags (honestly don't really understand how this works)
  eval "$cmd" | sed -r 's/(@[a-zA-Z0-9_:\/\-]+)/\'$'\033[33m&\033[0m/g'
}

# TODO: figure out how to load the file into memory then do these ops so I'm not
# reading the file 4 times
function print_buckets() {
  clear
  date
  echo ""
  print_logo

  # Find any options stated in the file
  local options="$(grep '^\$[^(]\([^)]\)\S*$' "$filename" | sed -r 's/\$([^\(]+)\(([^\)]+)\)/\1=\2/')"
  local additional_filters=""
  while read line; do
    if [[ ! "$line" =~ ^\S*$ ]]; then
      additional_filters+=" $(echo "$line" | sed -r 's/.*=(.*)/\1/')"
    fi
  done <<<"$(echo "$options")"

  if [ ! -z "$additional_filters" ]; then
    echo ""
    echo "Additionally filtering to: $additional_filters"
  fi

  echo ""
  echo ""

  # Find the paragraph in the file containing the string
  awk 'BEGIN{FS=RS=""}
    /Weekly Goals/' "$filename"
  echo ""

  printf "\n${color_red}#####  Now  #####${color_clear}\n\n"
  print_bucket @now !@done $additional_filters
  echo ""

  printf "\n${color_green}#####  Today  #####${color_clear}\n\n"
  print_bucket @today !@now !@done $additional_filters
  echo ""

  printf "\n${color_blue}#####  This Week  #####${color_clear}\n\n"
  print_bucket @thisweek !@now !@today !@done $additional_filters
  echo ""
}

# Current timestamp in epoch seconds (do this once for consistency)
#d="$(date +%s)"
## Next desired timestamp
#next_d="$(echo "$(date -j -f %s ${d})")"
#date -j -f %s $next_d
#exit 0

print_buckets

# Re-run on any changes to the target file
# This syntax seems to start up the two commands in parallel and concatenate their outputs into
# one stream.
#   Ref: https://catern.com/posts/pipes.html
#{ fswatch -0 "$filename" &
#  while true; do sleep 10; printf "ping\0"; done & } \
#  | while read -d "" event
fswatch -0 "$filename" | while read -d "" event
do
  print_buckets
done
exit 0

