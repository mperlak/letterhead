#!/usr/bin/env node
// Product cards for a presentation document (templates/presentation): reads
// shop links grouped by room, takes each product's name, maker, price and
// main photo from the shop's own page, and writes products.json next to the
// manifest from prepare-images.mjs.
//
// Usage:
//   node product-cards.mjs <links.txt | links.json> --out <workdir>
//        [--lang pl|en] [--max 560] [--refresh] [--tool auto|sips|magick|pillow|none]
//
// links.txt: a "# <room>" line opens a room (its name or slug from the
// manifest); every line after it holds one link, optionally with where the
// product sits, before the link:
//   # Main bedroom
//   Lamp on the left | https://shop.example/lamp-312
//   https://shop.example/bench
// links.json: { "<room-slug>": [ { "where": "...", "url": "..." } ] }. A
// JSON entry may also carry name, maker, shop, price, currency and image (a
// local file); given fields win over the page, and an entry with a name and
// an image is not fetched at all. That is how a product from a blocked shop
// gets its card.
//
// What it does not do: get around a shop that blocks scripts (403/429, a
// "checking your browser" page, a captcha). Such a product is written with
// blocked: true and the reason; ask the user for the photo and details, or
// read the page in the user's own browser if one is connected.
//
// Photo: the product image from the page's structured data, then og:image.
// An image that looks like a share graphic or carries a watermark (masked,
// watermark, og-image, social, share) is skipped, and the page is searched
// for another picture of the same product. Photos are shrunk (long edge
// <= --max) when sips, ImageMagick or Pillow is present.
//
// A second run keeps what an earlier products.json already has for the same
// link (including the agent's corrections) and only fetches new links and
// blocked ones; --refresh fetches everything again.
//
// Exit codes:
//   0 — products.json written (blocked products are listed, not fatal)
//   1 — usage error or unreadable input

import { readFileSync, writeFileSync, mkdirSync, existsSync, rmSync, statSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { parse } from './vendor/node-html-parser.mjs';
import { imageSize, detectImageTool, encodeImage, slugify, bytesText, EXT } from './lib/images.mjs';

const USAGE = 'usage: node product-cards.mjs <links.txt | links.json> --out <workdir> [--lang pl|en] [--max 560] [--refresh] [--tool auto|sips|magick|pillow|none]';
const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0 Safari/537.36';
const TIMEOUT_MS = 20000;

function fail(msg) {
  console.error(`product-cards: ${msg}`);
  process.exit(1);
}

function parseArgs(argv) {
  const o = { input: null, out: null, lang: 'en', max: 560, refresh: false, tool: 'auto' };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '-h' || a === '--help') { console.log(USAGE); process.exit(0); }
    else if (a === '--out') o.out = argv[++i];
    else if (a === '--lang') o.lang = argv[++i];
    else if (a === '--max') o.max = Number(argv[++i]);
    else if (a === '--refresh') o.refresh = true;
    else if (a === '--tool') o.tool = argv[++i];
    else if (a.startsWith('--')) fail(`unknown option ${a}\n${USAGE}`);
    else if (!o.input) o.input = a;
    else fail(USAGE);
  }
  if (!o.input || !o.out) fail(USAGE);
  if (!(o.max >= 100)) fail('--max must be a number of pixels, at least 100');
  return o;
}

// ---------------------------------------------------------------------------
// Input
// ---------------------------------------------------------------------------

