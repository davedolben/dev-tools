#!/usr/bin/env bash

script_dir="$(cd "$(dirname "$0")" && pwd)"

${script_dir}/../go-bin/babysitter \
  --static_dir=${script_dir}/../go/babysitter/www \
  --use_ssl \
  --ssl_cert=${script_dir}/../ssl/generated/Certificate.crt \
  --ssl_key=${script_dir}/../ssl/generated/Key.key \
  "$@"

