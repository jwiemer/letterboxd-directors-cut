#!/bin/bash
# Mac/Linux version of build.bat (Director's Cut).
# Usage: ./build.sh chrome | firefox
# Bundles user.js with rollup, then assembles dist/<target> for "Load unpacked".
set -euo pipefail

TARGET="${1:-}"
if [[ "$TARGET" != "chrome" && "$TARGET" != "firefox" ]]; then
	echo "Usage: ./build.sh chrome | firefox"
	exit 1
fi

SOURCE_DIR="$(cd "$(dirname "$0")" && pwd)"
DIST_DIR="$SOURCE_DIR/dist/$TARGET"
cd "$SOURCE_DIR"

# Bundle the content script (rollup also tries build.bat; that error is harmless on a Mac)
npx rollup -c user.js/rollup.config.js

# Clean previous build, then copy common files, the bundle, and the target's manifest
rm -rf "$DIST_DIR"
mkdir -p "$DIST_DIR"
rsync -a --exclude node_modules "$SOURCE_DIR/common/" "$DIST_DIR/"
cp "$SOURCE_DIR/user.js/build/"* "$DIST_DIR/"
cp "$SOURCE_DIR/$TARGET/"* "$DIST_DIR/"

echo "Build complete: $DIST_DIR"
