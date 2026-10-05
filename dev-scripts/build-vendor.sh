#!/usr/bin/env bash
# Rebuild the two library bundles in letterhead/scripts/vendor/.
#
# The skill runs with plain Node and no `npm install`, so the two libraries
# it needs (culori for color math, node-html-parser for reading documents)
# ship as single ES module files. This script installs the pinned versions
# into a temporary directory, bundles only the exports the scripts import,
# prepends a license header, and copies the result into place.
#
# Usage: bash dev-scripts/build-vendor.sh
# Needs: node and npm with network access. Nothing is installed in the repo.

set -euo pipefail

CULORI_VERSION="4.0.2"
PARSER_VERSION="7.1.0"
ESBUILD_VERSION="0.28.2"

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
VENDOR="$ROOT/letterhead/scripts/vendor"
WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT

cd "$WORK"
npm init -y > /dev/null
npm install --silent --no-audit --no-fund --save-exact \
  "culori@$CULORI_VERSION" \
  "node-html-parser@$PARSER_VERSION" \
  "esbuild@$ESBUILD_VERSION"

# Only what the scripts import. Add an export here before using it.
printf "export { converter, formatHex, parse, wcagContrast } from 'culori';\n" > culori.entry.mjs
printf "export { parse } from 'node-html-parser';\n" > node-html-parser.entry.mjs

bundle() {
  local name="$1" header="$2"
  ./node_modules/.bin/esbuild "$name.entry.mjs" --bundle --format=esm --platform=node \
    --outfile="$WORK/out/$name.mjs" --log-level=warning
  { printf '%s\n\n' "$header"; cat "$WORK/out/$name.mjs"; } > "$VENDOR/$name.mjs"
  echo "wrote $VENDOR/$name.mjs"
}

bundle culori "// culori $CULORI_VERSION, https://github.com/Evercoder/culori
// MIT License, Copyright (c) 2018 Dan Burzo. Full text: THIRD-PARTY-LICENSES.md.
// Exports: converter, formatHex, parse, wcagContrast.
// Built by dev-scripts/build-vendor.sh with esbuild $ESBUILD_VERSION. Do not edit by hand."

bundle node-html-parser "// node-html-parser $PARSER_VERSION, https://github.com/taoqf/node-html-parser
// MIT License, Copyright 2019 Tao Qiufeng. Includes he (MIT) and css-select,
// css-what, domhandler, domutils, dom-serializer, domelementtype, entities,
// nth-check, boolbase (BSD-2-Clause, MIT, ISC). Full texts: THIRD-PARTY-LICENSES.md.
// Exports: parse.
// Built by dev-scripts/build-vendor.sh with esbuild $ESBUILD_VERSION. Do not edit by hand."
