#!/usr/bin/env bash
# highlight.sh — colorize matches of a pattern read from stdin in red
# Usage: some_command | ./highlight.sh 'pattern'

pattern="$1"

if [ -z "$pattern" ]; then
  echo "Usage: $0 <pattern>" >&2
  exit 1
fi

# \033[31m = red, \033[0m = reset. The & in the replacement is the whole match.
sed -E "s/${pattern}/$(printf '\033')[31m&$(printf '\033')[0m/g"
