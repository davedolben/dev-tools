#!/usr/bin/env bash

script_dir="$(cd $(dirname "$0") && pwd)"
cd "$script_dir"

mkdir -p go/bin

go build -o go/bin/fileserver ddolben/dev-tools/fileserver

