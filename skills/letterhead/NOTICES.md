# Notices

Everything in this skill is original work under its MIT license (`LICENSE`),
except two open-source libraries bundled into single files so the scripts run
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
