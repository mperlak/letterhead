#!/usr/bin/env node
// Gallery site builder (GitHub Pages: https://mperlak.github.io/letterhead/).
//
// Builds a static site into temp/site/:
//   index.html                  the gallery (dev-scripts/gallery/page.html with
//                               the tiles filled in)
//   documents/*.html            examples/documents/, as they are
//   brands/<brand>.html         examples/brands/<brand>/brand-sheet.html
//   styles/<style>.html         the status update sample in every style
//                               (build-matrix.mjs)
//   screenshots/*.webp          the light/dark thumbnails the page shows
//   .nojekyll
//
// The page is a picture grid: one group per brand (its brand sheet, then its
// documents), then the nine styles. Thumbnails come from examples/screenshots/
// (dev-scripts/screenshots.mjs --all); a document without one stops the build,
// so the page never falls back to a list of titles.
//
// Usage:
//   node dev-scripts/build-gallery.mjs
//   cd temp/site && python3 -m http.server 8000   # look at it locally

import { readFileSync, writeFileSync, mkdirSync, readdirSync, existsSync, rmSync, copyFileSync } from 'node:fs';
import { join, dirname, basename } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SKILL = join(ROOT, 'letterhead');
const EXAMPLES = join(ROOT, 'examples');
const SHOTS = join(EXAMPLES, 'screenshots');
const PAGE = join(ROOT, 'dev-scripts', 'gallery', 'page.html');
const SITE = join(ROOT, 'temp', 'site');

const REPO = 'https://github.com/mperlak/letterhead';
const DOWNLOAD = `${REPO}/releases/latest/download/letterhead.zip`;
const STYLE_SAMPLE = 'status-update';

function fail(msg) {
  console.error(`gallery: ${msg}`);
  process.exit(1);
}
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const unesc = (s) => String(s).replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, '&');
const dirs = (dir) => readdirSync(dir).filter((f) => !f.startsWith('.')).sort();

function nameOf(file) {
  const m = readFileSync(file, 'utf8').match(/^name:\s*"?(.+?)"?\s*$/m);
  return m ? m[1] : basename(dirname(file));
}
function titleOf(file) {
  const m = readFileSync(file, 'utf8').match(/<title>([^<]*)<\/title>/);
  return m ? unesc(m[1]).trim() : basename(file, '.html');
}
// "halde" -> "Studio Halde", from the brand profile.
function brandName(slug) {
  try {
    const name = JSON.parse(readFileSync(join(EXAMPLES, 'brands', slug, 'profile.meta.json'), 'utf8'))?.fields?.name?.value;
    if (name) return name;
  } catch { /* no profile.meta.json */ }
  return slug[0].toUpperCase() + slug.slice(1);
}

const templates = Object.fromEntries(dirs(join(SKILL, 'templates'))
  .filter((t) => existsSync(join(SKILL, 'templates', t, 'template.md')))
  .map((t) => [t, nameOf(join(SKILL, 'templates', t, 'template.md'))]));
const styles = dirs(join(SKILL, 'styles')).map((s) => ({ slug: s, name: nameOf(join(SKILL, 'styles', s, 'DESIGN.md')) }));

// ---------------------------------------------------------------------------
// The status update in every style, checked by build-matrix.mjs
// ---------------------------------------------------------------------------

console.log('gallery: building the template x style matrix');
const matrix = spawnSync(process.execPath, [join(ROOT, 'dev-scripts', 'build-matrix.mjs')], { encoding: 'utf8' });
process.stdout.write(matrix.stdout);
if (matrix.status !== 0) {
  process.stderr.write(matrix.stderr);
  fail('build-matrix.mjs failed');
}

rmSync(SITE, { recursive: true, force: true });
for (const d of ['documents', 'brands', 'styles', 'screenshots']) mkdirSync(join(SITE, d), { recursive: true });

for (const s of styles) {
  const src = join(ROOT, 'temp', 'matrix', `${STYLE_SAMPLE}--${s.slug}.html`);
  if (!existsSync(src)) fail(`missing matrix output ${src}`);
  copyFileSync(src, join(SITE, 'styles', `${s.slug}.html`));
}

// ---------------------------------------------------------------------------
// Tiles: per brand, its brand sheet and then its documents
// ---------------------------------------------------------------------------

