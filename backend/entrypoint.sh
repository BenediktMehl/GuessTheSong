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

# Ensure runtime user owns the copied certificates when running as root
if [ "$(id -u)" -eq 0 ]; then
	chown node:node /tmp/certs/fullchain.pem /tmp/certs/privkey.pem
fi

# Execute the Node.js application
if [ "$(id -u)" -eq 0 ]; then
	if command -v su-exec >/dev/null 2>&1; then
		exec su-exec node node index.js
	else
		exec su node -s /bin/sh -c "node index.js"
	fi
else
	exec node index.js
fi

