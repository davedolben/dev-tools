#!/usr/bin/env bash

out_dir=generated
mkdir -p "$out_dir"
certfile="${out_dir}/Certificate.crt"
keyfile="${out_dir}/Key.key"

# -nodes --> no passphrase
openssl req -new \
  -newkey rsa:4096 \
  -x509 -sha256 \
  -days 365 -nodes \
  -out "$certfile" \
  -keyout "$keyfile"
