#!/usr/bin/env bash

script_dir="$(cd $(dirname "$0") && pwd)"
bin_dir="${script_dir}/go-bin"

mkdir -p "$bin_dir"

cd "${script_dir}/go"

function build() {
  pushd "$1"
  go build -o "${bin_dir}/$2"
  popd
}

build fileserver fileserver
build babysitter babysitter
build notes notes-server

