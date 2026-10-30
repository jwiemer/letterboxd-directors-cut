#!/bin/bash
# Mac/Linux version of build.bat (Director's Cut).
# Usage: ./build.sh chrome | firefox | safari
# Bundles user.js with rollup, then assembles dist/<target> for "Load unpacked".
set -euo pipefail

TARGET="${1:-}"
if [[ "$TARGET" != "chrome" && "$TARGET" != "firefox" && "$TARGET" != "safari" ]]; then
	echo "Usage: ./build.sh chrome | firefox | safari"
	exit 1
fi

SOURCE_DIR="$(cd "$(dirname "$0")" && pwd)"
DIST_DIR="$SOURCE_DIR/dist/$TARGET"
cd "$SOURCE_DIR"

# Bundle using the installed dependency; no package manager or network needed here.
./node_modules/.bin/rollup -c user.js/rollup.config.js

# Clean previous build, then copy common files, the bundle, and the target's manifest
rm -rf "$DIST_DIR"
mkdir -p "$DIST_DIR"
rsync -a --exclude node_modules "$SOURCE_DIR/common/" "$DIST_DIR/"
cp "$SOURCE_DIR/user.js/build/"* "$DIST_DIR/"
cp "$SOURCE_DIR/$TARGET/"* "$DIST_DIR/"
# Director's Cut features (src/plus/) ship as separate content scripts
rsync -a "$SOURCE_DIR/plus/" "$DIST_DIR/plus/"

# Director's Cut version: the manifest keeps upstream's number (so merges stay clean);
# the built copy gets ours from plus/VERSION, or DC_VERSION when the release Action sets it from the tag
DC_VERSION="${DC_VERSION:-$(tr -d '[:space:]' < "$SOURCE_DIR/plus/VERSION")}"
sed -i.bak -E "s/\"version\": \"[^\"]+\"/\"version\": \"$DC_VERSION\"/" "$DIST_DIR/manifest.json" && rm "$DIST_DIR/manifest.json.bak"
rm -f "$DIST_DIR/plus/VERSION"

echo "Build complete: $DIST_DIR"
