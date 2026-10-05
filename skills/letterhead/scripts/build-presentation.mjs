#!/usr/bin/env node
// Builds a presentation document (templates/presentation): a project shown
// picture by picture, room by room, with optional product cards, as one
// self-contained HTML file on the brand's tokens.
//
// Usage:
//   node build-presentation.mjs <workdir> --title "<project title>"
//        [--profile <brand-dir>] [--style <slug | tokens.css>] [--lang pl|en]
//        [--only <room-slug>] [--kind interior|general] [--brand-name "<name>"]
//        [--extra-css <file.css>] [--date YYYY-MM-DD] [--no-prices]
//        --out <file.html>
//
// Reads from <workdir>:
//   manifest.json   from prepare-images.mjs (room names checked by the agent)
//   products.json   from product-cards.mjs, optional
//   texts.json      optional: { "project": "...", "rooms": { "<slug>": "..." } },
//                   the designer's words (or a draft the user accepted).
//                   This script never writes prose of its own.
//
// Brand: the style's tokens (default: the profile's own style, else
// atelier) with the profile's tokens.css over them, put into the document by
// apply-tokens.mjs. Without --profile the style alone carries the look.
//
// --only <room-slug> builds one room as its own document: the room is the
// title, the project title sits above it, no contents list, no room numbers.
// Figure and product ids are the same as in the full document, so comments
// read the same in both.
//
// --no-prices leaves every price out of the document, with the note on when
// prices were read: they are not in the page source either, only name,
// maker, shop and link stay. For a client who should not see prices.
//
// --kind general swaps the words for a project that is not an interior
// (a venue, a wedding, a portfolio): "sections" and "photos" instead of
// "rooms" and "renders".
//
// Last, runs check-document.mjs on the result and prints the size. A file
// over 4 MB is published through the upload URL (reference/publish.md).
//
// Exit codes:
//   0 — written and check-document found no errors
//   1 — usage error or unreadable input
//   2 — written, but check-document found errors

import { readFileSync, writeFileSync, existsSync, statSync, rmSync } from 'node:fs';
import { join, resolve, dirname, basename } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { parse as parseColor, formatHex } from './vendor/culori.mjs';
import { imageSize, slugify, bytesText, MIME } from './lib/images.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SKILL = resolve(__dirname, '..');
const USAGE = 'usage: node build-presentation.mjs <workdir> --title "<project title>" [--profile <brand-dir>] [--style <slug | tokens.css>] [--lang pl|en] [--only <room-slug>] [--kind interior|general] [--brand-name "<name>"] [--extra-css <file.css>] [--date YYYY-MM-DD] [--no-prices] --out <file.html>';

function fail(msg) {
  console.error(`build-presentation: ${msg}`);
  process.exit(1);
}

function parseArgs(argv) {
  const o = { work: null, title: null, profile: null, style: null, lang: null, only: null, kind: 'interior', brandName: null, extraCss: null, date: null, out: null, checkScript: null, prices: true };
  const takes = { '--title': 'title', '--profile': 'profile', '--style': 'style', '--lang': 'lang', '--only': 'only', '--kind': 'kind', '--brand-name': 'brandName', '--extra-css': 'extraCss', '--date': 'date', '--out': 'out', '--check-script': 'checkScript' };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '-h' || a === '--help') { console.log(USAGE); process.exit(0); }
    if (a === '--no-prices') { o.prices = false; continue; }
    if (takes[a]) {
      if (argv[i + 1] === undefined) fail(`${a} needs a value`);
      o[takes[a]] = argv[++i];
    } else if (a.startsWith('--')) fail(`unknown option ${a}\n${USAGE}`);
    else if (!o.work) o.work = a;
    else fail(USAGE);
  }
  if (!o.work || !o.out) fail(USAGE);
  if (!o.title || !o.title.trim()) fail('--title is required: the project title comes from the user, not from the folder name');
  if (o.lang && !['pl', 'en'].includes(o.lang)) fail('--lang must be pl or en');
  if (!['interior', 'general'].includes(o.kind)) fail('--kind must be interior or general');
  if (o.date && !/^\d{4}-\d{2}-\d{2}$/.test(o.date)) fail('--date must be YYYY-MM-DD');
  return o;
}

function readJson(path, label, required) {
  if (!existsSync(path)) {
    if (required) fail(`missing ${label} (${path})`);
    return null;
  }
  try {
    return JSON.parse(readFileSync(path, 'utf8'));
  } catch (e) {
    fail(`${label} is not valid JSON (${path}): ${e.message}`);
  }
}

