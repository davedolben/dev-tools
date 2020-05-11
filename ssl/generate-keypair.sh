#!/usr/bin/env bash

certfile=Certificate.crt
keyfile=Key.key

# -nodes --> no passphrase
openssl req -new \
  -newkey rsa:4096 \
  -x509 -sha256 \
  -days 365 -nodes \
  -out "$certfile" \
  -keyout "$keyfile"
