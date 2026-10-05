#!/usr/bin/env node
// Uniform README/gallery screenshots.
//
// Every document gets the same crop: the top of the page at a fixed viewport
// (default 800 x 1000 CSS px, 4:5, 2x device scale), so title, metadata and the
// first section are visible and every thumbnail has identical dimensions. In a
// GitHub table each image is scaled to the column width, so a uniform aspect
// ratio is what keeps the grid tidy. Light and dark are both captured
// (emulated prefers-color-scheme), after document.fonts.ready.
//
// Usage:
//   node dev-scripts/screenshots.mjs <file.html>... [options]
//   node dev-scripts/screenshots.mjs --all [options]
//
// Output, per document <name> (the file name without .html; brand sheets are
// named brand-sheet--<brand>):
//   <out>/<name>-light.webp   <out>/<name>-dark.webp   [<out>/<name>-mobile.webp]
//
// Options:
//   --out <dir>        output directory (default examples/screenshots)
//   --all              examples/documents/*.html + examples/brands/*/brand-sheet.html
//   --mobile           also a 390x780 light phone shot per document
//   --grid             write <out>/README-grid.md: a paste-ready GitHub HTML table
//                      for the documents of this run (all of them when no files
//                      are given). With no files and --grid only, nothing is shot.
//   --link-base <url>  link thumbnails to <url>/documents/<file>, /brands/<brand>.html
//                      (the Pages gallery layout) instead of relative file paths
//   --width/--height   crop in CSS px (default 800 x 1000)
//   --scale <n>        device scale (default 2)
//   --quality <q>      starting webp quality (default 82); steps down to fit --max-kb
//   --max-kb <n>       size target per image (default 150)
//
// Needs Playwright's cached chrome-headless-shell (or CHROME=/path) and cwebp.
// Intermediates live in a temp dir, never in the repo.

import { readFileSync, writeFileSync, readdirSync, existsSync, mkdirSync } from 'node:fs';
import { join, dirname, basename, resolve, relative, sep } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { launchBrowser, encodeWebp, requireCwebp, makeWorkDir, rmWorkDir } from './lib/shoot.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const EXAMPLES = join(ROOT, 'examples');

function parseArgs(argv) {
  const o = { files: [], out: join(EXAMPLES, 'screenshots'), width: 800, height: 1000, scale: 2, quality: 82, maxKB: 150,
    all: false, mobile: false, grid: false, linkBase: '' };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    const val = () => argv[++i];
    if (a === '--out') o.out = resolve(val());
    else if (a === '--all') o.all = true;
    else if (a === '--mobile') o.mobile = true;
    else if (a === '--grid') o.grid = true;
    else if (a === '--link-base') o.linkBase = val().replace(/\/+$/, '');
    else if (a === '--width') o.width = Number(val());
    else if (a === '--height') o.height = Number(val());
    else if (a === '--scale') o.scale = Number(val());
    else if (a === '--quality') o.quality = Number(val());
    else if (a === '--max-kb') o.maxKB = Number(val());
    else if (a.startsWith('--')) { console.error(`unknown option ${a}`); process.exit(1); }
    else o.files.push(resolve(a));
  }
  return o;
}

export function allDocuments() {
  const out = [];
  const docs = join(EXAMPLES, 'documents');
  if (existsSync(docs)) for (const f of readdirSync(docs).sort()) if (f.endsWith('.html')) out.push(join(docs, f));
  const brands = join(EXAMPLES, 'brands');
  if (existsSync(brands)) {
    for (const b of readdirSync(brands).sort()) {
      const p = join(brands, b, 'brand-sheet.html');
      if (existsSync(p)) out.push(p);
    }
  }
  return out;
}

/** Image base name: <file> without .html; brand-sheet.html becomes brand-sheet--<parent dir>. */
export function shotName(file) {
  const base = basename(file, '.html');
  return base === 'brand-sheet' ? `brand-sheet--${basename(dirname(file))}` : base;
}

// ---------------------------------------------------------------- grid

const decode = (s) => s.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
  .replace(/&quot;/g, '"').replace(/&#0?39;/g, "'").replace(/&nbsp;/g, ' ');
const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const humanize = (s) => { const t = s.replace(/-/g, ' '); return t.charAt(0).toUpperCase() + t.slice(1); };
const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);

function listDirs(dir) {
  try { return readdirSync(dir, { withFileTypes: true }).filter((d) => d.isDirectory() && !d.name.startsWith('.')).map((d) => d.name); } catch { return []; }
}

