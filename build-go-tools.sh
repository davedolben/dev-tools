#!/usr/bin/env sh

script_dir="$(cd $(dirname "$0") && pwd)"
bin_dir="${OUT_DIR:-go-bin}"
bin_dir="${script_dir}/${bin_dir}"

mkdir -p "$bin_dir"

cd "${script_dir}/go"

DO_MAC=
while [ "$#" -gt "0" ]; do
  case "$1" in
    "--mac")
      DO_MAC=true
      shift
      ;;
    *)
      break
      ;;
  esac
done

build() {
  cd "$1"
  go build -o "${bin_dir}/$2"
  cd -
}

if [ ! -z "$DO_MAC" ]; then
  echo "Cross-compiling for macos"
  export GOOS=darwin
  export GOARCH=amd64
  bin_dir="${bin_dir}/macos"
fi

build fileserver fileserver
build babysitter babysitter
build notes notes-server
build captains_chair captains-chair

