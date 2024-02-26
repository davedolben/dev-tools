#!/usr/bin/env bash

image=golang:1.18
container=dev-tools

if [ ! -z "$(docker ps -q --all --filter name=${container})" ]; then
  docker start "${container}"
  docker attach "${container}"
  exit 0
fi

docker run -it --name "${container}" -v ${PWD}:/code -w /code -p 9999:9999 "${image}" bash

