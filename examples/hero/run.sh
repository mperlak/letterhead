#!/usr/bin/env bash
# Generate the two documents behind the README hero.
#
#   bash examples/hero/run.sh [<run-dir>] [before|after|both]
#
# Each side runs in a fresh directory outside any repo (so no project
# CLAUDE.md or .letterhead/ profile leaks in) with copies of the same two
# inputs, the same prompt (PROMPT.md) and the same model. Both sides load this
# repo as a plugin; the only difference is --disable-slash-commands on the
# "before" side, which turns every skill off. --setting-sources project,local
# keeps user-level skills and plugins out of both runs; Artifact publishing is
# disabled in both so neither run posts anything. Requires an authenticated
# `claude` CLI (`claude auth status`).
set -euo pipefail

HERE="$(cd "$(dirname "$0")" && pwd)"
REPO="$(cd "$HERE/../.." && pwd)"
OUT="${1:-${TMPDIR:-/tmp}/letterhead-hero-runs}"
SIDES="${2:-both}"
MODEL="${MODEL:-opus}"
PROMPT="$(cat "$HERE/PROMPT.md")"

run_side() {
  local side="$1" dir="$OUT/$1"
  local extra=()
  [ "$side" = before ] && extra=(--disable-slash-commands)
  rm -rf "$dir" && mkdir -p "$dir"
  cp "$HERE/arkona-site.html" "$HERE/NOTES.md" "$dir/"
  local start end
  start=$(date +%s)
  (
    cd "$dir"
    claude -p "$PROMPT" \
      --model "$MODEL" \
      --setting-sources project,local \
      --plugin-dir "$REPO" \
      ${extra[@]+"${extra[@]}"} \
      --permission-mode acceptEdits \
      --allowedTools "Read Write Edit Bash Skill" \
      --disallowedTools "Artifact ArtifactComments ArtifactData" \
      --output-format stream-json --verbose \
      < /dev/null > transcript.jsonl
  )
  end=$(date +%s)
  echo "$side: $((end - start)) s wall time" | tee "$dir/wall-time.txt"
  node "$HERE/summarize.mjs" "$dir/transcript.jsonl" | tee "$dir/summary.txt"
}

case "$SIDES" in
  before|after) run_side "$SIDES" ;;
  both) run_side before; run_side after ;;
  *) echo "usage: run.sh [<run-dir>] [before|after|both]" >&2; exit 1 ;;
esac

echo
echo "Outputs in $OUT/{before,after}/status-update.html"
echo "If a side stopped to ask for a yes, continue it in its directory with:"
echo "  (cd $OUT/<side> && claude -p 'yes, go ahead' --continue --model $MODEL --setting-sources project,local --plugin-dir $REPO [--disable-slash-commands] --permission-mode acceptEdits --allowedTools 'Read Write Edit Bash Skill')"
