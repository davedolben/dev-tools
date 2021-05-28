#!/usr/bin/env bash

set -e

if [ "$#" -ne "2" ]; then
  echo "usage: $(basename "$0") <app_name> <main> [<args>...]"
  exit 1
fi

appname="$1"
shift
script="$1"

dir="${appname}.app/Contents/MacOS"

echo "\"child\"," > child_lib/child_args.inl
./child_lib/build.sh

mkdir -p "${dir}"
cp "$script" "${dir}/child"
chmod +x "${dir}/child"

cp "child_lib/run_child" "${dir}/${appname}"

