#!/usr/bin/env bash

script_dir="$(cd $(dirname "$0") && pwd)"
cd "$script_dir"

export GOPATH=$GOPATH:${script_dir}/go/

mkdir -p go/bin

go build -o go/bin/fileserver ddolben/dev-tools/fileserver
go build -o go/bin/babysitter ddolben/dev-tools/babysitter
go build -o go/bin/notes-server ddolben/notes

