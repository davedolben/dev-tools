#!/usr/bin/env bash

color_clear="\e[0m"
color_red="\e[31m"
color_green="\e[32m"
color_blue="\e[94m"

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
  # Grab the first arg as a search parameter
  tag="$1"
  shift
  cmd="grep \"$tag\" \"$filename\""

  # Exclude lines with any tags after the first one
  excludes=
  while [ "$#" -gt "0" ]; do
    excludes+=" -e \"$1\""
    shift
  done
  if [ ! -z "$excludes" ]; then
    cmd+=" | grep -v $excludes"
  fi

  # Trim off leading whitespace
  cmd+=" | sed -r \"s/^[ \t]+//g\""

  #echo "$cmd"
  eval "$cmd"
}

# TODO: figure out how to load the file into memory then do these ops so I'm not
# reading the file 4 times
function print_buckets() {
  clear
  date
  echo ""
  print_logo
  echo ""
  echo ""

  # Find the paragraph in the file containing the string
  awk 'BEGIN{FS=RS=""}
    /Weekly Goals/' "$filename"
  echo ""

  printf "\n#####  ${color_red}Now${color_clear}  #####\n\n"
  print_bucket @now @done
  echo ""

  printf "\n#####  ${color_green}Today${color_clear}  #####\n\n"
  print_bucket @today @now @done
  echo ""

  printf "\n#####  ${color_blue}This Week${color_clear}  #####\n\n"
  print_bucket @thisweek @now @today @done
  echo ""
}

print_buckets

# Re-run on any changes to the target file
fswatch -0 "$filename" | while read -d "" event; do
  print_buckets
done

