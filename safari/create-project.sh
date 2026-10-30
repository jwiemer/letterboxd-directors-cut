#!/bin/bash
# Run after: cd src && npm install && ./build.sh safari
set -euo pipefail
ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
if [[ ! -f "$ROOT_DIR/src/dist/safari/manifest.json" ]]; then
  echo "Build the Safari extension first: cd src && npm install && ./build.sh safari" >&2
  exit 1
fi
if [[ -d "$ROOT_DIR/safari/Directors Cut/Directors Cut.xcodeproj" ]]; then
  echo "The iOS project already exists. Open safari/Directors Cut/Directors Cut.xcodeproj in Xcode."
  exit 0
fi
# Reference dist/safari so subsequent builds update the app's extension resources.
xcrun safari-web-extension-converter "$ROOT_DIR/src/dist/safari" \
  --project-location "$ROOT_DIR/safari" \
  --app-name "Directors Cut" \
  --bundle-identifier com.jwiemer.letterboxd.directorscut \
  --swift --ios-only --no-open --no-prompt
