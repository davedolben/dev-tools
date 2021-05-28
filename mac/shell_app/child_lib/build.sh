#!/usr/bin/env bash

script_dir="$(cd "$(dirname "$0")" && pwd)"
cd "$script_dir"

gcc child.c child_main.m -framework Cocoa -o run_child

