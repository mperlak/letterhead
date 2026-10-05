#!/usr/bin/env node
// Styles contact sheet: every style in letterhead/styles/ as a tile in a 3-column
// grid, all tiles the identical crop of the same template, labelled with the
// style name in small caps. Composed as an HTML page and screenshotted, like
// examples/hero/compose.html does for the hero.
//
//   node dev-scripts/contact-sheet.mjs [--template proposal] [--out examples/screenshots]
//                                      [--brand <profile-dir>] [--matrix-dir temp/matrix]
//                                      [--tile-height 765]
//
// Writes <out>/styles-contact-sheet.webp (light) and -dark.webp. The tiles come
// from the matrix (dev-scripts/build-matrix.mjs); if the matrix lacks the
// template for a style, it is rebuilt first. With --brand, the tiles are that
// brand profile in every style (build-matrix.mjs --brand, temp/matrix-<brand>/)
// and the sheet is styles-contact-sheet-<brand>{,-dark}.webp: the brand's
// colors should hold across all nine tiles, in both themes.
//
// It also reports, per style, where the heading and body faces come from:
// embedded in the document (apply-tokens.mjs puts the fonts in), installed
// on this machine, or a fallback.

import { readFileSync, writeFileSync, readdirSync, existsSync, mkdirSync } from 'node:fs';
import { join, dirname, resolve, basename } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { spawnSync } from 'node:child_process';
import { launchBrowser, encodeWebp, requireCwebp, makeWorkDir, rmWorkDir } from './lib/shoot.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const STYLES = join(ROOT, 'letterhead', 'styles');

const o = { template: 'proposal', out: join(ROOT, 'examples', 'screenshots'), matrix: null, brand: null,
  tileW: 680, tileH: 765, maxKB: 220 };
const argv = process.argv.slice(2);
for (let i = 0; i < argv.length; i++) {
  const a = argv[i];
  if (a === '--template') o.template = argv[++i];
  else if (a === '--out') o.out = resolve(argv[++i]);
  else if (a === '--matrix-dir') o.matrix = resolve(argv[++i]);
  else if (a === '--brand') o.brand = resolve(argv[++i] || '');
  else if (a === '--tile-height') o.tileH = Number(argv[++i]);
  else if (a === '--max-kb') o.maxKB = Number(argv[++i]);
  else { console.error(`unknown option ${a}`); process.exit(1); }
}

if (o.brand && !existsSync(join(o.brand, 'tokens.css'))) { console.error(`--brand: no tokens.css in ${o.brand}`); process.exit(1); }
const brandSlug = o.brand ? basename(o.brand) : null;
o.matrix ||= join(ROOT, 'temp', brandSlug ? `matrix-${brandSlug}` : 'matrix');
const styles = readdirSync(STYLES).filter((s) => !s.startsWith('.')).sort();
const docFor = (s) => join(o.matrix, `${o.template}--${s}.html`);
if (styles.some((s) => !existsSync(docFor(s)))) {
  console.log('matrix missing; running build-matrix.mjs');
  const r = spawnSync('node', [join(ROOT, 'dev-scripts', 'build-matrix.mjs'), ...(o.brand ? ['--brand', o.brand] : [])], { stdio: 'inherit' });
  if (r.status !== 0) process.exit(r.status || 1);
  if (styles.some((s) => !existsSync(docFor(s)))) { console.error(`no matrix sample for template "${o.template}"`); process.exit(1); }
}

const COLS = 3, PAGE_W = 1200, PAD = 40, GAP = 24;
const TILE_CSS_W = (PAGE_W - 2 * PAD - (COLS - 1) * GAP) / COLS;
const rows = Math.ceil(styles.length / COLS);
const TILE_CSS_H = Math.round(TILE_CSS_W * o.tileH / o.tileW);
const LABEL_H = 34;
const PAGE_H = Math.round(2 * PAD + rows * (TILE_CSS_H + LABEL_H) + (rows - 1) * GAP);

