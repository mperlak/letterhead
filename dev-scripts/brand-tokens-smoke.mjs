#!/usr/bin/env node
// Smoke test for letterhead/scripts/brand-tokens.mjs.
//
// Logo tint: builds tiny logos in memory (palette PNG with tRNS, 8-bit RGBA
// PNG, SVG), tints them, decodes the embedded --brand-logo back out of
// tokens.css and asserts: every painted pixel now carries the tint, alpha is
// untouched, --brand-logo-on follows the tint (dark ink → light), and
// multi-color artwork or a JPG is refused with exit 1 instead of being
// flattened.
//
// Dark-mode logo: single-color artwork is embedded once as
// --brand-logo-mask with --brand-logo-color per theme (tint or the artwork's
// own color in :root, the dark foreground in the dark blocks) and a
// --brand-logo-ratio; multi-color artwork gets a light --brand-logo-plate in
// the dark blocks; --logo-on dark keeps a dark plate in all three blocks.
//
// Dark theme colors: six brand colors (plus a navy that needs lifting) on
// every style: the dark primary is the brand color when it has 3:1 on the
// dark background, else lifted to 3:1 with the same hue and chroma; the dark
// ink clears 4.5:1 at full chroma; check-tokens passes. Neutrals take the
// brand hue at a very low chroma.
//
// Accent: --accent puts the given color in :root as oklch(), its hue at a
// dark low-chroma fill in both dark blocks, and --accent-foreground at
// 4.5:1 on it in every block, on every style (a dark accent re-picks its
// ink); without --accent the derived tint and its foreground are unchanged.
//
// Brand takeover: card/popover foregrounds follow --foreground, --chart-1
// is the primary, heading weights 500/800 pass and 450 fails, a sans heading
// never falls back to the style's serif, and the style's "not a brand"
// header comment is gone.
//
// Fonts: --font-file with the local woff2 fixtures (always runs), an
// unreachable font API (always runs: warning, exit 0), and Google Fonts
// itself (skipped when fonts.googleapis.com cannot be reached).
//
// Usage: node dev-scripts/brand-tokens-smoke.mjs
// Exit codes: 0 all assertions passed, 1 a run or assertion failed.

