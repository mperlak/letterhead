#!/usr/bin/env node
// Smoke test for the presentation scripts: prepare-images.mjs,
// product-cards.mjs and build-presentation.mjs (templates/presentation).
//
// Everything is synthetic and offline. The pictures are PNGs written here
// with node:zlib; the shop pages come from a local node:http server: a
// product with JSON-LD, one whose structured image is a watermarked
// ("masked") share graphic with a clean photo elsewhere on the page, a shop
// handle as the brand, a 429 checkpoint, a 200 "just a moment" page and a
// page with only a logo for a picture. Then:
//   - prepare-images: room order, names from capitalised folders marked for
//     checking, file-prefix and variant parsing (em dash and "- wersja"),
//     numeric order, ids, never enlarging, the --tool none fallback;
//   - product-cards: fields from JSON-LD, tracking parameters dropped, the
//     masked image skipped for the product's own photo, blocked pages
//     marked and left for the user, a second run keeping what it has and
//     filling a blocked product from links.json;
//   - build-presentation: the full document and --only for every style with
//     the synthetic brand profiles (dev-scripts/fixtures/brand-sheet/*),
//     check-document clean; figure, product and variant ids; no link in the
//     viewer; the single-room shape; Polish and English words (with Polish
//     plural forms) and --kind general.
//
// Usage: node dev-scripts/presentation-smoke.mjs
// Exit codes: 0 all assertions passed, 1 a run or assertion failed.

import { spawnSync, spawn } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, readdirSync, existsSync } from 'node:fs';
import { createServer } from 'node:http';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { deflateSync } from 'node:zlib';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SCRIPTS = join(ROOT, 'letterhead', 'scripts');
const PREPARE = join(SCRIPTS, 'prepare-images.mjs');
const PRODUCTS = join(SCRIPTS, 'product-cards.mjs');
const BUILD = join(SCRIPTS, 'build-presentation.mjs');
const PROFILES = join(ROOT, 'dev-scripts', 'fixtures', 'brand-sheet');
const STYLES = readdirSync(join(ROOT, 'letterhead', 'styles')).filter((s) => !s.startsWith('.')).sort();

let failures = 0;
function check(label, cond, detail = '') {
  if (cond) console.log(`  ok - ${label}`);
  else {
    console.log(`  FAIL - ${label}${detail ? `\n    ${String(detail).split('\n').slice(0, 12).join('\n    ')}` : ''}`);
    failures++;
  }
}

// ---------------------------------------------------------------------------
// PNG writer: a gradient, so the files are not trivially small.
// ---------------------------------------------------------------------------

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
function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'latin1'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}
function png(w, h, [r, g, b]) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8;
  ihdr[9] = 2;
  const raw = Buffer.alloc((w * 3 + 1) * h);
  for (let y = 0; y < h; y++) {
    const row = y * (w * 3 + 1);
    for (let x = 0; x < w; x++) {
      const o = row + 1 + x * 3;
      raw[o] = (r + (x * 97) / w) & 255;
      raw[o + 1] = (g + (y * 89) / h) & 255;
      raw[o + 2] = (b + ((x + y) * 31) / (w + h)) & 255;
    }
  }
  return Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
}

function node(args, opts = {}) {
  return spawnSync(process.execPath, args, { encoding: 'utf8', ...opts });
}
// product-cards talks to the server in this process, so it must not block it.
function nodeAsync(args) {
  return new Promise((resolve) => {
    const p = spawn(process.execPath, args);
    let stdout = '';
    let stderr = '';
    p.stdout.on('data', (d) => { stdout += d; });
    p.stderr.on('data', (d) => { stderr += d; });
    p.on('close', (status) => resolve({ status, stdout, stderr }));
  });
}
const out = (r) => `${r.stdout || ''}${r.stderr || ''}`;

// ---------------------------------------------------------------------------
// Pictures
// ---------------------------------------------------------------------------

