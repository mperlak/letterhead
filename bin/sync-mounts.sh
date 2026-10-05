#!/usr/bin/env bash
# Mirror the canonical `letterhead/` mount to `skills/letterhead/`,
# byte-identical. The mirror exists so `npx skills add mperlak/letterhead`
# finds the skill at the conventional path.
#
# Usage:
#   bin/sync-mounts.sh           # regenerate the mirror
#   bin/sync-mounts.sh --check   # CI gate: exit 1 if the mirror drifts
#
# Source of truth is `letterhead/` only. Never edit the mirror directly.

set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SRC="$ROOT/letterhead"
DST="$ROOT/skills/letterhead"

if [[ "${1:-}" == "--check" ]]; then
  if diff -r "$SRC" "$DST" > /dev/null 2>&1; then
    echo "Mirror in sync."
  else
    echo "Mirror drift detected — skills/letterhead differs from letterhead/."
    echo "Run bin/sync-mounts.sh and commit the result."
    diff -rq "$SRC" "$DST" || true
    exit 1
  fi
else
  rm -rf "$DST"
  mkdir -p "$(dirname "$DST")"
  cp -R "$SRC" "$DST"
  echo "Mirror regenerated at skills/letterhead."
fi