// ---------------------------------------------------------------------------
// Words. Polish counts take three forms: 1 wizualizacja, 2–4 wizualizacje,
// 5+ wizualizacji (12–14 too).
// ---------------------------------------------------------------------------

function plPlural(n, one, few, many) {
  if (n === 1) return one;
  const d = n % 10;
  const t = n % 100;
  return d >= 2 && d <= 4 && (t < 12 || t > 14) ? few : many;
}
const PL_LOCATIVE_NUM = { 2: 'dwóch', 3: 'trzech', 4: 'czterech', 5: 'pięciu', 6: 'sześciu' };
const EN_NUM = { 2: 'two', 3: 'three', 4: 'four', 5: 'five', 6: 'six' };
const PL_MONTHS = ['stycznia', 'lutego', 'marca', 'kwietnia', 'maja', 'czerwca', 'lipca', 'sierpnia', 'września', 'października', 'listopada', 'grudnia'];
const EN_MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

const NOUNS = {
  pl: {
    interior: {
      space: ['wnętrze', 'wnętrza', 'wnętrz'], spacesLabel: 'Wnętrza', toc: 'Spis wnętrz', productsHeading: 'Produkty w tym wnętrzu',
      image: ['wizualizacja', 'wizualizacje', 'wizualizacji'], imagesLabel: 'Wizualizacje', imageAlt: 'Wizualizacja', viewer: 'Podgląd wizualizacji',
    },
    general: {
      space: ['część', 'części', 'części'], spacesLabel: 'Części', toc: 'Spis treści', productsHeading: 'Produkty w tej części',
      image: ['zdjęcie', 'zdjęcia', 'zdjęć'], imagesLabel: 'Zdjęcia', imageAlt: 'Zdjęcie', viewer: 'Podgląd zdjęć',
    },
  },
  en: {
    interior: {
      space: ['room', 'rooms', 'rooms'], spacesLabel: 'Rooms', toc: 'Contents', productsHeading: 'Products in this room',
      image: ['render', 'renders', 'renders'], imagesLabel: 'Renders', imageAlt: 'Render', viewer: 'Render viewer',
    },
    general: {
      space: ['section', 'sections', 'sections'], spacesLabel: 'Sections', toc: 'Contents', productsHeading: 'Products in this section',
      image: ['photo', 'photos', 'photos'], imagesLabel: 'Photos', imageAlt: 'Photo', viewer: 'Photo viewer',
    },
  },
};

