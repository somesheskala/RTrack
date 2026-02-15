#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
WEB_DIR="$ROOT_DIR/mobile-web"

mkdir -p "$WEB_DIR"

# Clear old build output.
find "$WEB_DIR" -mindepth 1 -maxdepth 1 -exec rm -rf {} +

# Copy static app files used by the web app.
cp "$ROOT_DIR/index.html" "$WEB_DIR/index.html"
cp "$ROOT_DIR/styles.css" "$WEB_DIR/styles.css"
cp "$ROOT_DIR/app.js" "$WEB_DIR/app.js"
cp "$ROOT_DIR/utils.js" "$WEB_DIR/utils.js"
cp "$ROOT_DIR/config.js" "$WEB_DIR/config.js"
cp "$ROOT_DIR/icon.svg" "$WEB_DIR/icon.svg"
cp "$ROOT_DIR/manifest.webmanifest" "$WEB_DIR/manifest.webmanifest"
cp "$ROOT_DIR/sw.js" "$WEB_DIR/sw.js"

echo "Mobile web bundle prepared in: $WEB_DIR"
