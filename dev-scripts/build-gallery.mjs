#!/usr/bin/env node
// Gallery site builder (GitHub Pages: https://mperlak.github.io/letterhead/).
//
// Builds a static site into temp/site/:
//   matrix/<template>--<style>.html   every matrix sample (build-matrix.mjs)
//                                     plus the presentation template in every
//                                     style, built here from synthetic pictures
//   documents/*.html                  examples/documents/, as they are
//   brands/<name>.html                examples/brands/<name>/brand-sheet.html
//   hero/{before,after}.html          examples/hero/, only when both are there
//   screenshots/*.png                 the light/dark captures the gallery uses
//   index.html                        the gallery (dev-scripts/gallery/page.html
//                                     with the lists filled in)
//   .nojekyll
//
// Every document is checked on the way: build-matrix.mjs runs check-document
// on the matrix, build-presentation.mjs on each presentation. Any failure
// stops the build with exit 1.
//
// Usage:
//   node dev-scripts/build-gallery.mjs
//   cd temp/site && python3 -m http.server 8000   # look at it locally

import {
  readFileSync, writeFileSync, mkdirSync, readdirSync, existsSync, rmSync, copyFileSync,
} from 'node:fs';
import { join, dirname, basename } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { deflateSync } from 'node:zlib';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SKILL = join(ROOT, 'letterhead');
const STYLES_DIR = join(SKILL, 'styles');
const TEMPLATES_DIR = join(SKILL, 'templates');
const EXAMPLES = join(ROOT, 'examples');
const PAGE = join(ROOT, 'dev-scripts', 'gallery', 'page.html');
const TEMP = join(ROOT, 'temp');
const SITE = join(TEMP, 'site');
const WORK = join(TEMP, 'gallery-work');

const REPO = 'https://github.com/mperlak/letterhead';
const INSTALL = '/plugin marketplace add mperlak/letterhead';

function fail(msg) {
  console.error(`gallery: ${msg}`);
  process.exit(1);
}
function node(args) {
  return spawnSync(process.execPath, args, { encoding: 'utf8' });
}
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const unesc = (s) => String(s).replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, '&');
const list = (dir, re) => (existsSync(dir) ? readdirSync(dir).filter((f) => re.test(f)).sort() : []);

function frontmatter(file) {
  const raw = readFileSync(file, 'utf8');
  const m = raw.match(/^---\n([\s\S]*?)\n---/);
  const out = {};
  if (!m) return out;
  for (const line of m[1].split('\n')) {
    const kv = line.match(/^(name|description):\s*(.+)$/);
    if (kv) out[kv[1]] = kv[2].replace(/^"(.*)"$/, '$1').trim();
  }
  return out;
}
function htmlMeta(file) {
  const raw = readFileSync(file, 'utf8');
  const title = (raw.match(/<title>([^<]*)<\/title>/) || [])[1] || basename(file, '.html');
  const desc = (raw.match(/<meta property="og:description" content="([^"]*)"/) || raw.match(/<meta name="description" content="([^"]*)"/) || [])[1] || '';
  return { title: unesc(title).trim(), description: unesc(desc).trim() };
}

// ---------------------------------------------------------------------------
// 1. Matrix (11 sample bodies x every style), checked by build-matrix.mjs
// ---------------------------------------------------------------------------

const styles = readdirSync(STYLES_DIR).filter((s) => !s.startsWith('.')).sort();
const matrixBodies = list(join(ROOT, 'dev-scripts', 'matrix-bodies'), /\.html$/).map((f) => basename(f, '.html'));

console.log('gallery: building the template x style matrix');
const matrix = node([join(ROOT, 'dev-scripts', 'build-matrix.mjs')]);
process.stdout.write(matrix.stdout);
if (matrix.status !== 0) {
  process.stderr.write(matrix.stderr);
  fail('build-matrix.mjs failed');
}

