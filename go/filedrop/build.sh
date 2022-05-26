#!/usr/bin/env bash

# Value variables 
bin_dir="bin" 
exe="filedrop" 

# Add DEV=true to build in dev mode
DEV=${DEV:-}

mkdir -p "${bin_dir}"

if [ ! -z "${DEV}" ]; then
  echo " > Running build_dev"

  go build -tags=dev -o "${bin_dir}/${exe}-dev" .
else
  echo " > Running build"

  go build -o "${bin_dir}/${exe}" .
fi