function strings(lang, kind) {
  const n = NOUNS[lang][kind];
  if (lang === 'pl') {
    const count = (k, forms) => `${k} ${plPlural(k, ...forms)}`;
    const inOptions = (size) => (size && PL_LOCATIVE_NUM[size] ? `w ${PL_LOCATIVE_NUM[size]} wariantach` : 'z wariantami');
    return {
      ...n,
      date: (d) => `${d.getDate()} ${PL_MONTHS[d.getMonth()]} ${d.getFullYear()}`,
      locale: 'pl-PL',
      images: (k) => count(k, n.image),
      spaces: (k) => count(k, n.space),
      products: (k) => count(k, ['produkt', 'produkty', 'produktów']),
      productsLabel: 'Produkty',
      dateLabel: 'Data',
      clickHint: 'Kliknij zdjęcie, żeby je powiększyć.',
      variantsHint: (views, size) => `Przy ${views} ${views === 1 ? 'ujęciu' : 'ujęciach'} pokazujemy ${size === 2 ? 'dwa warianty' : 'warianty'} do wyboru.`,
      variantFacts: (views, size) => `${count(views, ['ujęcie', 'ujęcia', 'ujęć'])} ${inOptions(size)}`,
      choiceKicker: 'Do wyboru',
      choiceLabel: (view, size) => (view ? `Ujęcie ${view} ${inOptions(size)}` : `Ujęcie ${inOptions(size)}`),
      variantTag: (letter) => `Wariant ${letter}`,
      enlarge: (caption) => `Powiększ: ${caption}`,
      pricesFrom: (d) => `ceny ze stron sklepów z ${d}`,
      shopLink: 'Zobacz w sklepie',
      close: 'Zamknij podgląd',
      prev: 'Wstecz',
      next: 'Dalej',
      ogMulti: (spaces, images, views) => `${count(spaces, n.space)}, ${count(images, n.image)}${views ? `, w tym ${count(views, ['ujęcie', 'ujęcia', 'ujęć'])} z wariantami do wyboru` : ''}.`,
      ogSingle: (images, prods) => `${count(images, n.image)}${prods ? `, ${count(prods, ['produkt', 'produkty', 'produktów'])} ze sklepów` : ''}.`,
      ids: { section: 'sekcja', products: 'produkty', product: 'produkt', options: 'warianty', optionsLabel: 'etykieta' },
    };
  }
  const plural = (k, forms) => `${k} ${k === 1 ? forms[0] : forms[1]}`;
  const inOptions = (size) => (size && EN_NUM[size] ? `in ${EN_NUM[size]} options` : 'with options');
  return {
    ...n,
    date: (d) => `${EN_MONTHS[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`,
    locale: 'en-US',
    images: (k) => plural(k, n.image),
    spaces: (k) => plural(k, n.space),
    products: (k) => plural(k, ['product', 'products']),
    productsLabel: 'Products',
    dateLabel: 'Date',
    clickHint: 'Click a picture to see it full screen.',
    variantsHint: (views, size) => `${views} ${views === 1 ? 'view comes' : 'views come'} in ${size === 2 ? 'two options' : 'options'} to choose from.`,
    variantFacts: (views, size) => `${plural(views, ['view', 'views'])} ${inOptions(size)}`,
    choiceKicker: 'Your choice',
    choiceLabel: (view, size) => (view ? `View ${view} ${inOptions(size)}` : `This view ${inOptions(size)}`),
    variantTag: (letter) => `Option ${letter}`,
    enlarge: (caption) => `Enlarge: ${caption}`,
    pricesFrom: (d) => `prices from the shops' pages on ${d}`,
    shopLink: 'View in shop',
    close: 'Close viewer',
    prev: 'Previous',
    next: 'Next',
    ogMulti: (spaces, images, views) => `${plural(spaces, n.space)}, ${plural(images, n.image)}${views ? `, ${plural(views, ['view', 'views'])} with options to choose from` : ''}.`,
    ogSingle: (images, prods) => `${plural(images, n.image)}${prods ? `, ${plural(prods, ['product', 'products'])} from the shops` : ''}.`,
    ids: { section: 'section', products: 'products', product: 'product', options: 'options', optionsLabel: 'label' },
  };
}

const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const pad = (n) => String(n).padStart(2, '0');
const ratio = (i) => i.width / i.height;
const paragraphs = (text) => (Array.isArray(text) ? text : String(text || '').split(/\n\s*\n/)).map((p) => p.trim()).filter(Boolean);

// ---------------------------------------------------------------------------
// Tokens and logo
// ---------------------------------------------------------------------------

function resolveStyle(style, meta) {
  const pick = style || (meta && meta.style) || 'atelier';
  if (/\.css$/i.test(pick) || pick.includes('/')) {
    const p = resolve(pick);
    if (!existsSync(p)) fail(`style tokens not found: ${p}`);
    return { name: basename(dirname(p)), path: p };
  }
  const p = join(SKILL, 'styles', pick, 'tokens.css');
  if (!existsSync(p)) fail(`unknown style "${pick}" (no ${p})`);
  return { name: pick, path: p };
}

// The first declaration of a custom property. A data: URI carries ";" of
// its own ("image/png;base64"), so the value ends at the first ";" outside
// quotes and parentheses.
function firstVar(css, name) {
  const m = new RegExp(`(?:^|[;{\\s])--${name}\\s*:`).exec(css);
  if (!m) return null;
  let depth = 0;
  let quote = null;
  for (let i = m.index + m[0].length; i < css.length; i++) {
    const c = css[i];
    if (quote) { if (c === quote) quote = null; continue; }
    if (c === '"' || c === "'") quote = c;
    else if (c === '(') depth++;
    else if (c === ')') depth--;
    else if ((c === ';' || c === '}') && depth <= 0) return css.slice(m.index + m[0].length, i).trim();
  }
  return null;
}