// Copies <base>-light.webp (or <base>.webp) and <base>-dark.webp and returns
// their site paths.
function shots(base) {
  const out = {};
  for (const mode of ['light', 'dark']) {
    let f = `${base}-${mode}.webp`;
    if (mode === 'light' && !existsSync(join(SHOTS, f))) f = `${base}.webp`;
    if (!existsSync(join(SHOTS, f))) fail(`missing thumbnail examples/screenshots/${base}-${mode}.webp (run node dev-scripts/screenshots.mjs --all)`);
    copyFileSync(join(SHOTS, f), join(SITE, 'screenshots', f));
    out[mode] = `screenshots/${f}`;
  }
  return out;
}

const brandSlugs = dirs(join(EXAMPLES, 'brands')).filter((b) => existsSync(join(EXAMPLES, 'brands', b, 'brand-sheet.html')));
const docFiles = dirs(join(EXAMPLES, 'documents')).filter((f) => f.endsWith('.html'));

const groups = brandSlugs.map((b) => {
  copyFileSync(join(EXAMPLES, 'brands', b, 'brand-sheet.html'), join(SITE, 'brands', `${b}.html`));
  const tiles = [{ href: `brands/${b}.html`, label: 'Brand sheet', title: titleOf(join(EXAMPLES, 'brands', b, 'brand-sheet.html')), shots: shots(`brand-sheet--${b}`) }];
  for (const f of docFiles) {
    const [template, brand] = basename(f, '.html').split('--');
    if (brand !== b) continue;
    if (!templates[template]) fail(`documents/${f}: no template called ${template}`);
    copyFileSync(join(EXAMPLES, 'documents', f), join(SITE, 'documents', f));
    tiles.push({ href: `documents/${f}`, label: templates[template], title: titleOf(join(EXAMPLES, 'documents', f)), shots: shots(basename(f, '.html')) });
  }
  return { slug: b, name: brandName(b), tiles };
});
for (const f of docFiles) {
  const brand = basename(f, '.html').split('--')[1];
  if (!brandSlugs.includes(brand)) fail(`documents/${f}: no brand sheet in examples/brands/${brand}/`);
}
// The brands with the most documents first.
groups.sort((a, b) => b.tiles.length - a.tiles.length || a.name.localeCompare(b.name));

function picture(sh, alt, width, height, loading = 'lazy') {
  return `<picture><source media="(prefers-color-scheme: dark)" srcset="${esc(sh.dark)}"><img src="${esc(sh.light)}" alt="${esc(alt)}" width="${width}" height="${height}" loading="${loading}" decoding="async"></picture>`;
}

const groupsHtml = groups.map((g) => `<section class="brand" id="${esc(g.slug)}">
<h2>${esc(g.name)}</h2>
<ul class="grid">
${g.tiles.map((t) => `<li><a href="${esc(t.href)}">${picture(t.shots, t.title, 1600, 2000)}<span>${esc(t.label)}</span></a></li>`).join('\n')}
</ul>
</section>`).join('\n');

const hero = shots('hero-before-after');
const sheet = shots('styles-contact-sheet');

const fill = {
  REPO: esc(REPO),
  DOWNLOAD: esc(DOWNLOAD),
  HERO: picture(hero, 'The same weekly status update twice: on the left the usual agent-made page, on the right on the client\'s letterhead.', 2400, 1728, 'eager'),
  BRANDS: groupsHtml,
  STYLES_SHEET: picture(sheet, `One status update in each of the ${styles.length} styles.`, 1800, 2154),
  STYLE_LINKS: styles.map((s) => `<a href="styles/${esc(s.slug)}.html">${esc(s.name)}</a>`).join(' · '),
  STYLE_COUNT: String(styles.length),
};
let page = readFileSync(PAGE, 'utf8');
page = page.replace(/\{\{([A-Z_]+)\}\}/g, (m, k) => {
  if (!(k in fill)) fail(`page.html: unknown placeholder ${m}`);
  return fill[k];
});
writeFileSync(join(SITE, 'index.html'), page);
writeFileSync(join(SITE, '.nojekyll'), '');

const nDocs = groups.reduce((n, g) => n + g.tiles.length - 1, 0);
console.log(`gallery: ${groups.length} brands, ${nDocs} documents, ${styles.length} styles`);
console.log(`gallery: site written to ${SITE}`);