function readLinks(path) {
  let raw;
  try {
    raw = readFileSync(path, 'utf8');
  } catch (e) {
    fail(`cannot read ${path}: ${e.code || e.message}`);
  }
  const groups = [];
  if (/\.json$/i.test(path) || /^\s*[{[]/.test(raw)) {
    let data;
    try { data = JSON.parse(raw); } catch (e) { fail(`${path} is not valid JSON: ${e.message}`); }
    const rooms = data.rooms && !Array.isArray(data.rooms) ? data.rooms : data;
    for (const [room, list] of Object.entries(rooms)) {
      if (!Array.isArray(list)) fail(`${path}: "${room}" must be a list of { where, url }`);
      groups.push({ room, items: list.map((x) => (typeof x === 'string' ? { url: x } : { ...x })) });
    }
    return groups;
  }
  let current = null;
  raw.split(/\r?\n/).forEach((line, n) => {
    const text = line.trim();
    if (!text) return;
    const head = /^#+\s*(.+)$/.exec(text);
    if (head) {
      current = { room: head[1].trim(), items: [] };
      groups.push(current);
      return;
    }
    const url = /(https?:\/\/\S+)/.exec(text);
    if (!url) {
      console.warn(`product-cards: line ${n + 1} has no link, skipped: ${text.slice(0, 60)}`);
      return;
    }
    if (!current) fail(`line ${n + 1}: a link before the first "# <room>" line`);
    const where = text.slice(0, url.index).replace(/[\s|:–—-]+$/, '').trim();
    current.items.push({ where: where || null, url: url[1].replace(/[),.;]+$/, '') });
  });
  return groups;
}

// Tracking parameters go; the ones that pick the product (variant, size) stay.
const TRACKING = /^(?:utm_\w+|_pos|_fid|_ss|_sid|_psq|_v|fbclid|gclid|gbraid|wbraid|dclid|msclkid|yclid|srsltid|mc_cid|mc_eid|igshid|ref|ref_src|_ga|_gl|trk|spm)$/i;
function cleanUrl(u) {
  try {
    const url = new URL(u);
    for (const key of [...url.searchParams.keys()]) if (TRACKING.test(key)) url.searchParams.delete(key);
    url.hash = '';
    return url.toString();
  } catch {
    return u;
  }
}

// ---------------------------------------------------------------------------
// Page reading
// ---------------------------------------------------------------------------

const BLOCK_PAGE = /security checkpoint|checking your browser|just a moment\.\.\.|attention required|verify you are (?:a )?human|are you a robot|captcha|access denied|request unsuccessful|px-captcha|cf-chl-|challenge-platform/i;

function decode(s) {
  return String(s)
    .replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;|&#x27;|&apos;/g, "'")
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&nbsp;/g, ' ')
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)))
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)));
}

function metaOf(root, ...keys) {
  for (const key of keys) {
    for (const m of root.querySelectorAll('meta')) {
      const k = (m.getAttribute('property') || m.getAttribute('name') || m.getAttribute('itemprop') || '').toLowerCase();
      if (k === key) {
        const v = m.getAttribute('content');
        if (v && v.trim()) return decode(v.trim());
      }
    }
  }
  return null;
}

function jsonLdProducts(root) {
  const out = [];
  const walk = (x) => {
    if (!x || typeof x !== 'object') return;
    if (Array.isArray(x)) { x.forEach(walk); return; }
    const type = [].concat(x['@type'] || []).join(' ');
    if (/\bProduct(?:Group)?\b/i.test(type)) out.push(x);
    if (x['@graph']) walk(x['@graph']);
    if (x.mainEntity) walk(x.mainEntity);
  };
  for (const s of root.querySelectorAll('script')) {
    if (!/ld\+json/i.test(s.getAttribute('type') || '')) continue;
    try { walk(JSON.parse(s.rawText.trim())); } catch { /* a broken block is skipped */ }
  }
  return out;
}

function parsePrice(v) {
  if (v === null || v === undefined || v === '') return null;
  if (typeof v === 'number') return Number.isFinite(v) ? v : null;
  let s = String(v).replace(/[^\d.,-]/g, '');
  if (s.includes(',') && s.includes('.')) s = s.lastIndexOf(',') > s.lastIndexOf('.') ? s.replace(/\./g, '').replace(',', '.') : s.replace(/,/g, '');
  else if (s.includes(',')) s = /,\d{3}$/.test(s) && !/,\d{1,2}$/.test(s) ? s.replace(/,/g, '') : s.replace(',', '.');
  const n = Number(s);
  return Number.isFinite(n) && n > 0 ? n : null;
}

function offerOf(p) {
  const offers = [].concat(p.offers || []);
  for (const o of offers) {
    if (!o || typeof o !== 'object') continue;
    const spec = [].concat(o.priceSpecification || [])[0] || {};
    const price = parsePrice(o.price ?? o.lowPrice ?? spec.price);
    if (price !== null) return { price, currency: o.priceCurrency || spec.priceCurrency || null };
  }
  if (Array.isArray(p.hasVariant)) {
    for (const v of p.hasVariant) {
      const r = offerOf(v);
      if (r) return r;
    }
  }
  return null;
}

