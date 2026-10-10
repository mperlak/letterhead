#!/usr/bin/env bash
# Build the upload copies that dev-scripts/promo/submission-kit.md lists, in
# temp/submission/ (git-ignored):
#   screenshots/*.png       PNG copies of examples/screenshots/*.webp, since
#                           most directory upload forms reject WebP
#   icon.png, social-preview.png
#   letterhead-plugin.zip   plugin/ for OpenAI's "Skills only" upload, without
#                           the Cursor manifest
#
# Needs dwebp (brew install webp) and zip.

set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
OUT="$ROOT/temp/submission"
SHOTS=(
  hero-before-after-light
  status-update--arkona-light
  brand-sheet--arkona-light
  proposal--halde-light
  meeting-notes--fieldwork-mobile
  styles-contact-sheet
  presentation--bunnyfeelshome-light
)

rm -rf "$OUT"
mkdir -p "$OUT/screenshots"
for name in "${SHOTS[@]}"; do
  dwebp -quiet "$ROOT/examples/screenshots/$name.webp" -o "$OUT/screenshots/$name.png"
done
cp "$ROOT/plugin/icon.png" "$ROOT/examples/screenshots/social-preview.png" "$OUT/"
(cd "$ROOT/plugin" && zip -qr -X "$OUT/letterhead-plugin.zip" . -x '.cursor-plugin/*' -x '*.DS_Store')
echo "Submission assets in ${OUT#"$ROOT"/}."
