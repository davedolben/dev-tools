#!/usr/bin/env bash

prefix="my_"
if [ ! -z "$1" ]; then
  prefix="$1"
  shift
fi

out_dir=generated

ca_private_key="${out_dir}/ca_private.key"
ca_root_cert="${out_dir}/ca_root.pem"

private_key="${out_dir}/${prefix}private.key"
signing_request="${out_dir}/${prefix}request.csr"
cert="${out_dir}/${prefix}cert.crt"
cert_p12="${out_dir}/${prefix}cert.p12"

################################################################################
##### CHANGE THESE FIELDS #####
common_name="localhost"
if [ ! -z "$1" ]; then
  common_name="$1"
  shift
fi
subject_string="/C=US/ST=CA/L=SF/O=Evil Corporation/OU=Accounting/CN=${common_name}"
################################################################################

# Create a private key
echo "> Creating a private key..."
openssl genrsa -out "$private_key" 4096

# Create a signing request using the private key
echo ""
echo "> Creating a signing request..."
openssl req -new -key "$private_key" -out "$signing_request" \
  -subj "$subject_string"

# Write out a v3.ext file to use in the below signing command
cat >v3.ext <<EOL
authorityKeyIdentifier=keyid,issuer
basicConstraints=CA:FALSE
keyUsage = digitalSignature, nonRepudiation, keyEncipherment, dataEncipherment
subjectAltName = @alt_names

[alt_names]
DNS.1 = ${common_name}
EOL

# Create a certificate from the signing request
echo ""
echo "> Creating certificate..."
openssl x509 -req \
  -in "$signing_request" \
  -CA "$ca_root_cert" \
  -CAkey "$ca_private_key" \
  -CAcreateserial \
  -out "$cert" \
  -days 365 \
  -sha256 \
  -extfile v3.ext

# Merge the two into a p12 file that can be imported into your OS
echo ""
echo "> Creating a merged p12 file..."
openssl pkcs12 -export -inkey "$private_key" -in "$cert" -out "$cert_p12"