function describe(file) {
  const html = readFileSync(file, 'utf8');
  const t = html.match(/<title>([\s\S]*?)<\/title>/i);
  let title = t ? decode(t[1].replace(/\s+/g, ' ').trim()) : humanize(basename(file, '.html'));
  // Titles are often "Subject — Kind of document"; the kind is already in the subtitle.
  const short = title.split(/\s+[—–]\s+|:\s+/)[0];
  if (short.length >= 12) title = short;
  const styles = listDirs(join(ROOT, 'letterhead', 'styles'));
  const brands = listDirs(join(EXAMPLES, 'brands'));
  const name = shotName(file);
  let subtitle;
  if (name.startsWith('brand-sheet--')) {
    subtitle = `Brand sheet · ${cap(name.slice('brand-sheet--'.length))}`;
  } else if (name.includes('--')) {
    const [tpl, rest] = name.split('--');
    subtitle = `${humanize(tpl)} · ${rest} ${styles.includes(rest) ? 'style' : brands.includes(rest) ? 'brand' : ''}`.trim();
  } else {
    const hit = [...styles.map((s) => [s, 'style']), ...brands.map((b) => [b, 'brand'])].find(([x]) => name.endsWith(`-${x}`));
    subtitle = hit ? `${humanize(name.slice(0, -hit[0].length - 1))} · ${hit[0]} ${hit[1]}` : humanize(name);
  }
  return { title, subtitle };
}

function linkFor(file, outDir, linkBase) {
  if (linkBase) {
    const parent = basename(dirname(file));
    if (basename(file) === 'brand-sheet.html') return `${linkBase}/brands/${parent}.html`;
    if (parent === 'documents') return `${linkBase}/documents/${basename(file)}`;
    return `${linkBase}/${parent}/${basename(file)}`;
  }
  return relative(outDir, file).split(sep).join('/');
}

function buildGrid(files, o) {
  const cells = files.map((f) => {
    const { title, subtitle } = describe(f);
    const n = shotName(f);
    return `    <td align="center" width="33%">
      <a href="${esc(linkFor(f, o.out, o.linkBase))}"><picture>
        <source media="(prefers-color-scheme: dark)" srcset="${esc(n)}-dark.webp">
        <img src="${esc(n)}-light.webp" alt="${esc(title)}" width="100%">
      </picture></a><br>
      <b>${esc(title)}</b><br>
      <sub>${esc(subtitle)}</sub>
    </td>`;
  });
  while (cells.length % 3) cells.push('    <td width="33%"></td>');
  const rows = [];
  for (let i = 0; i < cells.length; i += 3) rows.push(`  <tr>\n${cells.slice(i, i + 3).join('\n')}\n  </tr>`);
  return `<!-- Generated by dev-scripts/screenshots.mjs --grid. Paste into README.md.
     Image paths are relative to this file: adjust them (e.g. examples/screenshots/) where you paste. -->
<table>
${rows.join('\n')}
</table>
`;
}

// ---------------------------------------------------------------- main

async function main() {
  const o = parseArgs(process.argv.slice(2));
  let files = o.all ? allDocuments() : o.files;
  const gridOnly = o.grid && files.length === 0;
  if (gridOnly) files = allDocuments();
  if (files.length === 0) { console.error('Nothing to do: pass <file.html>... or --all (see header of this file).'); process.exit(1); }
  for (const f of files) if (!existsSync(f)) { console.error(`not found: ${f}`); process.exit(1); }
  mkdirSync(o.out, { recursive: true });

  if (!gridOnly) {
    requireCwebp();
    const work = makeWorkDir();
    const browser = await launchBrowser();
    try {
      for (const f of files) {
        const n = shotName(f);
        const url = pathToFileURL(f).href;
        const jobs = [['light', o.width, o.height, false], ['dark', o.width, o.height, false]];
        if (o.mobile) jobs.push(['mobile', 390, 780, true]);
        for (const [kind, w, h, mobile] of jobs) {
          const png = await browser.shoot(url, { width: w, height: h, scale: o.scale, theme: kind === 'dark' ? 'dark' : 'light', mobile });
          const dest = join(o.out, `${n}-${kind}.webp`);
          const { bytes, quality } = encodeWebp(png, dest, { quality: o.quality, maxKB: o.maxKB, workDir: work });
          const warn = bytes > o.maxKB * 1024 ? '  (over target)' : '';
          console.log(`${basename(dest)}  ${w * o.scale}x${h * o.scale}  ${(bytes / 1024).toFixed(0)} KB  q${quality}${warn}`);
        }
      }
    } finally {
      await browser.close();
      rmWorkDir(work);
    }
  }

  if (o.grid) {
    const dest = join(o.out, 'README-grid.md');
    const missing = files.filter((f) => !existsSync(join(o.out, `${shotName(f)}-light.webp`)));
    if (missing.length) console.warn(`warning: no thumbnails yet for ${missing.map(shotName).join(', ')} in ${o.out}`);
    writeFileSync(dest, buildGrid(files, o));
    console.log(`wrote ${dest} (${files.length} cells)`);
  }
}

main().catch((e) => { console.error(e.stack || e.message); process.exit(1); });
