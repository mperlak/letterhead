# vendor

`culori.mjs` (culori 4.0.2) and `node-html-parser.mjs` (node-html-parser
7.1.0) are npm packages bundled into single ES module files, so the scripts
run with no `npm install`. Each exports only what the scripts import; the
header of each file names the exports, the license and the version. Rebuild
both with `bash dev-scripts/build-vendor.sh` from the repository root, and do
not edit them by hand. License texts are in `THIRD-PARTY-LICENSES.md`.