const tmp = mkdtempSync(join(tmpdir(), 'presentation-smoke-'));
const src = join(tmp, 'Arkona renders');
const living = join(src, '1. SALON Z KUCHNIĄ');
const kids = join(src, '2. POKÓJ JULKA');
mkdirSync(living, { recursive: true });
mkdirSync(kids, { recursive: true });
const pictures = [
  [living, 'SALON 1.png', 2000, 1250, [200, 180, 160]],
  [living, 'SALON 2.png', 900, 600, [120, 140, 170]],
  [living, 'SALON 3.png', 600, 800, [150, 120, 100]],
  [living, 'SALON 4.png', 900, 600, [90, 110, 90]],
  [living, 'SALON 4 — WERSJA BIAŁA.png', 900, 600, [230, 230, 225]],
  [living, 'SALON 10.png', 800, 600, [60, 80, 120]],
  [kids, '1. POKÓJ JULKA 1.png', 900, 900, [210, 190, 150]],
  [kids, 'POKÓJ JULKA 2.png', 700, 900, [110, 170, 160]],
  [kids, 'POKÓJ JULKA 2 - wersja jasna.png', 700, 900, [240, 235, 220]],
  [kids, 'POKÓJ JULKA 3.png', 900, 600, [170, 110, 140]],
];
for (const [dir, name, w, h, rgb] of pictures) writeFileSync(join(dir, name), png(w, h, rgb));
writeFileSync(join(src, 'moodboard.png'), png(300, 300, [0, 0, 0]));

console.log('prepare-images');
const work = join(tmp, 'work');
const prep = node([PREPARE, src, '--out', work, '--lang', 'pl', '--budget-mb', '2']);
check('exits 0', prep.status === 0, out(prep));
const manifest = existsSync(join(work, 'manifest.json')) ? JSON.parse(readFileSync(join(work, 'manifest.json'), 'utf8')) : { rooms: [] };
const [r1, r2] = manifest.rooms;
check('two rooms in folder order', manifest.rooms.length === 2 && r1?.slug === 'salon-z-kuchnia' && r2?.slug === 'pokoj-julka', JSON.stringify(manifest.rooms.map((r) => r.slug)));
check('capitalised folder name comes back as a sentence, marked for checking', r1?.name === 'Salon z kuchnią' && r2?.name === 'Pokój julka' && r2?.nameSource === 'folder');
check('a loose picture beside the room folders is reported', /moodboard|directly in/i.test(out(prep)));
const ids1 = (r1?.images || []).map((i) => i.id);
check('ids from file numbers, 10 after 4, base before its variant', JSON.stringify(ids1) === JSON.stringify(['salon-z-kuchnia-1', 'salon-z-kuchnia-2', 'salon-z-kuchnia-3', 'salon-z-kuchnia-4a', 'salon-z-kuchnia-4b', 'salon-z-kuchnia-10']), JSON.stringify(ids1));
const v4b = r1?.images.find((i) => i.id === 'salon-z-kuchnia-4b');
check('em-dash variant: group, letter, label', v4b?.variantGroup === 'salon-z-kuchnia-4' && v4b?.variantLetter === 'B' && v4b?.variantLabel === 'Wersja biała', JSON.stringify(v4b));
const k2b = r2?.images.find((i) => i.id === 'pokoj-julka-2b');
check('"- wersja" variant and a leading "1. " in the file name', k2b?.variantLabel === 'wersja jasna' && r2?.images[0]?.caption === 'Pokój julka 1', JSON.stringify(r2?.images.map((i) => [i.id, i.caption])));
const big = r1?.images.find((i) => i.id === 'salon-z-kuchnia-1');
const small = r1?.images.find((i) => i.id === 'salon-z-kuchnia-3');
if (manifest.tool !== 'none') {
  check(`resized with ${manifest.tool}: long edge 1600, small pictures not enlarged`, big?.width === 1600 && big?.height === 1000 && small?.width === 600 && small?.height === 800, JSON.stringify([big, small]));
  check('JPEG quality chosen and reported', typeof manifest.quality === 'number' && /JPEG quality/.test(prep.stdout));
} else {
  console.log('  (no sips, ImageMagick or Pillow here: resize assertions skipped)');
}
// A flat folder whose file names name the spaces becomes one room per name;
// a flat folder of one space stays one room. A reordered manifest survives a rerun.
const flat = join(tmp, 'flat');
mkdirSync(flat, { recursive: true });
for (const [name, rgb] of [['SALA 1.png', [200, 190, 180]], ['SALA 2.png', [180, 170, 160]], ['ANEKS 1.png', [90, 80, 70]], ['ANEKS 2.png', [70, 60, 50]], ['WC 1.png', [220, 220, 220]], ['WC 2 — WERSJA JASNA.png', [240, 240, 240]], ['WC 2.png', [200, 200, 200]]]) writeFileSync(join(flat, name), png(800, 600, rgb));
const flatWork = join(tmp, 'work-flat');
const fp = node([PREPARE, flat, '--out', flatWork, '--lang', 'pl']);
let fm = JSON.parse(readFileSync(join(flatWork, 'manifest.json'), 'utf8'));
check('flat folder: one room per name in the file names, reported', fp.status === 0 && JSON.stringify(fm.rooms.map((r) => r.slug)) === JSON.stringify(['aneks', 'sala', 'wc']) && /taken from the file names/.test(out(fp)), JSON.stringify(fm.rooms.map((r) => r.slug)));
check('flat folder: variants still grouped inside a named room', fm.rooms[2]?.images.some((i) => i.variantGroup === 'wc-2'), JSON.stringify(fm.rooms[2]?.images.map((i) => i.id)));
fm.rooms = [fm.rooms[1], fm.rooms[0], fm.rooms[2]];
writeFileSync(join(flatWork, 'manifest.json'), JSON.stringify(fm));
node([PREPARE, flat, '--out', flatWork, '--lang', 'pl']);
fm = JSON.parse(readFileSync(join(flatWork, 'manifest.json'), 'utf8'));
check('a reordered manifest keeps its order on the next run', JSON.stringify(fm.rooms.map((r) => [r.n, r.slug])) === JSON.stringify([[1, 'sala'], [2, 'aneks'], [3, 'wc']]), JSON.stringify(fm.rooms.map((r) => [r.n, r.slug])));
const oneSpace = join(tmp, 'flat-one');
mkdirSync(oneSpace, { recursive: true });
for (const n of ['SYPIALNIA 1.png', 'SYPIALNIA 2.png', 'SYPIALNIA 3.png']) writeFileSync(join(oneSpace, n), png(800, 600, [150, 150, 150]));
node([PREPARE, oneSpace, '--out', join(tmp, 'work-one'), '--lang', 'pl']);
check('flat folder of one space stays one room', JSON.parse(readFileSync(join(tmp, 'work-one', 'manifest.json'), 'utf8')).rooms.length === 1);

