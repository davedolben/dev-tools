#!/bin/bash
#
# Plays a sound and shows a sticky alert dialog with a given message.
# The alert stays on screen until explicitly dismissed.
#
# Usage: notify.sh <message> [title]

set -euo pipefail

message="${1:?Usage: notify.sh <message> [title]}"
title="${2:-Alert}"

# Play system sound in background so the alert appears immediately
afplay /System/Library/Sounds/Glass.aiff &

osascript -e "display alert \"$title\" message \"$message\""
