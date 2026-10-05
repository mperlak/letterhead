#!/usr/bin/env bash
# Vendor the open fonts the shipped styles name into letterhead/fonts/.
#
# Every style's tokens.css names webfonts (Inter, Fraunces, IBM Plex, ...).
# A document that only names them shows system fallback type on any machine
# that lacks them, which is every reviewer's. apply-tokens.mjs embeds these
# files into the document as data: URIs, so the fonts travel with it and
# work offline.
#
# What this does, reproducibly:
#   1. Downloads the source TTFs from the google/fonts repository at a pinned
#      commit (all OFL-1.1), plus each family's OFL.txt.
#   2. Pins every axis except wght (opsz, wdth, SOFT, ...) and limits wght to
#      the range the styles use, with fontTools' instancer.
#   3. Subsets to Latin-1 + Latin Extended-A (+ Romanian comma accents, the
#      general punctuation block, euro, arrows, math signs), so Polish,
#      Czech, Nordic, Dutch, German and French text renders from one file per
#      face, drops hinting, writes woff2.
#   4. Writes letterhead/fonts/fonts.json: family -> faces (file, weight
#      range, style, priority) and the source + license per family.
#
# Usage (from the repository root):
#   bash dev-scripts/vendor-fonts.sh
#
# Needs curl and python3 (it installs fonttools + brotli into temp/.fontenv).
# Re-running replaces letterhead/fonts/ wholesale; the output is
# deterministic for a given commit and fonttools version.

set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
OUT="$ROOT/letterhead/fonts"
WORK="$ROOT/temp/font-src"
VENV="$ROOT/temp/.fontenv"
COMMIT="9710da1eacb3be272583c3224dcb70f9da6eadbb"   # google/fonts main, 2026-09-30
FONTTOOLS="4.66.1"
RAW="https://raw.githubusercontent.com/google/fonts/$COMMIT/ofl"

if [[ ! -x "$VENV/bin/python" ]]; then
  python3 -m venv "$VENV"
fi
"$VENV/bin/pip" install -q "fonttools==$FONTTOOLS" brotli

mkdir -p "$WORK"
rm -rf "$OUT"
mkdir -p "$OUT"

# family | repo dir | source file | out file | axis pins / wght range | weight | style | priority
# priority: core faces are always embedded; extra faces go first when a
# document is over the font budget.
SPEC=$(cat <<'EOF'
Inter|inter|Inter[opsz,wght].ttf|Inter.woff2|opsz=14 wght=400:700|400 700|normal|core
Source Serif 4|sourceserif4|SourceSerif4[opsz,wght].ttf|SourceSerif4.woff2|opsz=32 wght=400:700|400 700|normal|core
Charis SIL|charissil|CharisSIL-Regular.ttf|CharisSIL-Regular.woff2|-|400|normal|core
Charis SIL|charissil|CharisSIL-Bold.ttf|CharisSIL-Bold.woff2|-|700|normal|core
Newsreader|newsreader|Newsreader[opsz,wght].ttf|Newsreader.woff2|opsz=16 wght=400:800|400 800|normal|core
Newsreader|newsreader|Newsreader-Italic[opsz,wght].ttf|Newsreader-Italic.woff2|opsz=16 wght=400|400|italic|extra
Archivo|archivo|Archivo[wdth,wght].ttf|Archivo.woff2|wdth=100 wght=500:800|500 800|normal|core
Source Sans 3|sourcesans3|SourceSans3[wght].ttf|SourceSans3.woff2|wght=400:700|400 700|normal|core
IBM Plex Sans|ibmplexsans|IBMPlexSans[wdth,wght].ttf|IBMPlexSans.woff2|wdth=100 wght=400:700|400 700|normal|core
IBM Plex Mono|ibmplexmono|IBMPlexMono-Regular.ttf|IBMPlexMono-Regular.woff2|-|400|normal|core
IBM Plex Mono|ibmplexmono|IBMPlexMono-SemiBold.ttf|IBMPlexMono-SemiBold.woff2|-|600|normal|core
Public Sans|publicsans|PublicSans[wght].ttf|PublicSans.woff2|wght=400:800|400 800|normal|core
Space Grotesk|spacegrotesk|SpaceGrotesk[wght].ttf|SpaceGrotesk.woff2|wght=500:700|500 700|normal|core
JetBrains Mono|jetbrainsmono|JetBrainsMono[wght].ttf|JetBrainsMono.woff2|wght=400:600|400 600|normal|extra
Rubik|rubik|Rubik[wght].ttf|Rubik.woff2|wght=400:700|400 700|normal|core
Nunito Sans|nunitosans|NunitoSans[YTLC,opsz,wdth,wght].ttf|NunitoSans.woff2|YTLC=500 opsz=12 wdth=100 wght=400:800|400 800|normal|core
Fraunces|fraunces|Fraunces[SOFT,WONK,opsz,wght].ttf|Fraunces.woff2|SOFT=50 WONK=0 opsz=36 wght=400:600|400 600|normal|core
EOF
)