const bare = node([PREPARE, src, '--out', join(tmp, 'work-none'), '--tool', 'none']);
const bareManifest = JSON.parse(readFileSync(join(tmp, 'work-none', 'manifest.json'), 'utf8'));
const bareBig = bareManifest.rooms[0].images[0];
check('--tool none: pictures copied at their own size, with a warning', bare.status === 0 && bareBig.width === 2000 && /\.png$/.test(bareBig.file) && /used at their own size/.test(out(bare)), out(bare));

// ---------------------------------------------------------------------------
// Shop pages
// ---------------------------------------------------------------------------

const photo = png(600, 800, [235, 230, 220]);
const share = png(1200, 630, [200, 30, 90]);
const ld = (obj) => `<script type="application/ld+json">${JSON.stringify({ '@context': 'https://schema.org', ...obj })}</script>`;
const page = (head, body = '') => `<!doctype html><html><head>${head}</head><body>${body}</body></html>`;
const routes = {
  '/p/lamp-312': () => [200, page(`<title>Lamp 312 | Vantora Home</title><meta property="og:site_name" content="Vantora Home">${ld({ '@type': 'Product', name: 'Lamp 312', brand: { '@type': 'Brand', name: 'Vantora Labs' }, image: ['/img/lamp-312.png'], offers: { '@type': 'Offer', price: '594.0', priceCurrency: 'EUR' } })}`)],
  '/p/harbour-fox': () => [200, page(`<meta property="og:image" content="/img/68/harbour_fox_masked.png?fit=crop&amp;w=1200&amp;h=630">${ld({ '@graph': [{ '@type': 'Product', name: 'Harbour Fox Wallpaper - Harbour Fox Mural', brand: 'arkona-supply-prod', image: '/img/68/harbour_fox_masked.png', offers: [{ '@type': 'Offer', price: '1 299,00', priceCurrency: 'PLN' }] }] })}`, '<img src="/img/banner-summer.png"><img src="/img/68/harbour_fox_display.png?w=400&amp;q=40" alt="">')],
  '/p/checkpoint': () => [429, page('<title>Security Checkpoint</title>')],
  '/p/moment': () => [200, page('<title>Just a moment...</title>', '<div id="cf-chl-widget"></div>')],
  '/p/logo-only': () => [200, page(`<meta property="og:image" content="/img/brand-logo.png">${ld({ '@type': 'Product', name: 'Stool Nordhavn', offers: { price: 120, priceCurrency: 'PLN' } })}`)],
};
const images = {
  '/img/lamp-312.png': photo,
  '/img/68/harbour_fox_masked.png': share,
  '/img/68/harbour_fox_display.png': png(400, 560, [60, 90, 120]),
  '/img/banner-summer.png': share,
  '/img/brand-logo.png': share,
};
const server = createServer((req, res) => {
  const path = req.url.split('?')[0];
  if (routes[path]) {
    const [status, html] = routes[path]();
    res.writeHead(status, { 'content-type': 'text/html; charset=utf-8' });
    res.end(html);
  } else if (images[path]) {
    res.writeHead(200, { 'content-type': 'image/png' });
    res.end(images[path]);
  } else {
    res.writeHead(404);
    res.end('not found');
  }
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const base = `http://127.0.0.1:${server.address().port}`;

console.log('product-cards');
writeFileSync(join(tmp, 'links.txt'), [
  '# Salon z kuchnią',
  `Lampa z lewej | ${base}/p/lamp-312?utm_source=newsletter&variant=5&fbclid=abc`,
  `Tapeta: ${base}/p/harbour-fox`,
  `Stolik | ${base}/p/checkpoint`,
  '# pokoj-julka',
  `${base}/p/moment`,
  `Taboret | ${base}/p/logo-only`,
  '',
].join('\n'));
const pc = await nodeAsync([PRODUCTS, join(tmp, 'links.txt'), '--out', work, '--lang', 'pl']);
check('exits 0 with blocked products', pc.status === 0, out(pc));
const prods = JSON.parse(readFileSync(join(work, 'products.json'), 'utf8'));
const living1 = prods['salon-z-kuchnia'] || [];
const lamp = living1[0] || {};
check('fields from JSON-LD, where from the notes', lamp.name === 'Lamp 312' && lamp.maker === 'Vantora Labs' && lamp.shop === 'Vantora Home' && lamp.price === 594 && lamp.currency === 'EUR' && lamp.where === 'Lampa z lewej', JSON.stringify(lamp));
check('tracking parameters dropped, variant kept', lamp.url === `${base}/p/lamp-312?variant=5`, lamp.url);
check('photo saved with its size', lamp.image && existsSync(join(work, lamp.image)) && lamp.width > 0 && lamp.height > 0, JSON.stringify(lamp));
const fox = living1[1] || {};
check('masked share image skipped for the product photo on the page', /harbour_fox_display/.test(fox.imageUrl || '') && (fox.imageSkipped || []).some((u) => /masked/.test(u)), JSON.stringify(fox));
check('shop handle is not a maker; "1 299,00" reads as 1299', fox.maker === null && fox.price === 1299 && fox.where === 'Tapeta', JSON.stringify(fox));
const stool = living1[2] || {};
check('429 page: blocked with a reason, nothing invented', stool.blocked === true && /429/.test(stool.reason) && stool.name === null && stool.image === null, JSON.stringify(stool));
const kids1 = prods['pokoj-julka'] || [];
check('200 "just a moment" page: blocked too', kids1[0]?.blocked === true, JSON.stringify(kids1[0]));
check('logo as the only picture: no photo, and the card says why', kids1[1]?.name === 'Stool Nordhavn' && !kids1[1]?.image && /share graphic|watermark/.test(kids1[1]?.imageNote || ''), JSON.stringify(kids1[1]));
check('blocked products listed for the user', /needs the user/.test(pc.stdout) && /checkpoint/.test(pc.stdout));

console.log('build-presentation');
const profilePl = join(PROFILES, 'pl');
const profileEn = join(PROFILES, 'en');
const first = node([BUILD, work, '--title', 'Dom nad jeziorem', '--profile', profilePl, '--date', '2026-09-28', '--out', join(tmp, 'before.html')]);
check('builds before names are checked, and warns about them', first.status === 0 && /not checked yet/.test(out(first)) && /Salon z kuchnią/.test(out(first)), out(first));
const before = readFileSync(join(tmp, 'before.html'), 'utf8');
check('blocked and nameless products left out of the document', !/produkt-stolik|checkpoint/.test(before.replace(/href="[^"]*"/g, '')) && /id="salon-z-kuchnia-produkt-lamp-312"/.test(before), before.match(/id="[^"]*produkt[^"]*"/g));

// The agent's pass: proper nouns, the user's details for a blocked shop,
// the shop's SEO name shortened, the designer's words.
manifest.rooms[1].name = 'Pokój Julka';
for (const r of manifest.rooms) r.nameSource = 'checked';
writeFileSync(join(work, 'manifest.json'), JSON.stringify(manifest, null, 2));
writeFileSync(join(tmp, 'stool.png'), photo);
writeFileSync(join(tmp, 'links.json'), JSON.stringify({
  'salon-z-kuchnia': [
    { where: 'Lampa z lewej', url: `${base}/p/lamp-312?variant=5` },
    { where: 'Tapeta', url: `${base}/p/harbour-fox` },
    { where: 'Stolik', url: `${base}/p/checkpoint`, slug: 'stolik-orla', name: 'Stolik Orla', maker: 'Arkona Supply', shop: 'Arkona Supply', price: 549.99, currency: 'PLN', image: 'stool.png' },
  ],
}));
const pc2 = await nodeAsync([PRODUCTS, join(tmp, 'links.json'), '--out', work, '--lang', 'pl']);
const prods2 = JSON.parse(readFileSync(join(work, 'products.json'), 'utf8'));
const living2 = prods2['salon-z-kuchnia'] || [];
check('second run keeps fetched products and fills the blocked one from links.json', pc2.status === 0 && /kept\s+salon-z-kuchnia \/ lamp-312/.test(pc2.stdout) && living2[2]?.slug === 'stolik-orla' && !living2[2]?.blocked && living2[2]?.image, out(pc2));
living2[1].name = 'Harbour Fox';
writeFileSync(join(work, 'products.json'), JSON.stringify(prods2, null, 2));
writeFileSync(join(work, 'texts.json'), JSON.stringify({ project: 'Dom nad jeziorem to dwa wnętrza na parterze.', rooms: { 'salon-z-kuchnia': 'Jasne drewno i len.\n\nKuchnia otwarta na salon.' } }));

server.close();

let built = 0;
let clean = 0;
const dirty = [];
for (const style of STYLES) {
  for (const [profile, lang] of [[profilePl, 'pl'], [profileEn, 'en']]) {
    for (const only of [null, 'salon-z-kuchnia']) {
      const file = join(tmp, `doc-${style}-${lang}${only ? '-single' : ''}.html`);
      const args = [BUILD, work, '--title', lang === 'pl' ? 'Dom nad jeziorem' : 'Lake house', '--profile', profile, '--style', style, '--lang', lang, '--date', '2026-09-28', '--out', file];
      if (only) args.push('--only', only);
      const r = node(args);
      built++;
      if (r.status === 0 && /0 error/.test(r.stdout)) clean++;
      else dirty.push(`${style} ${lang}${only ? ' --only' : ''}: ${out(r).split('\n').filter((l) => / error | FAIL|failed/.test(l)).slice(0, 3).join(' | ')}`);
    }
  }
}
check(`full and single documents in all ${STYLES.length} styles, pl and en: check-document clean (${clean}/${built})`, clean === built, dirty.join('\n'));

const multi = readFileSync(join(tmp, 'doc-atelier-pl.html'), 'utf8');
const single = readFileSync(join(tmp, 'doc-atelier-pl-single.html'), 'utf8');
const en = readFileSync(join(tmp, 'doc-atelier-en.html'), 'utf8');
const count = (s, re) => (s.match(re) || []).length;
check('every picture is a figure with its manifest id', ids1.every((id) => multi.includes(`<figure class="shot`) && new RegExp(`<figure class="shot[^"]*" id="${id}"`).test(multi)) && /id="pokoj-julka-2b"/.test(multi));
check('room sections and h2 ids from the room slug', /<section class="room" id="salon-z-kuchnia-sekcja"/.test(multi) && /<h2 id="pokoj-julka">Pokój Julka<\/h2>/.test(multi));
check('variant panel with its own id and both options', /class="choice" id="salon-z-kuchnia-4-warianty"/.test(multi) && /Wariant A/.test(multi) && /Wariant B · wersja biała/.test(multi) && /Ujęcie 4 w dwóch wariantach/.test(multi));
check('products: ids, price, maker · shop, dated note, shop link', /id="salon-z-kuchnia-produkt-lamp-312"/.test(multi) && /id="salon-z-kuchnia-produkt-stolik-orla"/.test(multi) && /594\s€/.test(multi) && /1299\szł/.test(multi) && /Vantora Labs · Vantora Home/.test(multi) && /ceny ze stron sklepów z \d{1,2} \p{L}+ \d{4}/u.test(multi) && !/<p class="product-maker">\d/.test(multi) && /Zobacz w sklepie/.test(multi), multi.match(/<p class="product-(?:price|maker)">[^<]*/g));
const viewer = (/<dialog class="lb"[\s\S]*?<\/dialog>/.exec(multi) || [''])[0];
check('the viewer holds no link', viewer && !/<a\b/i.test(viewer));
check('designer text in paragraphs; one tokens block; a favicon', /<div class="room-text"><p>Jasne drewno i len.<\/p><p>Kuchnia otwarta na salon.<\/p><\/div>/.test(multi) && count(multi, /data-letterhead-tokens/g) === 1 && /<link rel="icon"/.test(multi));
check('logo ratio read from the artwork when the tokens do not carry it', /class="brand-mark" role="img" aria-label="Nimbus Freight" style="--brand-logo-ratio:3\.0000"/.test(multi), (multi.match(/<div class="brand-mark[^>]*>/) || [])[0]);
check('Polish words and plural forms', /Spis wnętrz/.test(multi) && /6 wizualizacji/.test(multi) && /4 wizualizacje/.test(multi) && /Przy 2 ujęciach pokazujemy dwa warianty do wyboru/.test(multi) && /3 produkty/.test(multi));
check('single room: title is the room, project above it, no contents or numbers', /<p class="cover-kicker">Dom nad jeziorem<\/p>\s*<h1>Salon z kuchnią<\/h1>/.test(single) && !/class="toc"/.test(single) && !/class="room-no"/.test(single) && /<title>Salon z kuchnią · Dom nad jeziorem<\/title>/.test(single));
check('single room keeps the full document\'s figure and product ids', /id="salon-z-kuchnia-4b"/.test(single) && /<h2 id="produkty">Produkty w tym wnętrzu<\/h2>/.test(single) && /id="salon-z-kuchnia-produkt-lamp-312"/.test(single) && !/id="pokoj-julka/.test(single));
check('English words', /<html lang="en"/.test(en) && /Contents/.test(en) && /6 renders/.test(en) && /Your choice/.test(en) && /View in shop/.test(en) && /Option B · wersja biała/.test(en) && /id="salon-z-kuchnia-product-lamp-312"/.test(en) && /September 28, 2026/.test(en));
check('no picture or stylesheet loads from the network', !/(?:src|href)="https?:\/\/(?!127\.0\.0\.1)/.test(multi.replace(/<a class="product-link" href="[^"]*"/g, '')) && !/<img[^>]+src="http/.test(multi));

const general = join(tmp, 'general.html');
const g = node([BUILD, work, '--title', 'Sala Arkona', '--style', 'atelier', '--lang', 'pl', '--kind', 'general', '--date', '2026-09-28', '--out', general]);
const gHtml = existsSync(general) ? readFileSync(general, 'utf8') : '';
check('--kind general and a style without a profile', g.status === 0 && /Spis treści/.test(gHtml) && /6 zdjęć/.test(gHtml) && /Części/.test(gHtml) && !/wizualizacj/i.test(gHtml), out(g));
const noTitle = node([BUILD, work, '--profile', profilePl, '--out', join(tmp, 'x.html')]);
check('--title is required', noTitle.status === 1 && /--title is required/.test(noTitle.stderr));
const badOnly = node([BUILD, work, '--title', 'X', '--only', 'nope', '--out', join(tmp, 'x.html')]);
check('--only with an unknown room names the rooms', badOnly.status === 1 && /salon-z-kuchnia, pokoj-julka/.test(badOnly.stderr));

if (failures) {
  console.log(`presentation-smoke: ${failures} failure(s) (outputs in ${tmp})`);
  process.exit(1);
}
console.log('presentation-smoke: all assertions passed');
