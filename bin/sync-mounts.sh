#!/usr/bin/env bash
# Mirror the canonical `letterhead/` mount, byte-identical, to:
#   skills/letterhead/          so `npx skills add mperlak/letterhead` finds the
#                               skill at the conventional path (Codex too)
#   plugin/skills/letterhead/   the plugin folder: the Claude Code
#                               marketplace, Anthropic's plugin directory and
#                               the Cursor Marketplace install plugin/ only,
#                               without examples/ or the gallery
# and copy LICENSE to plugin/LICENSE. plugin/README.md and
# plugin/.claude-plugin/plugin.json and plugin/.cursor-plugin/plugin.json are
# edited by hand.
#
# Usage:
#   bin/sync-mounts.sh           # regenerate the mirrors
#   bin/sync-mounts.sh --check   # CI gate: exit 1 if a mirror drifts
#
# Source of truth is `letterhead/` only. Never edit the mirrors directly.

set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SRC="$ROOT/letterhead"
MIRRORS=("$ROOT/skills/letterhead" "$ROOT/plugin/skills/letterhead")

if [[ "${1:-}" == "--check" ]]; then
  drift=0
  for dst in "${MIRRORS[@]}"; do
    if ! diff -r -x .DS_Store "$SRC" "$dst" > /dev/null 2>&1; then
      echo "Mirror drift detected — ${dst#"$ROOT"/} differs from letterhead/."
      diff -rq -x .DS_Store "$SRC" "$dst" || true
      drift=1
    fi
  done
  if ! cmp -s "$ROOT/LICENSE" "$ROOT/plugin/LICENSE"; then
    echo "plugin/LICENSE differs from LICENSE."
    drift=1
  fi
  if [[ $drift -ne 0 ]]; then
    echo "Run bin/sync-mounts.sh and commit the result."
    exit 1
  fi
  echo "Mirrors in sync."
else
  for dst in "${MIRRORS[@]}"; do
    rm -rf "$dst"
    mkdir -p "$(dirname "$dst")"
    cp -R "$SRC" "$dst"
    find "$dst" -name .DS_Store -delete
  done
  cp "$ROOT/LICENSE" "$ROOT/plugin/LICENSE"
  echo "Mirrors regenerated at skills/letterhead and plugin/skills/letterhead."
fi
