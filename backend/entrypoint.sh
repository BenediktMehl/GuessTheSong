#!/bin/sh
set -e

# Create target directory if it doesn't exist
mkdir -p /tmp/certs

# Copy certificates from source to writable location
cp /source-certs/fullchain.pem /tmp/certs/fullchain.pem
cp /source-certs/privkey.pem /tmp/certs/privkey.pem

# Set proper permissions on copied certificates
chmod 600 /tmp/certs/fullchain.pem
chmod 600 /tmp/certs/privkey.pem

# Execute the Node.js application
exec node index.js

