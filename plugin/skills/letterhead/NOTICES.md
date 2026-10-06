# Notices

Everything in this skill is original work under its MIT license (`LICENSE`),
except the fonts in `fonts/` (below) and two open-source libraries bundled into single files so the scripts run
on plain Node 18+ with no `npm install`:

| File | Package | Version | License | Upstream |
|---|---|---|---|---|
| `scripts/vendor/culori.mjs` | culori | 4.0.2 | MIT | https://github.com/Evercoder/culori |
| `scripts/vendor/node-html-parser.mjs` | node-html-parser | 7.1.0 | MIT | https://github.com/taoqf/node-html-parser |

The node-html-parser bundle also contains the packages it depends on: he
(MIT), css-select, css-what, domhandler, domutils, domelementtype, entities
and nth-check (BSD-2-Clause), dom-serializer (MIT) and boolbase (ISC).
Full license texts: `THIRD-PARTY-LICENSES.md`.

Each bundle carries only the exports the scripts import. To rebuild them, or
to add an export, run `bash dev-scripts/build-vendor.sh` from the repository
root. It installs the pinned versions into a temporary directory, bundles
them with esbuild, and writes both files with their license header.

## Fonts

`fonts/` holds the typefaces the shipped styles name, subset to Latin and
stored as woff2. `scripts/apply-tokens.mjs` embeds them into documents as
`data:` URIs. All of them are under the SIL Open Font License 1.1 (OFL-1.1),
which allows bundling and embedding them; the full license text, with each
family's copyright line, sits next to the files in `fonts/<family>/OFL.txt`.
The files come from the google/fonts repository at the commit recorded in
`fonts/fonts.json`, fetched and subset by `dev-scripts/vendor-fonts.sh`.

| Family | Folder | Copyright |
|---|---|---|
| Archivo | `fonts/archivo/` | Copyright 2020 The Archivo Project Authors |
| Charis SIL | `fonts/charis-sil/` | Copyright (c) 1997-2022 SIL International |
| Fraunces | `fonts/fraunces/` | Copyright 2018 The Fraunces Project Authors |
| IBM Plex Mono | `fonts/ibm-plex-mono/` | Copyright 2017 IBM Corp., Reserved Font Name "Plex" |
| IBM Plex Sans | `fonts/ibm-plex-sans/` | Copyright 2017 IBM Corp., Reserved Font Name "Plex" |
| Inter | `fonts/inter/` | Copyright 2020 The Inter Project Authors |
| JetBrains Mono | `fonts/jetbrains-mono/` | Copyright 2020 The JetBrains Mono Project Authors |
| Newsreader | `fonts/newsreader/` | Copyright 2020 The Newsreader Project Authors |
| Nunito Sans | `fonts/nunito-sans/` | Copyright 2016 The Nunito Sans Project Authors |
| Public Sans | `fonts/public-sans/` | Copyright 2015 The Public Sans Project Authors |
| Rubik | `fonts/rubik/` | Copyright 2015 The Rubik Project Authors |
| Source Sans 3 | `fonts/source-sans-3/` | Copyright 2010-2020 Adobe, Reserved Font Name 'Source' |
| Source Serif 4 | `fonts/source-serif-4/` | Copyright 2014 The Source Serif 4 Project Authors |
| Space Grotesk | `fonts/space-grotesk/` | Copyright 2020 The Space Grotesk Project Authors |
