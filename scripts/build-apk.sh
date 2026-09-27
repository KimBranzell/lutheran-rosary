#!/bin/bash
# Bygg och signera TWA-APK:n från ett redan initierat projekt.
#
# Krav:
#   - Node 24, JDK 17 och Android SDK (sätt JAVA_HOME/ANDROID_HOME, eller använd
#     /mnt/development/toolchains/env.sh om den verktygskedjan används)
#   - android/ initierat (scripts/init-twa.sh, eller twa-manifest.json på plats)
#   - BUBBLEWRAP_KEYSTORE_PASSWORD och BUBBLEWRAP_KEY_PASSWORD satta
#
# Användning:
#   export BUBBLEWRAP_KEYSTORE_PASSWORD=... BUBBLEWRAP_KEY_PASSWORD=...
#   SIGNING_KEY_PATH=/sökväg/till/keystore.jks SIGNING_KEY_ALIAS=mitt-alias ./scripts/build-apk.sh

set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
ANDROID_DIR="$ROOT/android"

if [ ! -f "$ANDROID_DIR/twa-manifest.json" ]; then
  echo "Fel: $ANDROID_DIR/twa-manifest.json saknas. Initiera projektet först." >&2
  exit 1
fi

if [ -z "${BUBBLEWRAP_KEYSTORE_PASSWORD:-}" ] || [ -z "${BUBBLEWRAP_KEY_PASSWORD:-}" ]; then
  echo "Fel: sätt BUBBLEWRAP_KEYSTORE_PASSWORD och BUBBLEWRAP_KEY_PASSWORD." >&2
  exit 1
fi

# Om inget annat anges används signeringsnyckeln som står i twa-manifest.json.
BUILD_ARGS=(--manifest=twa-manifest.json)
if [ -n "${SIGNING_KEY_PATH:-}" ]; then
  BUILD_ARGS+=(--signingKeyPath="$SIGNING_KEY_PATH")
fi
if [ -n "${SIGNING_KEY_ALIAS:-}" ]; then
  BUILD_ARGS+=(--signingKeyAlias="$SIGNING_KEY_ALIAS")
fi

# Bubblewrap kör ./gradlew från aktuell katalog, så vi måste stå i projektet.
cd "$ANDROID_DIR"

echo "Bygger TWA (paket: $(node -p "require('./twa-manifest.json').packageId")) ..."
npx --yes @bubblewrap/cli@1.25.0 build "${BUILD_ARGS[@]}"

echo
echo "Klart:"
ls -lh app-release-signed.apk app-release-bundle.aab 2>/dev/null || true
echo
echo "Installera på ansluten telefon:  adb install -r app-release-signed.apk"
echo "Digital Asset Links (måste ligga på /.well-known/assetlinks.json):"
echo "  npx @bubblewrap/cli fingerprint generateAssetLinks --output=assetlinks.json"
