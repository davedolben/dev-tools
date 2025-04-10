#!/usr/bin/env bash

script_dir=$(cd "$(dirname "$0")" && pwd)
if [ -z "$calendar_db" ]; then
  calendar_db="${script_dir}/../calendar.db"
fi

cd "$script_dir"
./backend/server --static-dir "${script_dir}/frontend" --calendar-db "$calendar_db"