rmSync(SITE, { recursive: true, force: true });
mkdirSync(join(SITE, 'matrix'), { recursive: true });
for (const t of matrixBodies) {
  for (const s of styles) {
    const src = join(TEMP, 'matrix', `${t}--${s}.html`);
    if (!existsSync(src)) fail(`missing matrix output ${src}`);
    copyFileSync(src, join(SITE, 'matrix', `${t}--${s}.html`));
  }
}

// ---------------------------------------------------------------------------
// 2. Presentation in every style, from synthetic pictures
// ---------------------------------------------------------------------------
// The presentation template is assembled by scripts from a folder of
// pictures, so it has no matrix body. The pictures are flat-colour room
// drawings written here as PNGs (node:zlib), the products are written as
// products.json directly (no network), and the text is plain English.

const CRC = new Uint32Array(256).map((_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
function crc32(buf) {
  let c = 0xffffffff;
  for (const b of buf) c = CRC[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function pngChunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'latin1'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}
// shapes: [{ x0, y0, x1, y1, c: [r,g,b], round?: true }] in 0..1 units,
// painted in order over the first shape.
function drawPng(w, h, shapes) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8;
  ihdr[9] = 2;
  const raw = Buffer.alloc((w * 3 + 1) * h);
  const px = shapes.map((s) => ({ ...s, X0: Math.round(s.x0 * w), X1: Math.round(s.x1 * w), Y0: Math.round(s.y0 * h), Y1: Math.round(s.y1 * h) }));
  for (let y = 0; y < h; y++) {
    const row = y * (w * 3 + 1);
    for (let x = 0; x < w; x++) {
      let c = px[0].c;
      for (let i = 1; i < px.length; i++) {
        const s = px[i];
        if (x < s.X0 || x >= s.X1 || y < s.Y0 || y >= s.Y1) continue;
        if (s.round) {
          const rx = (s.X1 - s.X0) / 2;
          const ry = (s.Y1 - s.Y0) / 2;
          const dx = (x - s.X0 - rx) / rx;
          const dy = (y - s.Y0 - ry) / ry;
          if (dx * dx + dy * dy > 1) continue;
        }
        c = s.c;
      }
      const o = row + 1 + x * 3;
      raw[o] = c[0];
      raw[o + 1] = c[1];
      raw[o + 2] = c[2];
    }
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    pngChunk('IHDR', ihdr), pngChunk('IDAT', deflateSync(raw, { level: 9 })), pngChunk('IEND', Buffer.alloc(0)),
  ]);
}

// A room: wall, floor, window with mullions, sofa or desk, a picture, a lamp.
function room({ wall, floor, sky, frame, sofa, sofaDark, art, lamp, rug, floorY = 0.7, windowX = 0.1, sofaX = 0.46, desk = false }) {
  const s = [
    { x0: 0, y0: 0, x1: 1, y1: 1, c: wall },
    { x0: 0, y0: floorY, x1: 1, y1: 1, c: floor },
    { x0: 0, y0: floorY - 0.012, x1: 1, y1: floorY, c: frame },
    { x0: windowX, y0: 0.12, x1: windowX + 0.26, y1: 0.58, c: frame },
    { x0: windowX + 0.012, y0: 0.135, x1: windowX + 0.248, y1: 0.565, c: sky },
    { x0: windowX + 0.126, y0: 0.12, x1: windowX + 0.134, y1: 0.58, c: frame },
    { x0: windowX, y0: 0.33, x1: windowX + 0.26, y1: 0.342, c: frame },
  ];
  if (rug) s.push({ x0: sofaX - 0.12, y0: floorY + 0.06, x1: sofaX + 0.5, y1: floorY + 0.2, c: rug, round: true });
  if (desk) {
    s.push({ x0: sofaX, y0: floorY - 0.2, x1: sofaX + 0.4, y1: floorY - 0.17, c: sofaDark });
    s.push({ x0: sofaX + 0.02, y0: floorY - 0.17, x1: sofaX + 0.035, y1: floorY + 0.04, c: sofaDark });
    s.push({ x0: sofaX + 0.365, y0: floorY - 0.17, x1: sofaX + 0.38, y1: floorY + 0.04, c: sofaDark });
    s.push({ x0: sofaX + 0.24, y0: floorY - 0.36, x1: sofaX + 0.3, y1: floorY - 0.2, c: lamp });
    s.push({ x0: sofaX + 0.06, y0: floorY - 0.12, x1: sofaX + 0.16, y1: floorY + 0.06, c: sofa });
  } else {
    s.push({ x0: sofaX, y0: floorY - 0.2, x1: sofaX + 0.42, y1: floorY - 0.08, c: sofaDark });
    s.push({ x0: sofaX - 0.02, y0: floorY - 0.1, x1: sofaX + 0.44, y1: floorY + 0.03, c: sofa });
    s.push({ x0: sofaX + 0.47, y0: floorY - 0.42, x1: sofaX + 0.478, y1: floorY + 0.02, c: sofaDark });
    s.push({ x0: sofaX + 0.44, y0: floorY - 0.48, x1: sofaX + 0.51, y1: floorY - 0.4, c: lamp, round: true });
  }
  s.push({ x0: sofaX + 0.08, y0: 0.16, x1: sofaX + 0.26, y1: 0.36, c: frame });
  s.push({ x0: sofaX + 0.09, y0: 0.175, x1: sofaX + 0.25, y1: 0.345, c: art });
  return s;
}
function product({ bg, body, dark, kind }) {
  const s = [{ x0: 0, y0: 0, x1: 1, y1: 1, c: bg }];
  if (kind === 'lamp') {
    s.push({ x0: 0.3, y0: 0.14, x1: 0.7, y1: 0.42, c: body, round: true });
    s.push({ x0: 0.49, y0: 0.4, x1: 0.51, y1: 0.84, c: dark });
    s.push({ x0: 0.36, y0: 0.84, x1: 0.64, y1: 0.88, c: dark });
  } else if (kind === 'chair') {
    s.push({ x0: 0.28, y0: 0.2, x1: 0.72, y1: 0.56, c: body });
    s.push({ x0: 0.24, y0: 0.52, x1: 0.76, y1: 0.66, c: body });
    s.push({ x0: 0.28, y0: 0.66, x1: 0.31, y1: 0.86, c: dark });
    s.push({ x0: 0.69, y0: 0.66, x1: 0.72, y1: 0.86, c: dark });
  } else if (kind === 'rug') {
    s.push({ x0: 0.12, y0: 0.3, x1: 0.88, y1: 0.7, c: body });
    s.push({ x0: 0.18, y0: 0.36, x1: 0.82, y1: 0.64, c: dark });
    s.push({ x0: 0.24, y0: 0.42, x1: 0.76, y1: 0.58, c: body });
  } else {
    s.push({ x0: 0.18, y0: 0.38, x1: 0.82, y1: 0.44, c: body });
    s.push({ x0: 0.22, y0: 0.44, x1: 0.25, y1: 0.82, c: dark });
    s.push({ x0: 0.75, y0: 0.44, x1: 0.78, y1: 0.82, c: dark });
  }
  return s;
}

const living = { wall: [232, 226, 214], floor: [176, 140, 104], sky: [206, 222, 228], frame: [250, 248, 243], sofa: [124, 136, 118], sofaDark: [86, 96, 82], art: [196, 120, 84], lamp: [240, 228, 196], rug: [214, 204, 186] };
const livingOak = { ...living, floor: [206, 178, 140], rug: [196, 184, 164] };
const study = { wall: [62, 78, 84], floor: [150, 112, 82], sky: [214, 226, 230], frame: [236, 232, 224], sofa: [168, 92, 64], sofaDark: [40, 34, 30], art: [222, 196, 132], lamp: [244, 236, 210], desk: true };

const presWork = join(WORK, 'presentation');
const pics = join(presWork, 'pictures');
const work = join(presWork, 'work');
rmSync(presWork, { recursive: true, force: true });
const livingDir = join(pics, '1. Living room');
const studyDir = join(pics, '2. Study');
mkdirSync(livingDir, { recursive: true });
mkdirSync(studyDir, { recursive: true });
const pictures = [
  [livingDir, 'Living room 1.png', 1500, 1000, room(living)],
  [livingDir, 'Living room 2.png', 1000, 1250, room({ ...living, windowX: 0.06, sofaX: 0.38, floorY: 0.74 })],
  [livingDir, 'Living room 3.png', 1500, 1000, room({ ...living, windowX: 0.62, sofaX: 0.06 })],
  [livingDir, 'Living room 3 — oak floor.png', 1500, 1000, room({ ...livingOak, windowX: 0.62, sofaX: 0.06 })],
  [studyDir, 'Study 1.png', 1500, 1000, room(study)],
  [studyDir, 'Study 2.png', 1000, 1250, room({ ...study, windowX: 0.58, sofaX: 0.08, floorY: 0.74 })],
  [studyDir, 'Study 3.png', 1500, 1000, room({ ...study, wall: [222, 214, 200], windowX: 0.66, sofaX: 0.1 })],
];
for (const [dir, name, w, h, shapes] of pictures) writeFileSync(join(dir, name), drawPng(w, h, shapes));

console.log('gallery: preparing the presentation pictures');
const prep = node([join(SKILL, 'scripts', 'prepare-images.mjs'), pics, '--out', work, '--lang', 'en', '--tool', 'none']);
if (prep.status !== 0) fail(`prepare-images.mjs failed\n${prep.stdout}${prep.stderr}`);
const manifest = JSON.parse(readFileSync(join(work, 'manifest.json'), 'utf8'));
for (const r of manifest.rooms) r.nameSource = 'checked';
writeFileSync(join(work, 'manifest.json'), JSON.stringify(manifest, null, 2));
const slugs = manifest.rooms.map((r) => r.slug);
if (slugs.length !== 2) fail(`expected two rooms in the presentation manifest, got ${slugs.join(', ')}`);

const productDefs = {
  [slugs[0]]: [
    ['arc-floor-lamp', 'By the sofa', 'Arc floor lamp', 'Vantora Labs', 'Vantora Home', 594, 'EUR', { bg: [244, 242, 237], body: [236, 222, 186], dark: [60, 56, 50], kind: 'lamp' }],
    ['tide-rug', 'Under the coffee table', 'Tide wool rug, 200 x 300', 'Harbour Weavers', 'Harbour Weavers', 1290, 'EUR', { bg: [244, 242, 237], body: [206, 194, 172], dark: [150, 136, 112], kind: 'rug' }],
    ['low-oak-table', 'Coffee table', 'Low oak table', 'Nordhavn', 'Vantora Home', 420, 'EUR', { bg: [244, 242, 237], body: [176, 136, 96], dark: [140, 104, 70], kind: 'table' }],
  ],
  [slugs[1]]: [
    ['field-chair', 'Desk chair', 'Field chair in rust wool', 'Nordhavn', 'Nordhavn', 380, 'EUR', { bg: [240, 238, 233], body: [168, 92, 64], dark: [44, 38, 34], kind: 'chair' }],
    ['pin-desk-lamp', 'On the desk', 'Pin desk lamp', 'Vantora Labs', 'Vantora Home', 145, 'EUR', { bg: [240, 238, 233], body: [244, 236, 210], dark: [44, 38, 34], kind: 'lamp' }],
  ],
};
const products = {};
mkdirSync(join(work, 'products'), { recursive: true });
for (const [slug, defs] of Object.entries(productDefs)) {
  products[slug] = defs.map(([pslug, where, name, maker, shop, price, currency, look]) => {
    const file = `products/${pslug}.png`;
    writeFileSync(join(work, file), drawPng(600, 600, product(look)));
    return { slug: pslug, where, name, maker, shop, price, currency, url: `https://example.com/${pslug}`, image: file, width: 600, height: 600, fetchedAt: '2026-09-28T09:00:00.000Z' };
  });
}
writeFileSync(join(work, 'products.json'), JSON.stringify(products, null, 2));
writeFileSync(join(work, 'texts.json'), JSON.stringify({
  project: 'Two rooms on the ground floor of a house by the lake: a living room that faces the water and a study behind it. Light wood, wool and linen, one warm colour in each room.',
  rooms: {
    [slugs[0]]: 'The sofa faces the window, so the lake is the first thing you see from the door.\n\nView 3 comes in two floors. The darker one hides wear; the oak one makes the room look larger.',
    [slugs[1]]: 'A darker room for working in the evening. The desk stands across the window so the screen never takes the glare.',
  },
}, null, 2));

console.log(`gallery: building the presentation in ${styles.length} styles`);
for (const s of styles) {
  const out = join(SITE, 'matrix', `presentation--${s}.html`);
  const r = node([join(SKILL, 'scripts', 'build-presentation.mjs'), work, '--title', 'House by the lake', '--style', s, '--lang', 'en',
    '--brand-name', 'Harbour Interiors', '--date', '2026-09-28', '--out', out]);
  if (r.status !== 0) fail(`build-presentation.mjs --style ${s} exited ${r.status}\n${r.stdout}${r.stderr}`);
}

// ---------------------------------------------------------------------------
// 3. Examples: documents, brand sheets, hero, screenshots
// ---------------------------------------------------------------------------

const templateSlugs = readdirSync(TEMPLATES_DIR).filter((t) => existsSync(join(TEMPLATES_DIR, t, 'template.md'))).sort();
const templateMeta = Object.fromEntries(templateSlugs.map((t) => [t, frontmatter(join(TEMPLATES_DIR, t, 'template.md'))]));
const styleMeta = Object.fromEntries(styles.map((s) => [s, frontmatter(join(STYLES_DIR, s, 'DESIGN.md'))]));
const brandNames = list(join(EXAMPLES, 'brands'), /^[^.]/).filter((b) => existsSync(join(EXAMPLES, 'brands', b, 'brand-sheet.html')));

const SHOTS = join(EXAMPLES, 'screenshots');
mkdirSync(join(SITE, 'screenshots'), { recursive: true });
function shots(base) {
  const out = {};
  for (const mode of ['light', 'dark']) {
    const f = `${base}-${mode}.png`;
    if (existsSync(join(SHOTS, f))) {
      copyFileSync(join(SHOTS, f), join(SITE, 'screenshots', f));
      out[mode] = `screenshots/${f}`;
    }
  }
  return out;
}

// The brand's display name from its profile ("halde" -> "Studio Halde"),
// falling back to the capitalised slug.
function brandLabel(slug) {
  try {
    const meta = JSON.parse(readFileSync(join(EXAMPLES, 'brands', slug, 'profile.meta.json'), 'utf8'));
    const name = meta?.fields?.name?.value;
    if (name) return name;
  } catch { /* no profile.meta.json */ }
  return `${slug[0].toUpperCase()}${slug.slice(1)}`;
}

// "spec--consulting" -> spec in the consulting style; "proposal--halde"
// -> proposal in the taught halde brand.
function classify(base) {
  let template = null;
  let rest = '';
  for (const t of [...templateSlugs].sort((a, b) => b.length - a.length)) {
    if (base === t || base.startsWith(`${t}-`)) {
      template = t;
      rest = base.slice(t.length).replace(/^-+/, '');
      break;
    }
  }
  const tName = template ? templateMeta[template].name || template : null;
  if (styles.includes(rest)) return { template: tName, look: `${styleMeta[rest].name || rest} style`, brand: false };
  if (brandNames.includes(rest)) return { template: tName, look: `${brandLabel(rest)} brand, taught`, brand: true };
  return { template: tName, look: rest || null, brand: false };
}

mkdirSync(join(SITE, 'documents'), { recursive: true });
const documents = list(join(EXAMPLES, 'documents'), /\.html$/).map((f) => {
  const base = basename(f, '.html');
  copyFileSync(join(EXAMPLES, 'documents', f), join(SITE, 'documents', f));
  return { href: `documents/${f}`, base, ...htmlMeta(join(EXAMPLES, 'documents', f)), ...classify(base), shots: shots(base) };
});
// Style documents first, the two taught-brand documents last.
documents.sort((a, b) => Number(a.brand) - Number(b.brand) || a.base.localeCompare(b.base));

mkdirSync(join(SITE, 'brands'), { recursive: true });
const brands = brandNames.map((b) => {
  const src = join(EXAMPLES, 'brands', b, 'brand-sheet.html');
  copyFileSync(src, join(SITE, 'brands', `${b}.html`));
  return { href: `brands/${b}.html`, name: b, ...htmlMeta(src), shots: shots(`brand-sheet-${b}`) };
});

// GALLERY_HERO_DIR points the build at another folder, for checking the
// layout before examples/hero/ has its documents.
const HERO = process.env.GALLERY_HERO_DIR || join(EXAMPLES, 'hero');
const hasHero = existsSync(join(HERO, 'before.html')) && existsSync(join(HERO, 'after.html'));
if (hasHero) {
  mkdirSync(join(SITE, 'hero'), { recursive: true });
  for (const f of ['before.html', 'after.html']) copyFileSync(join(HERO, f), join(SITE, 'hero', f));
}

// ---------------------------------------------------------------------------
// 4. index.html
// ---------------------------------------------------------------------------

const viewerTemplates = [...matrixBodies, 'presentation']
  .filter((t, i, a) => a.indexOf(t) === i)
  .map((t) => ({ slug: t, name: templateMeta[t]?.name || t, description: templateMeta[t]?.description || '' }));
const viewerStyles = styles.map((s) => ({ slug: s, name: styleMeta[s]?.name || s, description: styleMeta[s]?.description || '' }));
for (const t of viewerTemplates) {
  for (const s of viewerStyles) {
    if (!existsSync(join(SITE, 'matrix', `${t.slug}--${s.slug}.html`))) fail(`viewer file missing: ${t.slug}--${s.slug}`);
  }
}

function thumb(item, cls) {
  if (!item.shots.light && !item.shots.dark) return '';
  const light = item.shots.light || item.shots.dark;
  const dark = item.shots.dark || item.shots.light;
  return `<span class="${cls}"><img src="${esc(light)}" data-light="${esc(light)}" data-dark="${esc(dark)}" alt="" width="1280" height="900" loading="lazy" decoding="async"></span>`;
}

const documentsHtml = documents.map((d) => `<li class="doc">
<a href="${esc(d.href)}">${thumb(d, 'shot')}
<span class="doc-meta">${esc([d.template, d.look].filter(Boolean).join(' · '))}</span>
<span class="doc-title">${esc(d.title)}</span></a>
${d.description ? `<p class="doc-desc">${esc(d.description)}</p>` : ''}
</li>`).join('\n');

const brandsHtml = brands.map((b) => `<li class="doc">
<a href="${esc(b.href)}">${thumb(b, 'shot')}
<span class="doc-meta">Brand sheet</span>
<span class="doc-title">${esc(b.title.replace(/\s+—\s+Brand Sheet$/i, ''))}</span></a>
${b.description ? `<p class="doc-desc">${esc(b.description)}</p>` : ''}
</li>`).join('\n');

const heroHtml = hasHero ? `<section class="section" id="same-notes-same-prompt" aria-labelledby="h-hero">
<div class="section-head">
<p class="section-no">01</p>
<h2 id="h-hero">Same notes, same prompt</h2>
<p class="section-lede">One set of project notes and one request, given to the same agent twice: once as it comes, once with letterhead installed.</p>
</div>
<div class="pair">
<figure class="pair-item">
<figcaption><span class="pair-label">Without letterhead</span> <a href="hero/before.html">Open full page<span aria-hidden="true"> ↗</span></a></figcaption>
<div class="pair-frame"><iframe src="hero/before.html" title="Without letterhead: the agent's default output" loading="lazy"></iframe></div>
</figure>
<figure class="pair-item">
<figcaption><span class="pair-label">With letterhead</span> <a href="hero/after.html">Open full page<span aria-hidden="true"> ↗</span></a></figcaption>
<div class="pair-frame"><iframe src="hero/after.html" title="With letterhead: the same notes on a letterhead" loading="lazy"></iframe></div>
</figure>
</div>
</section>` : '';

// Section numbers follow what is on the page.
let no = hasHero ? 1 : 0;
const num = () => String(++no).padStart(2, '0');
const nDocs = num();
const nViewer = num();
const nBrands = num();

const data = { templates: viewerTemplates, styles: viewerStyles };
const words = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen'];
const word = (n) => words[n] || String(n);
const brandDocs = documents.filter((d) => d.brand).length;

const contents = [
  hasHero ? ['same-notes-same-prompt', 'Same notes, same prompt'] : null,
  ['documents', 'Documents'],
  ['templates-and-styles', 'Every template in every style'],
  ['brand-sheets', 'Brand sheets'],
].filter(Boolean).map(([id, label], i) => `<li><a href="#${id}"><span class="n">${String(i + 1).padStart(2, '0')}</span>${esc(label)}</a></li>`).join('\n      ');

const fill = {
  CONTENTS: contents,
  REPO: esc(REPO),
  INSTALL: esc(INSTALL),
  HERO: heroHtml,
  N_DOCS: nDocs,
  N_VIEWER: nViewer,
  N_BRANDS: nBrands,
  DOC_COUNT: word(documents.length),
  DOC_COUNT_CAP: (() => { const w = word(documents.length); return w[0].toUpperCase() + w.slice(1); })(),
  BRAND_DOC_COUNT: word(brandDocs),
  DOCUMENTS: documentsHtml,
  BRANDS: brandsHtml,
  T_COUNT: String(viewerTemplates.length),
  S_COUNT: String(viewerStyles.length),
  TEMPLATE_OPTIONS: viewerTemplates.map((t) => `<option value="${esc(t.slug)}">${esc(t.name)}</option>`).join(''),
  STYLE_OPTIONS: viewerStyles.map((s) => `<option value="${esc(s.slug)}">${esc(s.name)}</option>`).join(''),
  TEMPLATE_LIST: viewerTemplates.map((t) => `<li><button type="button" data-t="${esc(t.slug)}">${esc(t.name)}</button></li>`).join(''),
  STYLE_LIST: viewerStyles.map((s) => `<li><button type="button" data-s="${esc(s.slug)}">${esc(s.name)}</button></li>`).join(''),
  DATA: JSON.stringify(data).replace(/</g, '\\u003c'),
};
let page = readFileSync(PAGE, 'utf8');
page = page.replace(/\{\{([A-Z_]+)\}\}/g, (m, k) => {
  if (!(k in fill)) fail(`page.html: unknown placeholder ${m}`);
  return fill[k];
});
writeFileSync(join(SITE, 'index.html'), page);
writeFileSync(join(SITE, '.nojekyll'), '');

console.log(`gallery: ${viewerTemplates.length} templates x ${viewerStyles.length} styles, ${documents.length} documents, ${brands.length} brand sheets${hasHero ? ', hero pair' : ', no hero pair (examples/hero/before.html and after.html not both there)'}`);
console.log(`gallery: site written to ${SITE}`);