function composeHtml(theme, imgs) {
  const dark = theme === 'dark';
  const tiles = styles.map((s) => `<figure><div class="frame"><img src="${imgs[s]}" alt="${s}"></div><figcaption>${s.replace(/-/g, ' ')}</figcaption></figure>`).join('\n');
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>letterhead styles</title><style>
* { box-sizing: border-box; }
html, body { margin: 0; background: ${dark ? '#161615' : '#f5f4f0'}; }
body { width: ${PAGE_W}px; padding: ${PAD}px; font-family: -apple-system, BlinkMacSystemFont, "Helvetica Neue", Helvetica, Arial, sans-serif; -webkit-font-smoothing: antialiased; }
.grid { display: grid; grid-template-columns: repeat(${COLS}, 1fr); gap: ${GAP}px; }
figure { margin: 0; }
.frame { border: 1px solid ${dark ? '#3a3936' : '#d9d6cf'}; border-radius: 8px; overflow: hidden; background: ${dark ? '#1f1f1e' : '#fff'}; height: ${TILE_CSS_H}px; }
.frame img { display: block; width: 100%; height: 100%; }
figcaption { height: ${LABEL_H}px; display: flex; align-items: flex-end; justify-content: center; font-size: 17px; font-weight: 600;
  font-variant-caps: all-small-caps; letter-spacing: 0.12em; color: ${dark ? '#ecebe6' : '#2a2926'}; }
</style></head><body><div class="grid">
${tiles}
</div></body></html>`;
}

requireCwebp();
mkdirSync(o.out, { recursive: true });
const work = makeWorkDir('letterhead-sheet');
const browser = await launchBrowser();
try {
  // Font report: the heading and body faces, and where each comes from.
  const report = [];
  for (const s of styles) {
    const fonts = await browser.evaluate(pathToFileURL(docFor(s)).href, `(() => {
      const c = document.createElement('canvas').getContext('2d'), t = 'Hamburgefonstiv 0123 mmmmmwwwwiiii';
      const w = (f) => { c.font = '40px ' + f; return c.measureText(t).width; };
      const first = (el) => el ? getComputedStyle(el).fontFamily.split(',')[0].replace(/["']/g, '').trim() : '';
      const fams = [...new Set([first(document.querySelector('h1')), first(document.body)].filter(Boolean))];
      return fams.map((f) => {
        if ([...document.fonts].some((x) => x.family.replace(/["']/g, '') === f && x.status === 'loaded')) return [f, 'embedded'];
        const installed = w('"' + f + '", monospace') !== w('monospace') || w('"' + f + '", serif') !== w('serif');
        return [f, installed ? 'installed here only' : 'FALLBACK'];
      });
    })()`);
    report.push({ style: s, fonts });
  }

  for (const theme of ['light', 'dark']) {
    const imgs = {};
    for (const s of styles) {
      const png = await browser.shoot(pathToFileURL(docFor(s)).href, { width: o.tileW, height: o.tileH, scale: 2, theme });
      const f = join(work, `${s}-${theme}.png`);
      writeFileSync(f, png);
      imgs[s] = pathToFileURL(f).href;
    }
    const html = join(work, `sheet-${theme}.html`);
    writeFileSync(html, composeHtml(theme, imgs));
    const png = await browser.shoot(pathToFileURL(html).href, { width: PAGE_W, height: PAGE_H, scale: 1.5, theme: 'light' });
    const base = brandSlug ? `styles-contact-sheet-${brandSlug}` : 'styles-contact-sheet';
    const dest = join(o.out, theme === 'dark' ? `${base}-dark.webp` : `${base}.webp`);
    const { bytes, quality } = encodeWebp(png, dest, { quality: 80, maxKB: o.maxKB, workDir: work });
    console.log(`${dest}  ${PAGE_W * 1.5}x${PAGE_H * 1.5}  ${(bytes / 1024).toFixed(0)} KB  q${quality}`);
  }

  console.log(`\nStyles in the sheet (${o.template}${brandSlug ? `, brand ${brandSlug}` : ''}): ${styles.join(', ')}`);
  console.log('Heading and body faces (where each comes from):');
  for (const r of report) {
    console.log(`  ${r.style.padEnd(14)} ${r.fonts.map(([f, how]) => `${f}: ${how}`).join('; ')}`);
  }
} finally {
  await browser.close();
  rmWorkDir(work);
}
