#!/usr/bin/env node
// Template x style matrix builder.
//
// Renders every template's sample body (dev-scripts/matrix-bodies/*.html)
// against every style's tokens (letterhead/styles/*/tokens.css) into
// temp/matrix/, then runs check-document.mjs on each output. CI fails when
// any combination has an error.
//
// Usage:
//   node dev-scripts/build-matrix.mjs           # build + check, exit 1 on errors
//   node dev-scripts/build-matrix.mjs --keep    # same, but say where outputs live
//
// The sample bodies are deliberately compact: they exercise each template's
// structure (metadata block, section rhythm, its signature table or list),
// not its full craft. The matrix proves token/structure compatibility.

import { readFileSync, writeFileSync, mkdirSync, readdirSync } from 'node:fs';
import { join, dirname, basename } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const BODIES = join(ROOT, 'dev-scripts', 'matrix-bodies');
const STYLES = join(ROOT, 'letterhead', 'styles');
const OUT = join(ROOT, 'temp', 'matrix');

// Base document CSS driven entirely by style tokens. Every rule reads
// var(--*) so each style re-colors and re-shapes the same semantic body.
const BASE_CSS = `
* { box-sizing: border-box; }
body { margin: 0; background: var(--background); color: var(--foreground);
  font-family: var(--font-sans); font-size: var(--text-base); line-height: var(--leading-normal); }
main { max-width: var(--measure, 44rem); margin: 0 auto; padding: 2.75rem 1.25rem 4.5rem; }
h1 { font-family: var(--font-display); font-size: var(--text-3xl); line-height: var(--leading-tight); margin: 0 0 0.5rem; }
h2 { font-family: var(--font-display); font-size: var(--text-xl); margin: var(--space-section, 2.75rem) 0 0.85rem;
  padding-top: 1.1rem; border-top: 1px solid var(--border); }
h3 { font-size: var(--text-lg); margin: 1.5rem 0 0.4rem; }
p { margin: 0.65rem 0; }
ul, ol { margin: 0.65rem 0; padding-left: 1.4rem; }
li { margin: 0.3rem 0; }
.subtitle { color: var(--muted-foreground); font-size: var(--text-lg); margin: 0 0 1.4rem; }
dl.meta { display: grid; grid-template-columns: auto 1fr; gap: 0.2rem 1.1rem; font-size: var(--text-sm); margin: 0 0 1rem; }
dl.meta dt { color: var(--muted-foreground); text-transform: uppercase; letter-spacing: var(--tracking-label, 0.05em);
  font-size: var(--text-xs); align-self: baseline; }
dl.meta dd { margin: 0; }
table { border-collapse: collapse; width: 100%; margin: 1rem 0; font-size: var(--text-sm); }
th { text-align: left; font-size: var(--text-xs); letter-spacing: var(--tracking-label, 0.05em); text-transform: uppercase;
  color: var(--muted-foreground); border-bottom: 2px solid var(--border); padding: 0.45rem 0.6rem; }
td { border-bottom: 1px solid var(--border); padding: 0.5rem 0.6rem; vertical-align: top; }
td.num { font-family: var(--font-mono); text-align: right; }
code { font-family: var(--font-mono); font-size: 0.85em; background: var(--muted); border: 1px solid var(--border);
  padding: 0.08em 0.3em; border-radius: var(--radius-sm); }
pre { background: var(--muted); border: 1px solid var(--border); border-radius: var(--radius-md); padding: 1rem;
  overflow-x: auto; font-family: var(--font-mono); font-size: var(--text-sm); line-height: 1.5; }
pre code { background: none; border: 0; padding: 0; }
.panel { background: var(--card); color: var(--card-foreground); border: 1px solid var(--border);
  border-radius: var(--radius-lg); padding: 1rem 1.15rem; margin: 1.2rem 0; }
.k { font-size: var(--text-xs); letter-spacing: var(--tracking-label, 0.05em); text-transform: uppercase;
  font-weight: 600; color: var(--accent-foreground); display: block; margin-bottom: 0.35rem; }
.state { font-size: var(--text-xs); font-weight: 600; letter-spacing: 0.02em; white-space: nowrap; }
.state.ok { color: var(--status-ok, var(--primary)); }
.state.warn { color: var(--status-warn, var(--muted-foreground)); }
.state.blocked { color: var(--status-blocked, var(--destructive)); }
@media (max-width: 640px) { main { padding-top: 2rem; } h1 { font-size: var(--text-2xl); } }
`;

function stripHeaderComment(css) {
  return css.replace(/^\/\*\*[\s\S]*?\*\/\n/, '').trim();
}

function shell(title, description, tokens, body) {
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
<style>
${tokens}

${BASE_CSS}
</style>
</head>
<body>
<main>
${body}
</main>
</body>
</html>
`;
}

const bodies = readdirSync(BODIES).filter((f) => f.endsWith('.html')).sort();
const styles = readdirSync(STYLES).filter((s) => !s.startsWith('.')).sort();
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
    const tokens = stripHeaderComment(readFileSync(join(STYLES, style, 'tokens.css'), 'utf8'));
    const out = join(OUT, `${template}--${style}.html`);
    writeFileSync(out, shell(title, desc, tokens, body));
    files.push(out);
  }
}
console.log(`matrix: built ${files.length} documents (${bodies.length} templates x ${styles.length} styles) in temp/matrix/`);

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
