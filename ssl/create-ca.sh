#!/usr/bin/env bash

set -e

out_dir=generated
mkdir -p "$out_dir"

ca_private_key="${out_dir}/ca_private.key"
ca_root_cert="${out_dir}/ca_root.pem"
ca_root_p12="${out_dir}/ca_root.p12"

################################################################################
##### CHANGE THESE FIELDS #####
common_name="localhost"
subject_string="/C=US/ST=CA/L=SF/O=Evil Corporation/OU=Accounting/CN=${common_name}"
################################################################################

# Create a private key for the CA
echo "> Creating CA private key..."
openssl genrsa -des3 -out "$ca_private_key" 4096

# Generate a root certificate for the CA using the private key
echo ""
echo "> Creating CA root certificate..."
openssl req -x509 -new -nodes -key "$ca_private_key" -sha256 -days 365 -out "$ca_root_cert" \
  -subj "$subject_string"

