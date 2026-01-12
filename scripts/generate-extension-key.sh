#!/bin/bash
# Generate a Chrome extension key and add to .env
#
# This creates a consistent extension ID across dev/prod builds.
# The key is required for Auth0 callback URLs to work correctly.

set -e

# Check if key already exists with a real value
if [ -f .env ]; then
  EXISTING_KEY=$(grep "^VITE_EXTENSION_KEY=" .env 2>/dev/null | cut -d'=' -f2- || true)

  # If key exists and is not empty/placeholder, refuse to override
  if [ -n "$EXISTING_KEY" ] && [ "$EXISTING_KEY" != "your-extension-key" ]; then
    echo "Error: VITE_EXTENSION_KEY already exists in .env"
    echo "If you want to regenerate, delete the line from .env first."
    exit 1
  fi
fi

# Generate RSA key pair
echo "Generating extension key..."
openssl genrsa 2048 2>/dev/null | openssl pkcs8 -topk8 -nocrypt -out extension.pem

# Extract public key in base64 format for manifest
KEY=$(openssl rsa -in extension.pem -pubout -outform DER 2>/dev/null | openssl base64 -A)

# Add to .env
if grep -q "^VITE_EXTENSION_KEY=" .env 2>/dev/null; then
  # Update existing empty/placeholder key
  sed -i "s|^VITE_EXTENSION_KEY=.*|VITE_EXTENSION_KEY=$KEY|" .env
else
  # Append new key
  echo "" >> .env
  echo "# Chrome extension key for consistent extension ID" >> .env
  echo "VITE_EXTENSION_KEY=$KEY" >> .env
fi

echo "Extension key generated and saved to .env"
echo "Keep extension.pem safe - it's your private key!"
echo ""
echo "Next steps:"
echo "1. Run 'npm run build' to build with the new key"
echo "2. Load extension in Chrome to get your extension ID"
echo "3. Update Auth0 callback URLs with the new ID"