// Width over height of the logo artwork, when the tokens do not say.
function logoRatio(value) {
  // The data may hold the other quote character (an SVG's attributes), so
  // read up to the quote that opened it.
  const m = /url\(\s*"(data:([^;,"]+)(;base64)?,([^"]*))"\s*\)/.exec(value || '')
    || /url\(\s*'(data:([^;,']+)(;base64)?,([^']*))'\s*\)/.exec(value || '')
    || /url\(\s*(data:([^;,)]+)(;base64)?,([^)\s]*))\s*\)/.exec(value || '');
  if (!m) return null;
  try {
    if (/svg/.test(m[2])) {
      const svg = m[3] ? Buffer.from(m[4], 'base64').toString('utf8') : decodeURIComponent(m[4]);
      const vb = /viewBox\s*=\s*["']\s*[-\d.]+[\s,]+[-\d.]+[\s,]+([\d.]+)[\s,]+([\d.]+)/i.exec(svg);
      if (vb) return Number(vb[1]) / Number(vb[2]);
      const w = /\bwidth\s*=\s*["']([\d.]+)/i.exec(svg);
      const h = /\bheight\s*=\s*["']([\d.]+)/i.exec(svg);
      return w && h ? Number(w[1]) / Number(h[1]) : null;
    }
    const size = imageSize(Buffer.from(m[4], 'base64'));
    return size && size.height ? size.width / size.height : null;
  } catch {
    return null;
  }
}

function brandMark(tokens, brandName) {
  const label = esc(brandName || 'Logo');
  const hasMask = /--brand-logo-mask\s*:/.test(tokens);
  const logo = firstVar(tokens, 'brand-logo-mask') || firstVar(tokens, 'brand-logo');
  if (!logo) return brandName ? `<p class="brand-name">${esc(brandName)}</p>` : '';
  const known = /--brand-logo-ratio\s*:/.test(tokens);
  const r = known ? null : logoRatio(logo);
  const style = r ? ` style="--brand-logo-ratio:${r.toFixed(4)}"` : '';
  return `<div class="brand-mark${hasMask ? ' is-mask' : ''}" role="img" aria-label="${label}"${style}></div>`;
}

// ---------------------------------------------------------------------------
// Layout
// ---------------------------------------------------------------------------

// Justified rows: split a run of pictures into rows whose common height is
// closest to TARGET at the reference width. Dynamic programming over break
// points, so the last row never ends up as a lone giant. The heights only
// drive the choice; in CSS each row is flex with flex-grow = aspect ratio,
// so every row is flush at any width.
const REF_W = 1144;
const GAP = 14;
const TARGET = 360;
const MAX_H = 600;
const MAX_PER_ROW = 4;
function partition(items) {
  const n = items.length;
  const best = Array(n + 1).fill(Infinity);
  const prev = Array(n + 1).fill(0);
  best[0] = 0;
  for (let j = 1; j <= n; j++) {
    for (let k = 1; k <= Math.min(MAX_PER_ROW, j); k++) {
      const row = items.slice(j - k, j);
      const h = (REF_W - GAP * (k - 1)) / row.reduce((a, i) => a + ratio(i), 0);
      const cost = ((h - TARGET) / TARGET) ** 2 + (h > MAX_H ? 10 : 0);
      if (best[j - k] + cost < best[j]) {
        best[j] = best[j - k] + cost;
        prev[j] = j - k;
      }
    }
  }
  const rows = [];
  for (let j = n; j > 0; j = prev[j]) rows.unshift(items.slice(prev[j], j));
  return rows;
}

function build(ctx) {
  const { t, rooms, work, products, texts, single, title, date, prices } = ctx;
  const dateText = t.date(date);
  const dateIso = `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
  const roomText = (r) => paragraphs((texts.rooms || {})[r.slug]);
  const b64 = new Map();
  const dataUri = (file) => {
    if (!b64.has(file)) {
      const buf = readFileSync(join(work, file));
      const type = imageSize(buf)?.type;
      b64.set(file, `data:${MIME[type] || 'image/jpeg'};base64,${buf.toString('base64')}`);
    }
    return b64.get(file);
  };
  let eager = 1; // only the first hero is on the first screen

  function figure(i, cls = '') {
    const tag = i.variantLetter
      ? `<span class="tag">${esc(t.variantTag(i.variantLetter))}${i.variantLabel ? ` · ${esc(i.variantLabel.toLocaleLowerCase(ctx.lang))}` : ''}</span>`
      : '';
    const lazy = eager-- > 0 ? '' : ' loading="lazy"';
    return `<figure class="shot${cls ? ` ${cls}` : ''}" id="${esc(i.id)}" style="--r:${ratio(i).toFixed(4)}">
<button type="button" class="zoom" aria-haspopup="dialog" aria-label="${esc(t.enlarge(i.caption))}"><img src="${dataUri(i.file)}" width="${i.width}" height="${i.height}" alt="${esc(`${t.imageAlt}: ${i.caption}`)}"${lazy} decoding="async"></button>
<figcaption>${tag}<span class="cap">${esc(i.caption)}</span></figcaption>
</figure>`;
  }

  const money = (v, cur) => {
    if (v === null || v === undefined) return null;
    const digits = Number.isInteger(v) ? 0 : 2;
    try {
      return new Intl.NumberFormat(t.locale, { style: 'currency', currency: cur, minimumFractionDigits: digits, maximumFractionDigits: digits }).format(v);
    } catch {
      return `${v}${cur ? ` ${cur}` : ''}`;
    }
  };

  function productBlock(r, level) {
    const list = (products[r.slug] || []).filter((p) => p.name && !p.blocked && !p.error);
    if (!list.length) return '';
    const id = level === 2 ? t.ids.products : `${r.slug}-${t.ids.products}`;
    const dates = list.map((p) => p.fetchedAt).filter(Boolean).sort();
    const note = [t.products(list.length), prices && dates.length && list.some((p) => p.price) ? t.pricesFrom(t.date(new Date(dates[0]))) : null].filter(Boolean).join(' · ');
    const items = list.map((p) => {
      const maker = p.maker && p.shop && p.maker !== p.shop ? `${p.maker} · ${p.shop}` : p.shop || p.maker || '';
      const price = prices ? money(p.price, p.currency) : '';
      const img = p.image && existsSync(join(work, p.image))
        ? `<img src="${dataUri(p.image)}" width="${p.width}" height="${p.height}" alt="${esc(p.name)}" loading="lazy" decoding="async">`
        : '';
      return `<li class="product" id="${esc(`${r.slug}-${t.ids.product}-${p.slug}`)}">
<div class="product-img">${img}</div>
<div class="product-body">
${p.where ? `<p class="product-where">${esc(p.where)}</p>\n` : ''}<p class="product-name">${esc(p.name)}</p>
${maker ? `<p class="product-maker">${esc(maker)}</p>\n` : ''}${price ? `<p class="product-price">${esc(price)}</p>\n` : ''}${p.url ? `<a class="product-link" href="${esc(p.url)}" target="_blank" rel="noopener">${esc(t.shopLink)}<span aria-hidden="true"> ↗</span></a>\n` : ''}</div>
</li>`;
    });
    return `<div class="products" role="group" aria-labelledby="${id}">
<div class="products-head">
<h${level} id="${id}">${esc(t.productsHeading)}</h${level}>
<p class="products-note">${esc(note)}</p>
</div>
<ul class="product-list">
${items.join('\n')}
</ul>
</div>`;
  }

  // Split a room's pictures: the hero (first picture outside any variant
  // group), the rest in rows, the variant groups in their own panels.
  function pieces(r) {
    const plain = r.images.filter((i) => !i.variantGroup);
    const hero = plain[0] || null;
    const singles = plain.slice(1);
    const groups = [...new Set(r.images.filter((i) => i.variantGroup).map((i) => i.variantGroup))]
      .map((g) => r.images.filter((i) => i.variantGroup === g))
      .filter((g) => g.length > 1);
    // A lone leftover of a broken group still shows, as a plain picture.
    const grouped = new Set(groups.flat());
    for (const i of r.images) if (i.variantGroup && !grouped.has(i) && i !== hero) singles.push(i);
    return { hero, singles, groups };
  }

  function choices(groups) {
    return groups.map((g) => {
      const gid = g[0].variantGroup;
      const view = (/-(\d+)$/.exec(gid) || [])[1] || null;
      return `<div class="choice" id="${esc(`${gid}-${t.ids.options}`)}" role="group" aria-labelledby="${esc(`${gid}-${t.ids.optionsLabel}`)}">
<p class="choice-label" id="${esc(`${gid}-${t.ids.optionsLabel}`)}"><span class="choice-kicker">${esc(t.choiceKicker)}</span> ${esc(t.choiceLabel(view, g.length))}</p>
<div class="row pair">
${g.map((i) => figure(i)).join('\n')}
</div>
</div>`;
    }).join('\n');
  }

  const rowsHtml = (items) => partition(items).map((row) => `<div class="row">\n${row.map((i) => figure(i)).join('\n')}\n</div>`).join('\n');
  const groupSize = (groups) => (groups.length && groups.every((g) => g.length === groups[0].length) ? groups[0].length : null);

  function roomSection(r) {
    const { hero, singles, groups } = pieces(r);
    // Opener: a landscape hero sits beside the heading. A square or portrait
    // hero beside a short heading leaves a tall empty column, so those rooms
    // put the heading on top and open with a lead row: the hero plus the
    // next picture at a large common height.
    const split = hero && ratio(hero) >= 1.2;
    const lead = !split && hero ? [hero, ...(singles.length ? [singles.shift()] : [])] : null;
    const facts = [t.images(r.images.length)];
    if (groups.length) facts.push(t.variantFacts(groups.length, groupSize(groups)));
    const text = roomText(r);
    const head = `<div class="room-head">
<p class="room-no" aria-hidden="true">${pad(r.n)}</p>
<h2 id="${esc(r.slug)}">${esc(r.name)}</h2>
<p class="room-facts">${esc(facts.join(' · '))}</p>
${text.length ? `<div class="room-text">${text.map((p) => `<p>${esc(p)}</p>`).join('')}</div>` : ''}
</div>`;
    const opener = split
      ? `<div class="room-open">\n${head}\n${figure(hero, 'hero')}\n</div>`
      : `<div class="room-open stacked">\n${head}\n</div>${lead ? `\n<div class="row lead">\n${lead.map((i) => figure(i)).join('\n')}\n</div>` : ''}`;
    return `<section class="room" id="${esc(`${r.slug}-${t.ids.section}`)}" data-name="${esc(r.name)}" aria-labelledby="${esc(r.slug)}">
${opener}
${rowsHtml(singles)}
${choices(groups)}
${productBlock(r, 3)}
</section>`;
  }

  // One room: the room is the document. No contents, no number, no room
  // heading repeating the title; the hero runs full width under the cover.
  function singleRoom(r) {
    const { hero, singles, groups } = pieces(r);
    const landscape = hero && ratio(hero) >= 1.2;
    const lead = !landscape && hero ? [hero, ...(singles.length ? [singles.shift()] : [])] : null;
    const opener = landscape
      ? `<div class="single-hero">${figure(hero, 'hero-full')}</div>`
      : lead ? `<div class="row lead">\n${lead.map((i) => figure(i)).join('\n')}\n</div>` : '';
    const imagesId = slugify(t.imagesLabel);
    const prods = productBlock(r, 2);
    return `<section class="room single" id="${esc(`${r.slug}-${t.ids.section}`)}" data-name="${esc(r.name)}" aria-labelledby="${imagesId}">
<h2 id="${imagesId}" class="visually-hidden">${esc(t.imagesLabel)}</h2>
${opener}
${rowsHtml(singles)}
${choices(groups)}
</section>
${prods ? `<section class="single-products" aria-labelledby="${t.ids.products}">\n${prods}\n</section>` : ''}`;
  }

  const total = rooms.reduce((a, r) => a + r.images.length, 0);
  const allGroups = rooms.flatMap((r) => pieces(r).groups);
  const views = allGroups.length;
  const hint = `${t.clickHint}${views ? ` ${t.variantsHint(views, groupSize(allGroups))}` : ''}`;

  function multiCover() {
    const lede = paragraphs(texts.project);
    // A long title does not fit the left column beside the contents list
    // (a 37-character project name overran it): give it the full
    // width and let the contents follow below.
    const longTitle = title.length > 22 ? ' long-title' : '';
    return `<header class="cover${longTitle}">
<div class="cover-main">
${ctx.mark}
<h1>${esc(title)}</h1>
<dl class="meta">
<div><dt>${esc(t.spacesLabel)}</dt><dd>${rooms.length}</dd></div>
<div><dt>${esc(t.imagesLabel)}</dt><dd>${total}</dd></div>
<div><dt>${esc(t.dateLabel)}</dt><dd><time datetime="${dateIso}">${esc(dateText)}</time></dd></div>
</dl>
${lede.length ? `<div class="lede">${lede.map((p) => `<p>${esc(p)}</p>`).join('')}</div>` : ''}
<p class="intro">${esc(hint)}</p>
</div>
<nav class="toc" aria-labelledby="${slugify(t.toc)}">
<h2 id="${slugify(t.toc)}">${esc(t.toc)}</h2>
<ol>
${rooms.map((r) => `<li><a href="#${esc(r.slug)}"><span class="toc-no" aria-hidden="true">${pad(r.n)}</span><span class="toc-name">${esc(r.name)}</span><span class="toc-count" aria-label="${esc(t.images(r.images.length))}">${r.images.length}</span></a></li>`).join('\n')}
</ol>
</nav>
</header>`;
  }

  function singleCover() {
    const r = rooms[0];
    const prods = (products[r.slug] || []).filter((p) => p.name && !p.blocked && !p.error).length;
    const text = roomText(r);
    return `<header class="cover single">
<div class="cover-main">
${ctx.mark}
<p class="cover-kicker">${esc(title)}</p>
<h1>${esc(r.name)}</h1>
<dl class="meta">
<div><dt>${esc(t.imagesLabel)}</dt><dd>${r.images.length}</dd></div>
${prods ? `<div><dt>${esc(t.productsLabel)}</dt><dd>${prods}</dd></div>\n` : ''}<div><dt>${esc(t.dateLabel)}</dt><dd><time datetime="${dateIso}">${esc(dateText)}</time></dd></div>
</dl>
${text.length ? `<div class="lede">${text.map((p) => `<p>${esc(p)}</p>`).join('')}</div>` : ''}
<p class="intro">${esc(hint)}</p>
</div>
</header>`;
  }

  const docTitle = single ? `${rooms[0].name} · ${title}` : title;
  const og = single
    ? t.ogSingle(rooms[0].images.length, (products[rooms[0].slug] || []).filter((p) => p.name && !p.blocked && !p.error).length)
    : t.ogMulti(rooms.length, total, views);
  const arrow = (d) => `<svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true"><path d="${d}" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>`;

  return `<!doctype html>
<html lang="${ctx.lang}" class="no-js">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(docTitle)}</title>
<meta property="og:title" content="${esc(docTitle)}">
<meta property="og:description" content="${esc(og)}">
<meta property="og:type" content="article">
${ctx.favicon}
<style>
${ctx.css}
</style>${ctx.extraCss ? `\n<style>\n${ctx.extraCss}\n</style>` : ''}
</head>
<body>
${single ? singleCover() : multiCover()}
<main>
${single ? singleRoom(rooms[0]) : rooms.map(roomSection).join('\n')}
</main>
<dialog class="lb" aria-label="${esc(t.viewer)}">
<div class="lb-bar">
<p class="lb-where"><span class="lb-room"></span> <span class="lb-count" aria-live="polite"></span></p>
<button type="button" class="lb-btn lb-close" aria-label="${esc(t.close)}" autofocus><svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg></button>
</div>
<div class="lb-stage">
<div class="lb-track"></div>
<button type="button" class="lb-btn lb-prev" aria-label="${esc(t.prev)}">${arrow('M15 5l-7 7 7 7')}</button>
<button type="button" class="lb-btn lb-next" aria-label="${esc(t.next)}">${arrow('M9 5l7 7-7 7')}</button>
</div>
<p class="lb-cap" aria-live="polite"></p>
</dialog>
<script>
${ctx.js}
</script>
</body>
</html>
`;
}

// ---------------------------------------------------------------------------

function main() {
  const o = parseArgs(process.argv.slice(2));
  const work = resolve(o.work);
  const warnings = [];
  const manifest = readJson(join(work, 'manifest.json'), 'manifest.json (run prepare-images.mjs first)', true);
  const products = readJson(join(work, 'products.json'), 'products.json', false) || {};
  const texts = readJson(join(work, 'texts.json'), 'texts.json', false) || {};

  let meta = null;
  let profileTokens = null;
  let profileDir = null;
  if (o.profile) {
    profileDir = resolve(o.profile);
    const tokensPath = /\.css$/i.test(profileDir) ? profileDir : join(profileDir, 'tokens.css');
    if (!existsSync(tokensPath)) fail(`no tokens.css in ${profileDir}`);
    profileTokens = readFileSync(tokensPath, 'utf8');
    if (!/\.css$/i.test(profileDir)) meta = readJson(join(profileDir, 'profile.meta.json'), 'profile.meta.json', false);
  }
  const style = resolveStyle(o.style, meta);
  const styleTokens = readFileSync(style.path, 'utf8');
  const lang = o.lang || (meta && ['pl', 'en'].includes(meta.lang) ? meta.lang : 'en');
  const t = strings(lang, o.kind);
  const brandName = o.brandName || meta?.fields?.name?.value || meta?.name || meta?.brand || null;

  let rooms = manifest.rooms || [];
  if (!rooms.length) fail('the manifest has no rooms');
  if (o.only) {
    rooms = rooms.filter((r) => r.slug === o.only);
    if (!rooms.length) fail(`--only ${o.only}: no such room; the manifest has ${manifest.rooms.map((r) => r.slug).join(', ')}`);
  }
  for (const r of rooms) {
    for (const i of r.images) {
      if (!i.file || !existsSync(join(work, i.file))) fail(`${i.id}: picture file missing (${i.file}); run prepare-images.mjs again`);
    }
  }
  const unchecked = rooms.filter((r) => r.nameSource === 'folder' && /\p{Lu}/u.test(r.folder || '') && (r.folder || '') === (r.folder || '').toLocaleUpperCase(lang));
  if (unchecked.length) {
    warnings.push(`room names read from capitalised folder names, not checked yet: ${unchecked.map((r) => `"${r.name}"`).join(', ')}. Fix proper nouns in manifest.json and set "nameSource": "checked"`);
  }
  const slugs = new Set(manifest.rooms.map((r) => r.slug));
  for (const k of Object.keys(products)) if (!slugs.has(k)) warnings.push(`products.json: room "${k}" is not in the manifest, its products are left out`);
  for (const k of Object.keys(texts.rooms || {})) if (!slugs.has(k)) warnings.push(`texts.json: room "${k}" is not in the manifest, its text is left out`);
  for (const r of rooms) {
    for (const p of products[r.slug] || []) {
      if (p.blocked || p.error || !p.name) warnings.push(`product left out (${r.slug}): ${p.url || p.slug}: ${p.reason || p.error || 'no name'}`);
      else if (!p.image) warnings.push(`product without a photo (${r.slug}): ${p.name}`);
    }
  }

  // Style underneath, brand on top: the profile's tokens win wherever they
  // speak; the style fills in what a profile does not carry.
  const combined = profileTokens
    ? `${styleTokens.trim()}\n\n/* ---- brand profile (${basename(profileDir)}) over style ${style.name} ---- */\n\n${profileTokens.trim()}\n`
    : styleTokens;
  const primarySource = profileTokens || styleTokens;
  const primary = firstVar(primarySource, 'primary');
  const color = primary ? parseColor(primary) : null;
  const hex = color ? formatHex(color) : '#888888';
  const favicon = `<link rel="icon" href="data:image/svg+xml,${encodeURIComponent(`<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'><rect x='4' y='4' width='24' height='24' rx='4' fill='${hex}'/></svg>`)}">`;

  const tpl = join(SKILL, 'templates', 'presentation');
  const css = readFileSync(join(tpl, 'presentation.css'), 'utf8');
  const js = readFileSync(join(tpl, 'lightbox.js'), 'utf8');
  let extraCss = null;
  if (o.extraCss) {
    try { extraCss = readFileSync(resolve(o.extraCss), 'utf8'); } catch (e) { fail(`cannot read ${o.extraCss}: ${e.code || e.message}`); }
    if (/<\/style/i.test(extraCss)) fail(`${o.extraCss} contains "</style"`);
  }
  const date = o.date ? new Date(`${o.date}T12:00:00`) : new Date();

  const html = build({
    t, lang, rooms, work, products, texts, single: rooms.length === 1, title: o.title.trim(), date, prices: o.prices,
    mark: brandMark(combined, brandName), favicon, css, js, extraCss,
  });
  const outPath = resolve(o.out);
  writeFileSync(outPath, html);

  const tokensFile = join(work, '.presentation-tokens.css');
  writeFileSync(tokensFile, combined);
  const apply = spawnSync(process.execPath, [join(__dirname, 'apply-tokens.mjs'), tokensFile, outPath], { encoding: 'utf8' });
  rmSync(tokensFile, { force: true });
  if (apply.status !== 0) fail(`apply-tokens failed: ${apply.stderr || apply.stdout}`);

  const size = statSync(outPath).size;
  console.log(`build-presentation: wrote ${outPath} (${bytesText(size)})`);
  console.log(`build-presentation: ${rooms.length === 1 ? `one room (${rooms[0].slug})` : `${rooms.length} rooms`}, style ${style.name}${profileDir ? ` under profile ${basename(profileDir)}` : ''}, lang ${lang}`);
  if (size > 4 * 1048576) {
    console.log(`build-presentation: ${bytesText(size)} is over 4 MB: publish it through the upload URL (markloop_request_upload, presignedUploadUrl), not as inline content; see reference/publish.md`);
  }
  if (warnings.length) {
    console.warn(`build-presentation: ${warnings.length} warning(s):`);
    for (const w of warnings) console.warn(`  - ${w}`);
  }
  const checkScript = o.checkScript ? resolve(o.checkScript) : join(__dirname, 'check-document.mjs');
  const check = spawnSync(process.execPath, [checkScript, outPath], { encoding: 'utf8', stdio: 'inherit' });
  process.exit(check.status ?? 1);
}

main();
