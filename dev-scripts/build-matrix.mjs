#!/usr/bin/env node
// Template x style matrix builder.
//
// Renders every template's sample body (dev-scripts/matrix-bodies/*.html,
// written in the shared markup of letterhead/reference/markup.md) in every
// style, through letterhead/scripts/apply-tokens.mjs exactly as an agent
// would: fonts, the style's tokens and its style.css. No CSS of its own, so
// what differs between two styles is what the styles ship. Then runs
// check-document.mjs on each output. CI fails when any combination has an
// error.
//
// Usage:
//   node dev-scripts/build-matrix.mjs                    # temp/matrix/, styles alone
//   node dev-scripts/build-matrix.mjs --brand <profile>  # temp/matrix-<brand>/: the
//                                                        # brand profile in every style
//   --keep is accepted and ignored (outputs always stay in temp/).

import { readFileSync, writeFileSync, mkdirSync, readdirSync } from 'node:fs';
import { join, dirname, basename, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const BODIES = join(ROOT, 'dev-scripts', 'matrix-bodies');
const STYLES = join(ROOT, 'letterhead', 'styles');
const APPLY = join(ROOT, 'letterhead', 'scripts', 'apply-tokens.mjs');

let brand = null;
for (let i = 2; i < process.argv.length; i++) {
  const a = process.argv[i];
  if (a === '--brand') brand = resolve(process.argv[++i] || '');
  else if (a !== '--keep') { console.error(`unknown option ${a}`); process.exit(1); }
}
const OUT = join(ROOT, 'temp', brand ? `matrix-${basename(brand)}` : 'matrix');

function shell(title, description, body) {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${title}</title>
<link rel="icon" href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16'%3E%3Crect width='16' height='16' fill='%23555555'/%3E%3C/svg%3E">
<meta property="og:title" content="${title}">
<meta property="og:description" content="${description}">
<meta property="og:type" content="article">
<meta name="twitter:card" content="summary">
</head>
<body>
<main class="doc">
${body}
</main>
</body>
</html>
`;
}

const bodies = readdirSync(BODIES).filter((f) => f.endsWith('.html')).sort();
const styles = readdirSync(STYLES, { withFileTypes: true }).filter((d) => d.isDirectory() && !d.name.startsWith('.')).map((d) => d.name).sort();
if (bodies.length === 0 || styles.length === 0) {
  console.error('matrix: no bodies or no styles found');
  process.exit(1);
}

mkdirSync(OUT, { recursive: true });
const files = [];
for (const bodyFile of bodies) {
  const template = basename(bodyFile, '.html');
  const raw = readFileSync(join(BODIES, bodyFile), 'utf8');
  const titleMatch = raw.match(/^<!--\s*title:\s*(.+?)\s*-->/m);
  const descMatch = raw.match(/^<!--\s*description:\s*(.+?)\s*-->/m);
  const title = titleMatch ? titleMatch[1] : template;
  const desc = descMatch ? descMatch[1] : `Matrix sample for ${template}.`;
  const body = raw.replace(/^<!--[\s\S]*?-->\n?/g, '').trim();
  for (const style of styles) {
    const out = join(OUT, `${template}--${style}.html`);
    writeFileSync(out, shell(title, desc, body));
    const args = brand ? [APPLY, brand, out, '--style', style] : [APPLY, join(STYLES, style, 'tokens.css'), out];
    const res = spawnSync('node', args, { encoding: 'utf8' });
    if (res.status !== 0) {
      console.error(`apply-tokens failed for ${basename(out)}:\n${res.stderr}${res.stdout}`);
      process.exit(1);
    }
    if (res.stderr.trim()) console.error(`${basename(out)}: ${res.stderr.trim()}`);
    files.push(out);
  }
}
console.log(`matrix: built ${files.length} documents (${bodies.length} templates x ${styles.length} styles${brand ? ` under ${basename(brand)}` : ''}) in ${OUT.slice(ROOT.length + 1)}/`);

function run(script, args) {
  return spawnSync('node', [join(ROOT, script), ...args], { encoding: 'utf8' });
}

let failed = 0;
for (const f of files) {
  const res = run('letterhead/scripts/check-document.mjs', [f]);
  if (res.status !== 0) {
    failed++;
    console.error(`✗ ${basename(f)}`);
    console.error(`${res.stdout}${res.stderr}`.trim().split('\n').slice(-8).join('\n'));
  }
}
if (failed) {
  console.error(`matrix: ${failed}/${files.length} combinations have errors`);
  process.exit(1);
}
console.log(`matrix: all ${files.length} combinations clean (no errors)`);
