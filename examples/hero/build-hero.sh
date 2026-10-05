#!/usr/bin/env bash
# Screenshot before-slop.html and after.html (light and dark) and compose the README
# hero images.
#
#   bash examples/hero/build-hero.sh [<before-slop.html>] [<after.html>]
#
# Needs a Chromium headless shell (Playwright's cached one is found
# automatically, or set CHROME=/path/to/chrome-headless-shell) and cwebp.
# Intermediate PNGs go to $WORK (default: a temp dir), never into the repo.
set -euo pipefail

HERE="$(cd "$(dirname "$0")" && pwd)"
REPO="$(cd "$HERE/../.." && pwd)"
BEFORE="$(cd "$(dirname "${1:-$HERE/before-slop.html}")" && pwd)/$(basename "${1:-$HERE/before-slop.html}")"
AFTER="$(cd "$(dirname "${2:-$HERE/after.html}")" && pwd)/$(basename "${2:-$HERE/after.html}")"
WORK="${WORK:-$(mktemp -d "${TMPDIR:-/tmp}/letterhead-hero.XXXXXX")}"
DEST="${DEST:-$REPO/examples/screenshots}"
SHOT_W="${SHOT_W:-1200}"   # CSS px of each document's first screen
SHOT_H="${SHOT_H:-1500}"
QUALITY="${QUALITY:-82}"

CHROME="${CHROME:-$(ls -d "$HOME"/Library/Caches/ms-playwright/chromium_headless_shell-*/chrome-headless-shell-*/chrome-headless-shell 2>/dev/null | tail -1)}"
[ -x "$CHROME" ] || { echo "No chrome-headless-shell found; set CHROME=" >&2; exit 1; }
command -v cwebp >/dev/null || { echo "cwebp not found" >&2; exit 1; }
mkdir -p "$WORK" "$DEST"

shoot() { # <url> <out.png> <width> <height> <light|dark>
  local scheme=()
  [ "$5" = dark ] && scheme=(--force-dark-mode --blink-settings=preferredColorScheme=0)
  "$CHROME" --disable-gpu --hide-scrollbars --force-device-scale-factor=2 \
    --window-size="$3,$4" --virtual-time-budget=10000 \
    --allow-file-access-from-files ${scheme[@]+"${scheme[@]}"} \
    --screenshot="$2" "$1" >/dev/null 2>&1
  echo "  $2"
}

echo "Screenshots -> $WORK"
for theme in light dark; do
  shoot "file://$BEFORE" "$WORK/before-$theme.png" "$SHOT_W" "$SHOT_H" "$theme"
  shoot "file://$AFTER"  "$WORK/after-$theme.png"  "$SHOT_W" "$SHOT_H" "$theme"
done

# compose.html: body 1200 wide, 44px side padding, 36px gap -> each frame is
# 538 px wide with a 1 px border, so the image is 536 px wide. Everything
# that is not the image adds up to 194 px of height.
IMG_H=$(( 536 * SHOT_H / SHOT_W ))
COMPOSE_H=$(( IMG_H + 194 ))

echo "Compose (1200x$COMPOSE_H CSS px @2x)"
for theme in light dark; do
  url="file://$HERE/compose.html?theme=$theme&before=file://$WORK/before-$theme.png&after=file://$WORK/after-$theme.png"
  shoot "$url" "$WORK/hero-$theme.png" 1200 "$COMPOSE_H" light
  cwebp -quiet -q "$QUALITY" -m 6 "$WORK/hero-$theme.png" -o "$DEST/hero-before-after-$theme.webp"
  echo "  $DEST/hero-before-after-$theme.webp ($(du -k "$DEST/hero-before-after-$theme.webp" | cut -f1) KB)"
done
