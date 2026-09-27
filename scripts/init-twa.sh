#!/bin/bash
# Initialize the Bubblewrap TWA project.
# Prerequisites:
#   - PWA_ORIGIN environment variable set to the HTTPS origin
#   - The PWA must be deployed and accessible at $PWA_ORIGIN/manifest.webmanifest
#   - Node.js 24.20.0, JDK 17, Android SDK

set -euo pipefail

if [ -z "${PWA_ORIGIN:-}" ]; then
  echo "Error: PWA_ORIGIN environment variable is not set."
  echo "Usage: PWA_ORIGIN=https://your-domain.com ./scripts/init-twa.sh"
  exit 1
fi

# Validate that PWA_ORIGIN is HTTPS
if [[ ! "$PWA_ORIGIN" =~ ^https:// ]]; then
  echo "Error: PWA_ORIGIN must be an HTTPS URL."
  exit 1
fi

# Check that the manifest is accessible
echo "Checking manifest at $PWA_ORIGIN/manifest.webmanifest..."
HTTP_STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$PWA_ORIGIN/manifest.webmanifest")
if [ "$HTTP_STATUS" != "200" ]; then
  echo "Error: Manifest not accessible (HTTP $HTTP_STATUS). Deploy the PWA first."
  exit 1
fi

echo "Manifest is accessible. Initializing Bubblewrap project..."

# Create android directory if it doesn't exist
mkdir -p android

# Run bubblewrap init
npx --yes @bubblewrap/cli@1.25.0 init \
  --manifest="$PWA_ORIGIN/manifest.webmanifest" \
  --directory=android

echo ""
echo "Bubblewrap project initialized in ./android/"
echo ""
echo "Next steps:"
echo "  1. Review and confirm the prompted values (package ID, signing key, etc.)"
echo "  2. Run: ./scripts/build-apk.sh"
echo "  3. Deploy the generated assetlinks.json to $PWA_ORIGIN/.well-known/assetlinks.json"
