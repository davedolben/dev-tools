#!/usr/bin/env bash

image=golang:1.18
container=dev-tools

docker run -it --name "${container}" -v ${PWD}:/code -w /code -p 9999:9999 "${image}" bash