function ldImages(p) {
  return [].concat(p.image || []).map((i) => (typeof i === 'string' ? i : i && (i.url || i.contentUrl))).filter(Boolean);
}

// A shop's brand field is sometimes an internal vendor handle
// ("acme-editions-prod"), not a name a reader recognises.
function looksLikeHandle(s) {
  return /^[a-z0-9]+(?:[-_][a-z0-9]+)+$/.test(s);
}

function hostLabel(u) {
  try {
    const host = new URL(u).hostname;
    // An address with no name (127.0.0.1, [::1], localhost) is not a shop name.
    if (/^[\d.]+$|^\[|:|^localhost$/i.test(host)) return null;
    const parts = host.replace(/^www\./, '').split('.');
    const label = parts.length > 2 && parts[parts.length - 2].length <= 3 ? parts[parts.length - 3] : parts[parts.length - 2] || parts[0];
    return label.charAt(0).toUpperCase() + label.slice(1);
  } catch {
    return null;
  }
}

function cleanTitle(title, shop) {
  if (!title) return null;
  let t = title.trim();
  if (shop) {
    const esc = shop.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    t = t.replace(new RegExp(`\\s*[|–—-]\\s*${esc}\\s*$`, 'i'), '').trim();
  }
  return t || null;
}

// ---------------------------------------------------------------------------
// Photo choice
// ---------------------------------------------------------------------------

// Matched against whole name parts ("sofa_masked.jpg", "/og-image/"), so a
// product called "silicone" is not mistaken for an icon.
const SHARE_OR_MARKED = /(?:^|[/_.=&?-])(?:masked|watermark(?:ed)?|wm|og[-_]?image|opengraph|social|share|sharing|facebook|twitter|fb|placeholder|logo|sprite|favicon|icons?)(?=$|[/_.&?=-])/i;
const SOCIAL_HOST = /(?:pinterest|facebook|twitter|x\.com|instagram|linkedin)\./i;
const PRODUCT_HINT = /display|main|product|packshot|front|primary|hero/i;
const SIDE_HINT = /roll|detail|zoom|thumb|swatch|room|interior|lifestyle|mood/i;

function absolute(u, base) {
  try { return new URL(decode(u), base).toString(); } catch { return null; }
}

function stripSize(u) {
  try {
    const url = new URL(u);
    url.search = '';
    return url.toString();
  } catch {
    return u;
  }
}

function sizeHint(u) {
  try {
    const p = new URL(u).searchParams;
    return Number(p.get('w') || p.get('width') || p.get('wid') || 0) || (new URL(u).search ? 1 : 100000);
  } catch {
    return 0;
  }
}

function dirOf(u) {
  try {
    const path = new URL(u).pathname;
    return path.slice(0, path.lastIndexOf('/') + 1);
  } catch {
    return '';
  }
}

// Every picture the page mentions: img src/srcset, source srcset, links, and
// bare image URLs in scripts (galleries are often built from JSON).
function pageImages(root, html, base) {
  const found = [];
  const add = (u) => {
    const abs = absolute(u, base);
    if (abs && /^https?:/.test(abs) && !SOCIAL_HOST.test(abs) && !found.includes(abs)) found.push(abs);
  };
  for (const el of root.querySelectorAll('img, source')) {
    for (const attr of ['src', 'data-src', 'data-zoom-image', 'data-large']) {
      const v = el.getAttribute(attr);
      if (v && !v.startsWith('data:')) add(v);
    }
    for (const attr of ['srcset', 'data-srcset']) {
      const v = el.getAttribute(attr);
      if (v) v.split(',').map((x) => x.trim().split(/\s+/)[0]).filter(Boolean).forEach(add);
    }
  }
  for (const m of html.matchAll(/https?:(?:\/\/|\\\/\\\/)[^\s"'<>()\\]+?\.(?:jpe?g|png|webp)(?:\?[^\s"'<>()\\]*)?/gi)) add(m[0].replace(/\\\//g, '/'));
  return found;
}

function candidates(product, root, html, base, name) {
  const primary = [];
  for (const u of [...(product ? ldImages(product) : []), metaOf(root, 'og:image', 'og:image:secure_url', 'twitter:image')]) {
    const abs = u && absolute(u, base);
    if (abs && !primary.includes(abs)) primary.push(abs);
  }
  const accepted = primary.filter((u) => !SHARE_OR_MARKED.test(new URL(u).pathname + new URL(u).search));
  const rejected = primary.filter((u) => !accepted.includes(u));
  if (!rejected.length) return { list: accepted, rejected };

  // A share graphic or a watermarked image: look for another picture of the
  // same product on the page, in the rejected image's folder or named like
  // the product. A random banner is worse than no picture.
  const dirs = new Set(rejected.map(dirOf));
  const tokens = slugify(name || '').split('-').filter((t) => t.length > 3);
  const pool = pageImages(root, html, base).filter((u) => !SHARE_OR_MARKED.test(new URL(u).pathname) && !primary.includes(u));
  const scored = [];
  pool.forEach((u, order) => {
    const file = new URL(u).pathname.toLowerCase();
    let score = 0;
    if (dirs.has(dirOf(u))) score += 4;
    if (tokens.some((t) => file.includes(t))) score += 2;
    if (score === 0) return;
    if (PRODUCT_HINT.test(file)) score += 1;
    if (SIDE_HINT.test(file)) score -= 1;
    scored.push({ u, score, order, key: stripSize(u), size: sizeHint(u) });
  });
  // One entry per picture: the largest size the page offers.
  const byKey = new Map();
  for (const s of scored) {
    const have = byKey.get(s.key);
    if (!have || s.size > have.size) byKey.set(s.key, { ...s, order: have ? Math.min(have.order, s.order) : s.order });
  }
  const fallback = [...byKey.values()].sort((a, b) => b.score - a.score || a.order - b.order).map((s) => s.u);
  return { list: [...accepted, ...fallback], rejected };
}

async function download(u, referer) {
  const tries = [u];
  if (u.startsWith('http://')) tries.unshift(`https://${u.slice(7)}`);
  let last = null;
  for (const url of tries) {
    try {
      const r = await fetch(url, {
        headers: { 'user-agent': UA, accept: 'image/jpeg,image/png,image/webp;q=0.9,image/*;q=0.5', referer },
        redirect: 'follow',
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
      if (!r.ok) { last = `http ${r.status}`; continue; }
      return { buf: Buffer.from(await r.arrayBuffer()) };
    } catch (e) {
      last = e.name === 'TimeoutError' ? 'timeout' : e.message;
    }
  }
  return { error: last };
}

// ---------------------------------------------------------------------------

async function fetchProduct(item, lang) {
  const url = item.url;
  let res;
  try {
    res = await fetch(url, {
      headers: {
        'user-agent': UA,
        accept: 'text/html,application/xhtml+xml;q=0.9,*/*;q=0.8',
        'accept-language': lang === 'pl' ? 'pl-PL,pl;q=0.9,en;q=0.8' : 'en-GB,en;q=0.9',
      },
      redirect: 'follow',
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch (e) {
    return { error: e.name === 'TimeoutError' ? 'the page did not answer in 20 s' : `could not reach the page (${e.cause?.code || e.message})` };
  }
  const html = await res.text().catch(() => '');
  if ([401, 403, 429, 503].includes(res.status)) {
    const why = BLOCK_PAGE.test(html) ? 'a bot check page' : 'the shop refuses scripts';
    return { blocked: true, reason: `http ${res.status}, ${why}` };
  }
  if (!res.ok) return { error: `http ${res.status}` };
  const root = parse(html);
  const products = jsonLdProducts(root);
  const product = products[0] || null;
  const title = root.querySelector('title')?.text?.trim() || '';
  if (!product && !metaOf(root, 'og:title') && BLOCK_PAGE.test(`${title} ${html.slice(0, 4000)}`)) {
    return { blocked: true, reason: `a bot check page ("${decode(title).slice(0, 60)}")` };
  }
  const site = metaOf(root, 'og:site_name');
  const shop = site || hostLabel(res.url || url);
  const brandRaw = product && (typeof product.brand === 'string' ? product.brand : product.brand?.name);
  const maker = brandRaw && !looksLikeHandle(brandRaw.trim()) ? decode(brandRaw.trim()) : null;
  const name = product?.name ? decode(String(product.name).trim()) : cleanTitle(metaOf(root, 'og:title') || decode(title), shop);
  const offer = product ? offerOf(product) : null;
  const price = offer?.price ?? parsePrice(metaOf(root, 'product:price:amount', 'og:price:amount'));
  const currency = offer?.currency || metaOf(root, 'product:price:currency', 'og:price:currency');
  const { list, rejected } = candidates(product, root, html, res.url || url, name);
  return { name, maker, shop, price, currency: currency ? currency.toUpperCase() : null, images: list, rejected, finalUrl: res.url };
}

async function savePhoto(buf, base, outDir, opts, tool) {
  const size = imageSize(buf);
  if (!size) return { error: 'not a picture a browser shows everywhere' };
  if (size.width && size.height && Math.max(size.width, size.height) < 200) return { error: `too small (${size.width}x${size.height})` };
  const tmp = join(outDir, `.${base}.src`);
  writeFileSync(tmp, buf);
  try {
    if (!tool) {
      if (!EXT[size.type]) return { error: `${size.type} needs an image tool to convert` };
      const file = `${base}.${EXT[size.type]}`;
      writeFileSync(join(outDir, file), buf);
      return { file, width: size.width, height: size.height, bytes: buf.length, unresized: Math.max(size.width, size.height) > opts.max };
    }
    // A cut-out product on transparency keeps it: the card behind is light.
    const format = size.alpha ? 'png' : 'jpeg';
    const file = `${base}.${format === 'png' ? 'png' : 'jpg'}`;
    const r = await encodeImage(tool, tmp, join(outDir, file), { maxEdge: opts.max, quality: 72, format, srcSize: size });
    return { file, width: r.width, height: r.height, bytes: r.bytes };
  } catch (e) {
    return { error: e.message };
  } finally {
    rmSync(tmp, { force: true });
  }
}

// ---------------------------------------------------------------------------

const opts = parseArgs(process.argv.slice(2));
const work = resolve(opts.out);
const inputPath = resolve(opts.input);
const groups = readLinks(inputPath);
const tool = detectImageTool(opts.tool);
const warnings = [];
if (!tool) warnings.push('no image tool found (sips, ImageMagick, Python with Pillow): product photos are kept at the size the shop serves');

let manifest = null;
try { manifest = JSON.parse(readFileSync(join(work, 'manifest.json'), 'utf8')); } catch { manifest = null; }
if (!manifest) warnings.push(`no manifest.json in ${work}: room names are slugged as written; run prepare-images.mjs first to match them`);
function roomSlug(label) {
  const s = slugify(label);
  if (!manifest) return s;
  const hit = manifest.rooms.find((r) => r.slug === label || r.slug === s || slugify(r.name) === s || slugify(r.folder || '') === s);
  if (!hit) warnings.push(`room "${label}" is not in the manifest; its products will not show until the names match`);
  return hit ? hit.slug : s;
}

const productsPath = join(work, 'products.json');
let previous = {};
if (existsSync(productsPath)) {
  try { previous = JSON.parse(readFileSync(productsPath, 'utf8')); } catch { previous = {}; }
}
const prevByUrl = new Map(Object.values(previous).flat().filter((p) => p && p.url).map((p) => [p.url, p]));

const outDir = join(work, 'products');
mkdirSync(outDir, { recursive: true });
const result = {};
const now = new Date().toISOString();
const lines = [];

for (const group of groups) {
  const slug = roomSlug(group.room);
  const list = (result[slug] = result[slug] || []);
  const taken = new Set(list.map((p) => p.slug));
  for (const item of group.items) {
    if (!item.url && !item.name) continue;
    const url = item.url ? cleanUrl(item.url) : null;
    const before = url ? prevByUrl.get(url) : null;
    const where = item.where ?? before?.where ?? null;
    let entry;

    if (before && !before.blocked && !before.error && !opts.refresh && (!before.image || existsSync(join(work, before.image)))) {
      entry = { ...before, where };
      lines.push(`  kept     ${slug} / ${entry.slug}`);
    } else {
      const manual = Boolean(item.name && item.image);
      const page = manual || !url ? {} : await fetchProduct(item, opts.lang);
      const name = item.name || page.name || null;
      const base = item.slug || before?.slug || slugify(name || (url ? new URL(url).pathname.split('/').filter(Boolean).pop() || '' : '')).split('-').slice(0, 4).join('-') || 'product';
      let pslug = base;
      for (let i = 2; taken.has(pslug); i++) pslug = `${base}-${i}`;
      entry = {
        slug: pslug,
        where,
        name,
        maker: item.maker || page.maker || null,
        shop: item.shop || page.shop || (url ? hostLabel(url) : null),
        price: item.price !== undefined ? parsePrice(item.price) : page.price ?? null,
        currency: item.currency || page.currency || null,
        url,
        image: null,
        width: null,
        height: null,
        fetchedAt: manual || !url ? null : now,
      };
      if (page.blocked) Object.assign(entry, { blocked: true, reason: page.reason });
      if (page.error) Object.assign(entry, { error: page.error });

      if (item.image) {
        const src = resolve(dirname(inputPath), item.image);
        try {
          const saved = await savePhoto(readFileSync(src), `${slug}-${pslug}`, outDir, opts, tool);
          if (saved.error) warnings.push(`${slug} / ${pslug}: ${item.image}: ${saved.error}`);
          else Object.assign(entry, { image: `products/${saved.file}`, width: saved.width, height: saved.height });
        } catch (e) {
          warnings.push(`${slug} / ${pslug}: cannot read ${item.image} (${e.code || e.message})`);
        }
      } else if (page.images) {
        const notes = [];
        for (const u of page.images) {
          const dl = await download(u, url);
          if (dl.error) { notes.push(`${dl.error}`); continue; }
          const saved = await savePhoto(dl.buf, `${slug}-${pslug}`, outDir, opts, tool);
          if (saved.error) { notes.push(saved.error); continue; }
          Object.assign(entry, { image: `products/${saved.file}`, width: saved.width, height: saved.height, imageUrl: u });
          if (saved.unresized) warnings.push(`${slug} / ${pslug}: photo kept at ${saved.width}x${saved.height} (no tool to shrink it)`);
          break;
        }
        if (page.rejected?.length) entry.imageSkipped = page.rejected;
        if (!entry.image) {
          const why = page.images.length ? `no usable photo (${notes.slice(0, 2).join('; ')})` : page.rejected?.length ? 'only a share graphic or a watermarked photo on the page' : 'no photo on the page';
          entry.imageNote = why;
        }
      }
      // A blocked page with the user's own details filled in is no longer blocked.
      if (entry.blocked && entry.name && entry.image) { delete entry.blocked; delete entry.reason; }
      const state = entry.blocked ? `blocked  (${entry.reason})` : entry.error ? `failed   (${entry.error})` : entry.image ? (manual ? 'given' : 'fetched') : `no photo (${entry.imageNote || ''})`;
      const [label, why = ''] = state.split(/\s+(?=\()/);
      lines.push(`  ${label.padEnd(8)} ${slug} / ${entry.slug}${why ? ` ${why}` : ''}${entry.imageSkipped ? ' (skipped a share or watermarked image)' : ''}`);
    }
    taken.add(entry.slug);
    list.push(entry);
  }
}

writeFileSync(productsPath, `${JSON.stringify(result, null, 2)}\n`);
for (const l of lines) console.log(l);
const all = Object.values(result).flat();
const blocked = all.filter((p) => p.blocked);
const failed = all.filter((p) => p.error);
const noPhoto = all.filter((p) => !p.blocked && !p.error && !p.image);
const photoBytes = all.reduce((a, p) => a + (p.image && existsSync(join(work, p.image)) ? statSync(join(work, p.image)).size : 0), 0);
console.log(`product-cards: ${all.length} product(s), ${all.length - blocked.length - failed.length} read, ${blocked.length} blocked, ${failed.length} failed, photos ${bytesText(photoBytes)}`);
console.log(`product-cards: wrote ${productsPath}`);
if (blocked.length || failed.length || noPhoto.length) {
  console.log('product-cards: needs the user (the build leaves these out until they have a name and a photo):');
  for (const p of [...blocked, ...failed, ...noPhoto]) console.log(`  - ${p.url}: ${p.reason || p.error || p.imageNote}`);
}
console.log('product-cards: check names and makers against the shop before the build; the script copies what the page says.');
if (warnings.length) {
  console.warn(`product-cards: ${warnings.length} warning(s):`);
  for (const w of warnings) console.warn(`  - ${w}`);
}
