#!/usr/bin/env bash

script_dir=$(cd "$(dirname "$0")" && pwd)

cd "$script_dir"
./backend/server --static-dir "${script_dir}/frontend/dist" --calendar-db "${script_dir}/../calendar.db"
