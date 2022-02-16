#!/usr/bin/env sh

script_dir="$(cd $(dirname "$0") && pwd)"
bin_dir="${OUT_DIR:-go-bin}"
bin_dir="${script_dir}/${bin_dir}"

mkdir -p "$bin_dir"

cd "${script_dir}/go"

build() {
  cd "$1"
  go build -o "${bin_dir}/$2"
  cd -
}

build fileserver fileserver
build babysitter babysitter
build notes notes-server
build captains_chair captains-chair