import { spawnSync } from 'node:child_process';
import { readFileSync, writeFileSync, mkdtempSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { deflateSync, inflateSync } from 'node:zlib';
import { parse as parseColor, wcagContrast as contrastRaw, converter } from '../letterhead/scripts/vendor/culori.mjs';

const toOklch = converter('oklch');
const parse = (v) => toOklch(parseColor(v));
const wcagContrast = (a, b) => contrastRaw(a, b);

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SCRIPT = join(ROOT, 'letterhead', 'scripts', 'brand-tokens.mjs');
const STYLE = join(ROOT, 'letterhead', 'styles', 'corporate', 'tokens.css');
const CONSULTING = join(ROOT, 'letterhead', 'styles', 'consulting', 'tokens.css');
const FIXTURES = join(ROOT, 'dev-scripts', 'fixtures', 'brand-tokens');
const TINT = [0x41, 0x40, 0x42];
const TMP = mkdtempSync(join(tmpdir(), 'lh-tokens-smoke-'));

let failures = 0;
function check(label, cond) {
  console.log(`  ${cond ? 'ok' : 'FAIL'} - ${label}`);
  if (!cond) failures++;
}

// ---- tiny PNG writer/reader ---------------------------------------------------

const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
function crc32(bytes) {
  let c = 0xffffffff;
  for (const b of bytes) c = CRC_TABLE[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const out = Buffer.alloc(12 + data.length);
  out.writeUInt32BE(data.length, 0);
  out.write(type, 4, 'ascii');
  data.copy(out, 8);
  out.writeUInt32BE(crc32(out.subarray(4, 8 + data.length)), 8 + data.length);
  return out;
}
const SIG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
function ihdr(w, h, colorType) {
  const d = Buffer.alloc(13);
  d.writeUInt32BE(w, 0);
  d.writeUInt32BE(h, 4);
  d[8] = 8;
  d[9] = colorType;
  return d;
}

// 4x4 RGBA: transparent border, `color` pixels in the middle, one half-alpha edge.
function rgbaPng(colorFor) {
  const w = 4, h = 4;
  const raw = Buffer.alloc(h * (w * 4 + 1));
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const inner = x > 0 && x < 3 && y > 0 && y < 3;
      const edge = x === 0 && y === 1;
      const [r, g, b] = colorFor(x, y);
      const o = y * (w * 4 + 1) + 1 + x * 4;
      raw[o] = r; raw[o + 1] = g; raw[o + 2] = b;
      raw[o + 3] = inner ? 255 : edge ? 128 : 0;
    }
  }
  return Buffer.concat([SIG, chunk('IHDR', ihdr(w, h, 6)), chunk('IDAT', deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
}

// 4x1 palette: index 0 transparent, 1 white opaque, 2 white half-alpha.
function palettePng() {
  const plte = Buffer.from([0, 0, 0, 255, 255, 255, 255, 255, 255]);
  const trns = Buffer.from([0, 255, 128]);
  const raw = Buffer.from([0, 0, 1, 2, 1]);
  return Buffer.concat([SIG, chunk('IHDR', ihdr(4, 1, 3)), chunk('PLTE', plte), chunk('tRNS', trns), chunk('IDAT', deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
}

function readChunks(buf) {
  const out = {};
  let off = 8;
  while (off < buf.length) {
    const len = buf.readUInt32BE(off);
    const type = buf.toString('ascii', off + 4, off + 8);
    (out[type] ||= []).push(buf.subarray(off + 8, off + 8 + len));
    off += 12 + len;
  }
  return out;
}

// Decodes a filter-0 RGBA PNG (what the tint path writes) into [r,g,b,a] tuples.
function rgbaPixels(buf) {
  const c = readChunks(buf);
  const w = c.IHDR[0].readUInt32BE(0);
  const raw = inflateSync(Buffer.concat(c.IDAT));
  const px = [];
  for (let o = 0; o < raw.length; o += w * 4 + 1) {
    for (let x = 0; x < w; x++) px.push([...raw.subarray(o + 1 + x * 4, o + 5 + x * 4)]);
  }
  return px;
}

function runTokens(logoPath, extra = []) {
  const out = join(TMP, `tokens-${Math.random().toString(36).slice(2)}.css`);
  const res = spawnSync(process.execPath, [SCRIPT, '--style', STYLE, '--primary', '#ffaf00', '--foreground', '#414042', '--font-body', 'Roboto', '--logo', logoPath, '--logo-tint', '#414042', ...extra, '--out', out], { encoding: 'utf8' });
  let css = '';
  try { css = readFileSync(out, 'utf8'); } catch {}
  return { res, css };
}
function embedded(css) {
  const m = css.match(/--brand-logo(?:-mask)?:\s*url\("data:([^;]+);base64,([^"]+)"\)/);
  return m ? { mime: m[1], buf: Buffer.from(m[2], 'base64') } : null;
}
const same = (a, b) => a.every((v, i) => v === b[i]);

// ---- cases --------------------------------------------------------------------

console.log('palette PNG, white on transparent');
{
  const p = join(TMP, 'palette.png');
  writeFileSync(p, palettePng());
  const { res, css } = runTokens(p);
  check('exits 0', res.status === 0);
  const logo = embedded(css);
  const c = logo && readChunks(logo.buf);
  const plte = c?.PLTE?.[0];
  check('every palette entry carries the tint', !!plte && [0, 3, 6].every((i) => same([plte[i], plte[i + 1], plte[i + 2]], TINT)));
  check('tRNS untouched', !!c?.tRNS && same([...c.tRNS[0]], [0, 255, 128]));
  check('--brand-logo-on is light', /--brand-logo-on:\s*light/.test(css));
}

console.log('RGBA PNG, white on transparent');
{
  const p = join(TMP, 'rgba.png');
  writeFileSync(p, rgbaPng(() => [255, 255, 255]));
  const { res, css } = runTokens(p);
  check('exits 0', res.status === 0);
  const logo = embedded(css);
  const px = logo ? rgbaPixels(logo.buf) : [];
  check('painted pixels carry the tint', px.length === 16 && px.filter((p) => p[3] > 0).every((p) => same(p.slice(0, 3), TINT)));
  check('alpha preserved (4 opaque, 1 half, 11 clear)', px.filter((p) => p[3] === 255).length === 4 && px.filter((p) => p[3] === 128).length === 1);
}

console.log('SVG, white fills');
{
  const p = join(TMP, 'white.svg');
  writeFileSync(p, '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><path fill="#fff" d="M0 0h5v5z"/><path style="fill: white" d="M5 5h5v5z"/></svg>');
  const { res, css } = runTokens(p);
  check('exits 0', res.status === 0);
  const svg = embedded(css)?.buf.toString('utf8') || '';
  check('both fills recolored, no white left', (svg.match(/#414042/g) || []).length === 2 && !/#fff\b|white/i.test(svg));
}

console.log('refusals');
{
  const p = join(TMP, 'two-color.png');
  writeFileSync(p, rgbaPng((x) => (x < 2 ? [255, 255, 255] : [255, 175, 0])));
  const { res } = runTokens(p);
  check('two-color PNG exits 1', res.status === 1);
  check('and says why', /more than one color/.test(res.stderr));

  const s = join(TMP, 'two-color.svg');
  writeFileSync(s, '<svg xmlns="http://www.w3.org/2000/svg"><path fill="#ffffff" d="M0 0h1v1z"/><path fill="#ffaf00" d="M1 1h1v1z"/></svg>');
  check('two-color SVG exits 1', runTokens(s).res.status === 1);

  const j = join(TMP, 'logo.jpg');
  writeFileSync(j, Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 0x10]));
  check('JPG exits 1', runTokens(j).res.status === 1);
}

// ---- helpers for the block-level cases ------------------------------------------

function run(args, env = {}) {
  const out = join(TMP, `tokens-${Math.random().toString(36).slice(2)}.css`);
  const res = spawnSync(process.execPath, [SCRIPT, ...args, '--out', out, '--json'], { encoding: 'utf8', env: { ...process.env, ...env } });
  let css = '';
  try { css = readFileSync(out, 'utf8'); } catch {}
  let json = null;
  try { json = JSON.parse(res.stdout); } catch {}
  return { res, css, json, out };
}

// Bodies of the three theme blocks, by brace matching (data: URIs carry no braces).
function blocks(css) {
  const body = (from) => {
    const open = css.indexOf('{', from);
    let depth = 0;
    for (let i = open; i < css.length; i++) {
      if (css[i] === '{') depth++;
      else if (css[i] === '}' && --depth === 0) return css.slice(open + 1, i);
    }
    return '';
  };
  const media = css.indexOf('@media (prefers-color-scheme: dark)');
  return {
    light: body(css.search(/^:root\s*\{/m)),
    dark: body(css.indexOf('[data-theme="dark"] {')),
    os: body(css.indexOf(':root:not(', media)),
  };
}
const tok = (body, name) => (body.match(new RegExp(`--${name}\\s*:\\s*((?:"[^"]*"|[^;"])+);`)) || [])[1]?.trim() ?? null;
const base = ['--style', STYLE, '--primary', '#ffaf00', '--foreground', '#414042', '--font-body', 'Roboto'];

console.log('dark-mode logo: single-color artwork is one copy, drawn as a mask');
{
  const p = join(TMP, 'dark-variant.png');
  writeFileSync(p, rgbaPng(() => [255, 255, 255]));
  const { res, css, json } = run([...base, '--logo', p, '--logo-tint', '#414042']);
  const b = blocks(css);
  check('exits 0', res.status === 0);
  check(':root carries --brand-logo-mask', /^url\("data:image\/png;base64,/.test(tok(b.light, 'brand-logo-mask') || ''));
  check('--brand-logo points at the same copy', tok(b.light, 'brand-logo') === 'var(--brand-logo-mask)');
  check('the logo data URI appears once', (css.match(/data:image\/png;base64/g) || []).length === 1);
  check('no --brand-logo-dark and no plate', !/--brand-logo-dark|--brand-logo-plate/.test(css));
  check(':root --brand-logo-color is the tint', tok(b.light, 'brand-logo-color') === tok(b.light, 'foreground'));
  check('both dark blocks set the dark foreground as the logo color',
    ['dark', 'os'].every((k) => tok(b[k], 'brand-logo-color') === tok(b[k], 'foreground')));
  check('both dark blocks say on: dark', tok(b.dark, 'brand-logo-on') === 'dark' && tok(b.os, 'brand-logo-on') === 'dark');
  check('--brand-logo-ratio read from the file (4x4)', tok(b.light, 'brand-logo-ratio') === '1');
  check('json reports dark mode "mask"', json?.logo?.dark?.mode === 'mask' && json.logo.mask === true && json.logo.ratio === 1);

  const again = run(['--style', json?.out || '', '--primary', '#ffaf00', '--font-body', 'Roboto', '--logo', p, '--logo-tint', 'oklch(0.373 0.004 308.4)']);
  const ab = blocks(again.css);
  check('--logo-tint takes oklch()', again.res.status === 0 && tok(ab.light, 'brand-logo-color') === 'oklch(0.373 0.004 308.4)');
  check('rerun on its own output keeps one logo copy', (again.css.match(/data:image\/png;base64/g) || []).length === 1 && (again.css.match(/--brand-logo-color:/g) || []).length === 3);
}

console.log('dark-mode logo: untinted single-color artwork keeps its own color');
{
  const p = join(TMP, 'navy.svg');
  writeFileSync(p, '<svg xmlns="http://www.w3.org/2000/svg" width="240" height="60" viewBox="0 0 120 30"><path fill="#1a2b6d" d="M0 0h120v30H0z"/></svg>');
  const { res, css, json } = run([...base, '--logo', p]);
  const b = blocks(css);
  check('exits 0, mask mode', res.status === 0 && json?.logo?.dark?.mode === 'mask');
  check(':root logo color is the artwork\'s navy, not the text color', tok(b.light, 'brand-logo-color') === 'oklch(0.319 0.117 268.1)');
  check('ratio from width/height (4)', tok(b.light, 'brand-logo-ratio') === '4');
  check('no warning about --logo-on for a dark logo', !(json?.warnings || []).some((w) => /logo-on/.test(w)));
}

console.log('warnings: a light multi-color logo without --logo-on');
{
  const p = join(TMP, 'light-two.png');
  writeFileSync(p, rgbaPng((x) => (x < 2 ? [255, 255, 255] : [255, 230, 120])));
  const { json } = run([...base, '--logo', p]);
  check('warns that it barely shows on paper', (json?.warnings || []).some((w) => /--logo-on dark/.test(w)));
  check('never tells the agent to ask for another variant', !(json?.warnings || []).some((w) => /ask the owner/.test(w)));
}

console.log('dark theme colors: six brand colors on every style');
{
  const colors = ['#ffaf00', '#e20c7b', '#ff3535', '#ccff00', '#c0f0fb', '#3B6FE0', '#1a2b6d'];
  const styles = readdirSync(join(ROOT, 'letterhead', 'styles'));
  let runs = 0;
  let bad = [];
  for (const style of styles) {
    for (const color of colors) {
      const { res, css, json } = run(['--style', join(ROOT, 'letterhead', 'styles', style, 'tokens.css'), '--primary', color, '--font-body', 'Roboto']);
      runs++;
      const b = blocks(css);
      const light = parse(tok(b.light, 'primary'));
      const dark = parse(tok(b.dark, 'primary'));
      const bg = parse(tok(b.dark, 'background'));
      const ink = parse(tok(b.dark, 'primary-ink'));
      const why = [];
      if (res.status !== 0) why.push(`exit ${res.status}`);
      if (json?.check?.findings?.length) why.push('check-tokens findings');
      if (wcagContrast(dark, bg) < 3) why.push('dark primary under 3:1');
      if (wcagContrast(light, bg) >= 3 && tok(b.dark, 'primary') !== tok(b.light, 'primary')) why.push('primary changed though it already read');
      if (Math.abs((dark.h ?? 0) - (light.h ?? 0)) > 0.2 && light.c > 0.02) why.push('hue shifted');
      if (dark.c < light.c - 0.02 && dark.l < 0.9) why.push('chroma lost');
      if (wcagContrast(ink, bg) < 4.5 || Math.abs((ink.h ?? 0) - (light.h ?? 0)) > 0.2) why.push('ink');
      if (ink.c < Math.min(light.c, 0.1) - 0.005) why.push('pale ink');
      if (tok(b.dark, 'primary') !== tok(b.os, 'primary')) why.push('dark blocks differ');
      if (why.length) bad.push(`${style} ${color}: ${why.join(', ')}`);
    }
  }
  check(`${runs} runs: dark primary is the brand color or lifted to 3:1, same hue, ink 4.5:1 at full chroma`, bad.length === 0);
  for (const line of bad) console.log(`    ${line}`);
}

console.log('--accent: the brand\'s own accent in light, a dark fill of its hue in dark');
{
  const given = parse('#e8b4b8');
  const { res, css, json } = run(['--style', CONSULTING, '--primary', '#1a3c34', '--accent', '#e8b4b8', '--font-body', 'Roboto']);
  const b = blocks(css);
  const light = parse(tok(b.light, 'accent'));
  const dark = parse(tok(b.dark, 'accent'));
  check('exits 0, check-tokens clean', res.status === 0 && json?.check?.findings?.length === 0);
  check(':root --accent is the given color, as oklch()', /^oklch\(/.test(tok(b.light, 'accent') || '')
    && Math.abs(light.l - given.l) < 0.001 && Math.abs(light.c - given.c) < 0.0015 && Math.abs(light.h - given.h) < 0.1);
  check('dark blocks: same hue, dark, low chroma, identical', Math.abs(dark.h - given.h) < 0.2 && dark.l < 0.4 && dark.c <= 0.05
    && tok(b.dark, 'accent') === tok(b.os, 'accent'));
  const ratios = ['light', 'dark', 'os'].map((k) => wcagContrast(parse(tok(b[k], 'accent-foreground')), parse(tok(b[k], 'accent'))));
  check(`--accent-foreground on --accent >= 4.5 in every block (${ratios.map((r) => r.toFixed(2)).join(', ')})`, ratios.every((r) => r >= 4.5));
  check('sidebar-accent mirrors --accent', tok(b.light, 'sidebar-accent') === tok(b.light, 'accent') && tok(b.dark, 'sidebar-accent') === tok(b.dark, 'accent'));
  const a = json?.derived?.accent;
  check('json: derived.accent carries source, values and contrasts', a?.source === 'arg' && a.light === tok(b.light, 'accent')
    && a.dark === tok(b.dark, 'accent') && a.contrast.light >= 4.5 && a.contrast.dark >= 4.5);

  // Any accent on any style: a dark accent re-picks its ink instead of
  // leaving dark text on a dark fill.
  const styles = readdirSync(join(ROOT, 'letterhead', 'styles')).filter((s) => !s.startsWith('.'));
  const bad = [];
  for (const style of styles) {
    for (const accent of ['#e8b4b8', '#ffaf00', '#1a2b6d', 'oklch(0.7 0.3 150)']) {
      const r = run(['--style', join(ROOT, 'letterhead', 'styles', style, 'tokens.css'), '--primary', '#1a3c34', '--accent', accent, '--font-body', 'Roboto']);
      const bb = blocks(r.css);
      const why = [];
      if (r.res.status !== 0) why.push(`exit ${r.res.status}`);
      if (r.json?.check?.findings?.length) why.push('check-tokens findings');
      for (const k of ['light', 'dark', 'os']) {
        if (wcagContrast(parse(tok(bb[k], 'accent-foreground')), parse(tok(bb[k], 'accent'))) < 4.5) why.push(`${k} contrast`);
      }
      if (why.length) bad.push(`${style} ${accent}: ${why.join(', ')}`);
    }
  }
  check(`${styles.length * 4} runs: every style, every accent, 4.5:1 and check-tokens clean`, bad.length === 0);
  for (const line of bad) console.log(`    ${line}`);
}

console.log('no --accent: a light tint of the primary, text in the block\'s foreground');
{
  const { res, css, json } = run(['--style', CONSULTING, '--primary', '#1a3c34', '--font-body', 'Roboto']);
  const b = blocks(css);
  const primary = parse('#1a3c34');
  const light = parse(tok(b.light, 'accent'));
  const dark = parse(tok(b.dark, 'accent'));
  check('exits 0', res.status === 0);
  check(':root tint at L 0.95 and dark fill at L 0.25, primary hue', Math.abs(light.l - 0.95) < 0.001 && Math.abs(dark.l - 0.25) < 0.001
    && Math.abs(light.h - primary.h) < 0.2 && Math.abs(dark.h - primary.h) < 0.2);
  check('--accent-foreground is the block\'s foreground', ['light', 'dark', 'os'].every((k) => tok(b[k], 'accent-foreground') === tok(b[k], 'foreground')));
  check('json: derived.accent.source is "derived"', json?.derived?.accent?.source === 'derived');
}

console.log('neutrals take the brand hue at low chroma');
{
  const { css } = run(['--style', STYLE, '--primary', '#ff3535', '--font-body', 'Roboto']);
  const b = blocks(css);
  const hueOk = ['light', 'dark', 'os'].every((k) => ['muted', 'border', 'muted-foreground'].every((n) => {
    const c = parse(tok(b[k], n));
    return Math.abs(c.h - 26.8) < 0.2 && c.c <= 0.012;
  }));
  check('--muted, --border, --muted-foreground carry the red hue at chroma <= 0.012', hueOk);
}

console.log('dark-mode logo: multi-color artwork gets a light plate');
{
  const p = join(TMP, 'plate.png');
  writeFileSync(p, rgbaPng((x) => (x < 2 ? [20, 20, 20] : [226, 12, 123])));
  const { res, css, json } = run([...base, '--logo', p, '--logo-on', 'light']);
  const b = blocks(css);
  check('exits 0', res.status === 0);
  check(':root plate is transparent', tok(b.light, 'brand-logo-plate') === 'transparent');
  const plate = tok(b.dark, 'brand-logo-plate') || '';
  check('dark blocks carry a light plate', /^oklch\(0\.9\d\d /.test(plate) && tok(b.os, 'brand-logo-plate') === plate);
  check('no --brand-logo-dark copy', !/--brand-logo-dark/.test(css));
  check('json reports dark mode "plate"', json?.logo?.dark?.mode === 'plate');
}

console.log('dark-mode logo: artwork on a dark band keeps the band');
{
  const p = join(TMP, 'band.png');
  writeFileSync(p, rgbaPng((x) => (x < 2 ? [255, 255, 255] : [255, 175, 0])));
  const { res, css } = run([...base, '--logo', p, '--logo-on', 'dark']);
  const b = blocks(css);
  const plate = tok(b.light, 'brand-logo-plate');
  check('exits 0', res.status === 0);
  check('same dark plate in all three blocks', !!plate && /^oklch\(0\.[0-4]/.test(plate) && tok(b.dark, 'brand-logo-plate') === plate && tok(b.os, 'brand-logo-plate') === plate);
  check('on: dark everywhere', ['light', 'dark', 'os'].every((k) => tok(b[k], 'brand-logo-on') === 'dark'));
}

console.log('brand takeover: foregrounds, chart-1, header comment');
{
  const { res, css } = run(base);
  const b = blocks(css);
  check('exits 0', res.status === 0);
  check('card/popover/sidebar foreground = foreground in :root', ['card-foreground', 'popover-foreground', 'sidebar-foreground'].every((n) => tok(b.light, n) === tok(b.light, 'foreground')));
  check('card/popover foreground = foreground in both dark blocks', ['dark', 'os'].every((k) => tok(b[k], 'card-foreground') === tok(b[k], 'foreground') && tok(b[k], 'popover-foreground') === tok(b[k], 'foreground')));
  check('--chart-1 is the primary in every block', ['light', 'dark', 'os'].every((k) => tok(b[k], 'chart-1') === tok(b[k], 'primary')));
  check('style header comment replaced', !/not a brand|Reference style/i.test(css) && /^\/\*\*\n \* Brand tokens\./.test(css));
}

console.log('heading weight');
{
  for (const w of ['500', '800']) {
    const { res, css } = run([...base, '--heading-weight', w]);
    check(`${w} accepted and written`, res.status === 0 && tok(blocks(css).light, 'font-heading-weight') === w);
  }
  for (const w of ['450', '1000']) check(`${w} refused with exit 1`, run([...base, '--heading-weight', w]).res.status === 1);
}

console.log('font stacks');
{
  const { css } = run(['--style', CONSULTING, '--primary', '#b82424', '--font-body', 'Poppins', '--font-heading', 'Poppins, sans-serif']);
  const display = tok(blocks(css).light, 'font-display') || '';
  check('sans heading on a serif-display style ends in sans-serif', /^Poppins,.*sans-serif$/.test(display) && !/Georgia|Charter/.test(display));
  const same = run(['--style', CONSULTING, '--primary', '#b82424', '--font-body', 'Poppins', '--font-heading', 'Poppins']);
  const lb = blocks(same.css).light;
  check('heading = body family takes the body stack', tok(lb, 'font-display') === tok(lb, 'font-sans'));
}

console.log('fonts: --font-file (offline)');
{
  const pop = join(FIXTURES, 'poppins-500-subset.woff2');
  const rob = join(FIXTURES, 'roboto-variable-subset.woff2');
  const { res, css, json, out } = run([...base.slice(0, -2), '--font-body', 'Roboto', '--font-heading', 'Poppins, sans-serif', '--heading-weight', '500', '--embed-fonts', '--lang', 'pl', '--font-file', `Poppins=${pop}`, '--font-file', `Roboto=${rob}`]);
  check('exits 0', res.status === 0);
  const start = css.indexOf('/* letterhead:fonts */');
  const end = css.indexOf('/* /letterhead:fonts */');
  check('fonts section sits before the first theme block', start > 0 && end > start && end < css.search(/^:root\s*\{/m));
  const section = css.slice(start, end);
  check('Poppins face: static weight 500 from OS/2', /font-family: "Poppins";[^}]*font-weight: 500;[^}]*data:font\/woff2;base64,/.test(section));
  check('Roboto face: variable range 100 900 from fvar', /font-family: "Roboto";[^}]*font-weight: 100 900;/.test(section));
  check('font-display: swap on every face', (section.match(/@font-face/g) || []).length === 2 && (section.match(/font-display: swap/g) || []).length === 2);
  const pj = json?.fonts?.find((f) => f.family === 'Poppins');
  check('json: Poppins embedded from file', pj?.embedded === true && pj.source === 'file' && pj.bytes > 0);
  // Feeding the output back in as the style replaces the section, never doubles it.
  const again = run(['--style', out, '--primary', '#ffaf00', '--font-body', 'Roboto', '--embed-fonts', '--lang', 'pl', '--font-file', `Roboto=${rob}`]);
  check('rerun on its own output keeps one fonts section', again.css.split('/* letterhead:fonts */').length === 2 && !/"Poppins"/.test(again.css));
}

console.log('fonts: font API unreachable (offline)');
{
  const { res, css, json } = run([...base, '--embed-fonts', '--lang', 'en'], { LETTERHEAD_FONTS_API: 'http://127.0.0.1:9/css2' });
  check('exits 0', res.status === 0);
  check('no fonts section written', !/letterhead:fonts/.test(css));
  const f = json?.fonts?.[0];
  check('json: embedded false with a network reason', f?.embedded === false && /^network/.test(f.reason || ''));
}

const online = await fetch('https://fonts.googleapis.com/css2?family=Roboto', { signal: AbortSignal.timeout(4000) }).then((r) => r.ok, () => false);
if (!online) {
  console.log('fonts: Google Fonts — SKIPPED (fonts.googleapis.com not reachable)');
} else {
  console.log('fonts: Google Fonts (network)');
  const { res, css, json } = run([...base.slice(0, -2), '--font-body', 'Roboto', '--font-heading', 'Signifier, serif', '--embed-fonts', '--lang', 'pl']);
  check('exits 0 even with one family missing', res.status === 0);
  const r = json?.fonts?.find((f) => f.family === 'Roboto');
  check('Roboto embedded with latin + latin-ext', r?.embedded === true && r.subsets.includes('latin') && r.subsets.includes('latin-ext'));
  check('one file covers 400-700 (deduped by URL)', /font-family: "Roboto";[^}]*font-weight: 400 700;/.test(css) && (css.match(/font-family: "Roboto"/g) || []).length === 2);
  const s = json?.fonts?.find((f) => f.family === 'Signifier');
  check('Signifier reported as not embedded', s?.embedded === false && /Google Fonts/.test(s.reason || ''));
  const en = run([...base, '--embed-fonts', '--lang', 'en']);
  check('--lang en embeds latin only', /latin \*\//.test(en.css) && !/latin-ext/.test(en.css));
}

if (failures > 0) {
  console.log(`\n${failures} assertion(s) failed.`);
  process.exit(1);
}
console.log('\nall assertions passed.');
process.exit(0);