UNICODES="U+0020-007E,U+00A0-00FF,U+0100-017F,U+0192,U+0218-021B,U+02C6,U+02C7,U+02D8-02DD,U+1E9E,U+2000-206F,U+20AC,U+2116,U+2122,U+2190-2193,U+2212,U+2215,U+2248,U+2260,U+2264,U+2265,U+FEFF,U+FFFD"

while IFS='|' read -r family dir src out pins weight style priority; do
  [[ -z "$family" ]] && continue
  slug="$(echo "$family" | tr '[:upper:] ' '[:lower:]-')"
  mkdir -p "$WORK/$dir" "$OUT/$slug"
  srcfile="$WORK/$dir/$src"
  if [[ ! -s "$srcfile" ]]; then
    curl -fsSL "$RAW/$dir/$(python3 -c 'import sys,urllib.parse;print(urllib.parse.quote(sys.argv[1]))' "$src")" -o "$srcfile"
  fi
  if [[ ! -s "$WORK/$dir/OFL.txt" ]]; then
    curl -fsSL "$RAW/$dir/OFL.txt" -o "$WORK/$dir/OFL.txt"
  fi
  cp "$WORK/$dir/OFL.txt" "$OUT/$slug/OFL.txt"
  inst="$WORK/$dir/instanced-$out.ttf"
  if [[ "$pins" == "-" ]]; then
    cp "$srcfile" "$inst"
  else
    # shellcheck disable=SC2086
    "$VENV/bin/fonttools" varLib.instancer "$srcfile" $pins -o "$inst" -q
  fi
  "$VENV/bin/pyftsubset" "$inst" \
    --unicodes="$UNICODES" \
    --layout-features+=tnum,lnum,pnum,onum,case,zero \
    --no-hinting --desubroutinize --flavor=woff2 \
    --name-IDs='*' --name-languages=0x0409 --drop-tables+=Silf,Glat,Gloc,Feat,Sill,DSIG \
    --output-file="$OUT/$slug/$out"
  printf '%s|%s|%s|%s|%s|%s|%s\n' "$family" "$slug" "$out" "$weight" "$style" "$priority" "$dir/$src" >> "$WORK/manifest.txt.tmp"
done <<< "$SPEC"

# fonts.json
"$VENV/bin/python" - "$WORK/manifest.txt.tmp" "$OUT" "$COMMIT" <<'PY'
import json, os, sys, hashlib
rows, out, commit = sys.argv[1], sys.argv[2], sys.argv[3]
fams = {}
for line in open(rows, encoding="utf8"):
    family, slug, f, weight, style, priority, src = line.rstrip("\n").split("|")
    path = os.path.join(out, slug, f)
    data = open(path, "rb").read()
    fam = fams.setdefault(family, {
        "license": "OFL-1.1",
        "licenseFile": f"{slug}/OFL.txt",
        "source": f"https://github.com/google/fonts/tree/{commit}/ofl/{src.split('/')[0]}",
        "faces": [],
    })
    fam["faces"].append({
        "file": f"{slug}/{f}", "weight": weight, "style": style, "priority": priority,
        "bytes": len(data), "sha256": hashlib.sha256(data).hexdigest(),
        "from": src.split("/", 1)[1],
    })
doc = {
    "about": "Fonts the shipped styles name, embedded into documents by scripts/apply-tokens.mjs. Generated by dev-scripts/vendor-fonts.sh; do not edit by hand.",
    "subset": "Latin-1, Latin Extended-A, Romanian comma accents, general punctuation, euro, arrows, basic math signs",
    "families": fams,
}
json.dump(doc, open(os.path.join(out, "fonts.json"), "w", encoding="utf8"), indent=2, ensure_ascii=False)
open(os.path.join(out, "fonts.json"), "a").write("\n")
total = sum(face["bytes"] for fam in fams.values() for face in fam["faces"])
for name, fam in fams.items():
    print(f"{name:16s} " + ", ".join(f"{f['weight']}{' italic' if f['style']=='italic' else ''}: {f['bytes']//1024} KB" for f in fam["faces"]))
print(f"total {total/1024:.0f} KB")
PY
rm -f "$WORK/manifest.txt.tmp"
