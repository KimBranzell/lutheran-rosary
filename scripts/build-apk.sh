#!/bin/bash
# Build the signed APK using Bubblewrap.
# Prerequisites:
#   - PWA_ORIGIN environment variable set to the HTTPS origin
#   - The android/ directory must exist (run init-twa.sh first)
#   - Node.js 24.20.0, JDK 17, Android SDK

set -euo pipefail

if [ -z "${PWA_ORIGIN:-}" ]; then
  echo "Error: PWA_ORIGIN environment variable is not set."
  exit 1
fi

if [ ! -d "android" ]; then
  echo "Error: android/ directory not found. Run ./scripts/init-twa.sh first."
  exit 1
fi

echo "Validating PWA at $PWA_ORIGIN..."
npx --yes @bubblewrap/cli@1.25.0 validate --url="$PWA_ORIGIN"

echo ""
echo "Building APK..."
npx --yes @bubblewrap/cli@1.25.0 build --manifest=android/twa-manifest.json

echo ""
echo "Build complete. Signed APK: android/app-release-signed.apk"
echo ""
echo "To install on a connected device:"
echo "  adb install android/app-release-signed.apk"
echo ""
echo "To generate Digital Asset Links:"
echo "  npx @bubblewrap/cli fingerprint generateAssetLinks --output=public/.well-known/assetlinks.json"
echo ""
echo "Then deploy public/.well-known/assetlinks.json to $PWA_ORIGIN/.well-known/assetlinks.json"
