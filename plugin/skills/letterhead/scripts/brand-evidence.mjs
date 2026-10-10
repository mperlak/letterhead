#!/usr/bin/env node
// Brand evidence collector.
//
// Purpose: given one or more URLs (or local .html files), fetch the page and
// its stylesheets and produce a JSON report of RANKED CANDIDATES for brand
// colors, fonts, and logos, each with provenance (where it came from, how
// many times it occurred, which CSS variable named it). This script never
// picks a final primary color, font, or logo — it only lists candidates and
// flags. A reader (human or agent) makes the final call.
//
// Usage:
//   node brand-evidence.mjs [--depth 0|1] [--pretty] [--summary] [--out <file.json>]
//                           [--save-logo <path> [--logo-index N]] <url-or-local-file> ...
//
//   --depth 1   also fetch up to 3 same-origin pages linked from the main
//               nav/header, merging their CSS into the site's evidence.
//   --pretty    pretty-print the JSON output.
//   --summary   print a short text digest (name, language, page colors, top
//               colors with logoDistance, fonts, top logo candidates, tone
//               lines) instead of the JSON.
//   --out       write the full JSON to this file instead of stdout.
//   --save-logo write logo candidate N (default 0, the best ranked; see
//               --logo-index) of the first site to <path>, with the
//               extension the file's bytes call for (`logo` -> `logo.png`).
//               Behind an image optimizer (`/_next/image?url=…`) it saves
//               the original file, and the optimized copy only when the
//               original cannot be fetched.
//
//   URLs read from attributes (src, srcset, href, content, style url())
//   are entity-decoded; logo[].url is the original file behind an image
//   optimizer, with logo[].optimizedUrl the URL the page requested.
//
//   A local file path ending in .html is read from disk instead of fetched;
//   relative <link rel=stylesheet> hrefs are resolved against the file's
//   own directory and read from disk too.
//
// Limits: 12s per network request, at most 8 stylesheets fetched per page,
// 600KB read per text resource, 40s total wall time per site. A site that
// fails (bad host, timeout, 4xx/5xx with no body) never crashes the run —
// its entry in "sites" gets a non-null "error" and the script moves on.
//
// Output: one JSON object on stdout (schema 1, see "sites[]"), or in the
// --out file; --summary prints the digest instead. Progress and
// per-resource warnings go to stderr, never to stdout. Every colors[] entry
// carries logoDistance (ΔE OKLab x100 to the nearest color of the logo in
// sites[].logoDistanceFrom, null without one).
//
// Exit codes:
//   0 — JSON was produced (even if individual sites have per-site errors)
//   1 — usage error (no input, bad flag, bad --depth value)
//   3 — output produced, but --save-logo could not save the logo
//
// No dependencies beyond Node's built-ins (node:fs, node:path, global
// fetch) and the bundled node-html-parser in vendor/. No network access beyond the hosts implied by the given inputs
// (the page itself, its same-origin stylesheets, and, with --depth 1, up to
// three same-origin pages linked from its nav/header).

import { readFileSync, writeFileSync, mkdirSync, existsSync, statSync, openSync, readSync, closeSync } from 'node:fs';
import { resolve as resolvePath, relative as relativePath, dirname } from 'node:path';
import { inflateSync, constants as zlibConstants } from 'node:zlib';
import { parse as parseHtml } from './vendor/node-html-parser.mjs';

const UA = 'Mozilla/5.0 (compatible; brand-evidence/1.0)';
const TIMEOUT_MS = 12_000;
const MAX_CSS_PER_PAGE = 8;
const MAX_BYTES = 600_000;
const SITE_WALL_MS = 40_000;
const MAX_NAV_LINKS = 3;
const HEADER_SNIFF_BYTES = 16_384;
// Budget for the logo whiteOnTransparent inspection pass: "first 64KB, or
// the whole file if smaller" per the spec.
const LOGO_ANALYSIS_BYTES = 65_536;

// CSS custom-property name substrings that mark a value as belonging to a
// third-party widget/plugin rather than the site's own brand. Matched
// case-insensitively against the variable name (including its "--"),
// substring, not anchored — these come from observed real sites (Gravity
// Forms, Stackable, a chat widget, cookie-consent banners, Tailwind's own
// internal state variables, Elementor, WP admin/editor chrome, Swiper).
const VENDOR_VAR_PATTERNS = [
  'gf-', 'tw-', 'stk-', 'in-touch', 'cky', 'cookie', 'consent', 'chat',
  'widget', 'swiper', 'elementor', 'wp-admin', 'wp-editor',
  'wp--preset--', 'wp-block-', 'wp-editor-', 'wp-admin-', 'et-', 'divi',
  'wf-', 'gform', 'cc-', 'fupi-', 'gdpr', 'cmplz', 'onetrust', 'iubenda',
];

// Theme-palette names a site owner fills in: WordPress block-theme presets
// (`--wp--preset--color--primary`) and Elementor global colors
// (`--e-global-color-accent`, `--e-global-color-266cbbf`). These carry the
// brand, so they override the vendor patterns above. The rest of the WP
// preset palette (vivid-red, luminous-vivid-amber, ...) is core's default
// swatch set and stays vendor.
const WP_BRAND_PRESET_RE =
  /^--wp--preset--color--(primary|secondary|tertiary|accent|brand|body-text|text|heading|base|contrast|foreground|background)(-(hover|light|lighter|dark|darker|alt|\d+))*$/i;
const ELEMENTOR_GLOBAL_RE = /^--e-global-color-[\w-]+$/i;
const isBrandNamespaceVar = (name) => WP_BRAND_PRESET_RE.test(name) || ELEMENTOR_GLOBAL_RE.test(name);
// The colors a fresh Elementor kit ships with. A global still at its
// default is the page builder's swatch, not a brand decision: read
// literally, "a variable named primary wins" elects Elementor's #6ec1e4.
const ELEMENTOR_DEFAULT_KIT = {
  '--e-global-color-primary': '#6ec1e4',
  '--e-global-color-secondary': '#54595f',
  '--e-global-color-text': '#7a7a7a',
  '--e-global-color-accent': '#61ce70',
};

// Selectors that belong to somebody else's chrome: the WP admin bar (served
// to the public on some sites), and cookie/consent banners. A color used
// only under these is vendor even without a vendor-named variable.
const VENDOR_SELECTOR_RE =
  /#wpadminbar|\.wp-admin\b|\.ab-[\w-]|cookie|consent|gdpr|cmplz|\bcky-|\.cky\b|onetrust|iubenda|cybot|\.cc-(window|banner|btn|compliance|revoke)|\.fupi/i;

// SVG shape elements. A CSS rule whose target is one of these paints an
// icon or an inline logo, not a button or a nav item.
const SVG_TAGS = new Set(['svg', 'path', 'circle', 'rect', 'g', 'use', 'polygon', 'polyline', 'ellipse', 'line', 'stop', 'symbol']);

// Icon fonts: glyph sets, never a text face.
const ICON_FONT_RE =
  /dashicons|font ?awesome|fontawesome|^fa[- ]?(solid|regular|brands|light|thin|duotone)|material (icons|symbols)|eicons|icomoon|elementor-icons|fontello|glyphicons|ionicons|themify|linearicons|simple-line-icons|genericons|typicons|entypo|etmodules|revicons|boxicons|remixicon|line ?awesome|fl-icons|flaticon|^star$|^woocommerce$|(^|[\s_-])icons?([\s_-]|$)|icons$/i;
const isIconFont = (family) => ICON_FONT_RE.test(family || '');

// Non-variable selector contexts that count as "brand" surfaces for the
// vendor-variable rescue below (b/nav/header — the false-positive report
// was a real accent color only ever named through a vendor-prefixed CSS
// variable, but used directly on the button, nav and header).
const BRAND_RESCUE_CONTEXTS = new Set(['button', 'nav', 'header']);

const GENERIC_FONT_RE =
  /^(sans-serif|serif|monospace|system-ui|-apple-system|ui-sans-serif|ui-monospace|ui-serif|blinkmacsystemfont)$/i;

// Font-provider CSS is read from the <link> URL itself (family names and
// fonts.fontSource), never fetched.
const SKIP_STYLESHEET_HOSTS = ['fonts.googleapis.com', 'fonts.gstatic.com', 'api.fontshare.com'];

// ---------------------------------------------------------------------------
// small utilities
// ---------------------------------------------------------------------------

function progress(msg) {
  process.stderr.write(`[brand-evidence] ${msg}\n`);
}

const round = (n) => Math.round(n * 100) / 100;
const isLocalInput = (input) => !/^https?:\/\//i.test(input);
const absUrl = (base, href) => {
  try {
    return new URL(href, base).href;
  } catch {
    return null;
  }
};
const safeOrigin = (u) => {
  try {
    return new URL(u).origin;
  } catch {
    return null;
  }
};
const NAMED_ENTITIES = {
  amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', copy: '©', reg: '®', trade: '™',
  ndash: '–', mdash: '—', hellip: '…', lsquo: '‘', rsquo: '’', ldquo: '“', rdquo: '”', laquo: '«',
  raquo: '»', middot: '·', bull: '•',
};

// Decodes numeric (&#8211; / &#x2013;) and common named entities. Runs twice
// so a double-encoded value from a CMS (`&amp;#8211;`) comes out as "–".
function decodeEntities(s) {
  if (!s) return s;
  const once = (t) =>
    t.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, code) => {
      if (code[0] === '#') {
        const n = code[1] === 'x' || code[1] === 'X' ? parseInt(code.slice(2), 16) : parseInt(code.slice(1), 10);
        try {
          return Number.isFinite(n) && n > 0 ? String.fromCodePoint(n) : m;
        } catch {
          return m;
        }
      }
      const v = NAMED_ENTITIES[code.toLowerCase()];
      return v === undefined ? m : v;
    });
  return once(once(s));
}

function stripTags(s) {
  return decodeEntities(s.replace(/<[^>]+>/g, ' '))
    .replace(/\s+/g, ' ')
    .trim();
}

// Visible-text version of a page: scripts, styles, noscript and inline SVG
// removed first, so a copyright regex never runs into a JSON blob.
function visibleText(html) {
  return stripTags(html.replace(/<(script|style|noscript|svg|template)\b[\s\S]*?<\/\1>/gi, ' '));
}

// ---------------------------------------------------------------------------
// CSS rule + selector helpers (regex-level, no parser dependency)
// ---------------------------------------------------------------------------

const stripCssComments = (css) => css.replace(/\/\*[\s\S]*?\*\//g, ' ');

// Innermost `selector { body }` pairs in source order. @media wrappers are
// skipped naturally because the selector capture cannot contain a brace.
function parseRules(css) {
  const rules = [];
  for (const m of css.matchAll(/([^{}]{0,300})\{([^{}]*)\}/g)) {
    const selector = m[1].trim();
    if (!selector || selector.startsWith('@')) continue;
    rules.push({ selector, body: m[2], index: rules.length });
  }
  return rules;
}

function customProps(css) {
  const props = new Map();
  for (const m of css.matchAll(/(--[\w-]+)\s*:\s*([^;}]+)/g)) props.set(m[1], m[2].trim());
  return props;
}

// Splits on `sep` characters at bracket/paren depth 0, honoring backslash
// escapes (Tailwind's `.md\:flex`, `.w-1\/2`, `.bg-\[\#fff\]`).
function splitTopLevel(s, isSep) {
  const out = [];
  let depth = 0;
  let cur = '';
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (ch === '\\') {
      cur += ch + (s[i + 1] ?? '');
      i++;
      continue;
    }
    if (ch === '(' || ch === '[') depth++;
    else if (ch === ')' || ch === ']') depth = Math.max(0, depth - 1);
    if (depth === 0 && isSep(ch)) {
      out.push(cur);
      cur = '';
      continue;
    }
    cur += ch;
  }
  out.push(cur);
  return out.map((p) => p.trim()).filter(Boolean);
}

const selectorParts = (selector) => splitTopLevel(selector, (c) => c === ',');
const compoundsOf = (part) => splitTopLevel(part, (c) => c === ' ' || c === '>' || c === '+' || c === '~' || c === '\n' || c === '\t');

// { tag, classes, ids, notClasses, pseudo } for one compound selector
// ("h1.title:hover"). `:not(.x)` is split out into notClasses so that
// `.public-container:not(.posts)` still reads as a plain class rule.
function parseCompound(compound) {
  const unescape = (t) => t.replace(/\\(.)/g, '$1');
  const notClasses = [];
  const core = compound.replace(/:not\(([^()]*)\)/gi, (m, inner) => {
    for (const cm of inner.matchAll(/\.((?:\\.|[\w-])+)/g)) notClasses.push(unescape(cm[1]));
    return '';
  });
  const tag = (core.match(/^([a-z][a-z0-9-]*|\*)/i) || [])[1]?.toLowerCase() || null;
  const classes = [...core.matchAll(/\.((?:\\.|[\w-])+)/g)].map((m) => unescape(m[1]));
  const ids = [...core.matchAll(/#((?:\\.|[\w-])+)/g)].map((m) => unescape(m[1]));
  const pseudo = /(^|[^\\]):(?!where\(|is\()/.test(core.replace(/\[[^\]]*\]/g, ''));
  return { tag, classes, ids, notClasses, pseudo };
}

// Class tokens and ids present anywhere in the fetched HTML.
function htmlTokenIndex(htmlList) {
  const classes = new Set();
  const ids = new Set();
  for (const html of htmlList) {
    for (const m of html.matchAll(/\bclass=(?:"([^"]*)"|'([^']*)')/gi)) {
      for (const t of (m[1] ?? m[2]).split(/\s+/)) if (t) classes.add(t);
    }
    for (const m of html.matchAll(/\bid=(?:"([^"]*)"|'([^']*)')/gi)) ids.add(m[1] ?? m[2]);
  }
  return { classes, ids };
}

// Class list of every opening tag of the given name, in document order.
function elementClassLists(html, tagName) {
  const re = new RegExp(`<${tagName}\\b([^>]*)>`, 'gi');
  return [...html.matchAll(re)].map((m) => {
    const c = (m[1].match(/\bclass=(?:"([^"]*)"|'([^']*)')/i) || []);
    return (c[1] ?? c[2] ?? '').split(/\s+/).filter(Boolean);
  });
}

// A selector part "can match the page" when every class and id it names
// occurs somewhere in the fetched HTML. Element-only selectors always can.
function partMatchesPage(part, index) {
  if (!index) return true;
  for (const c of compoundsOf(part)) {
    const { classes, ids } = parseCompound(c);
    if (classes.some((k) => !index.classes.has(k))) return false;
    if (ids.some((k) => !index.ids.has(k))) return false;
  }
  return true;
}

// Rules whose ONLY compound is classes (optionally on the given tag), all of
// which the element carries, with no pseudo-class: `.font-heading`,
// `h1.title`, `.elementor-kit-5`. Returns the matching rules in source order.
function rulesForElementClasses(rules, elementClasses, tag) {
  if (!elementClasses.length) return [];
  const have = new Set(elementClasses);
  return rules.filter((r) =>
    selectorParts(r.selector).some((part) => {
      const comps = compoundsOf(part);
      if (comps.length !== 1) return false;
      const { tag: t, classes, ids, notClasses, pseudo } = parseCompound(comps[0]);
      if (pseudo || ids.length || !classes.length) return false;
      if (t && t !== '*' && t !== tag) return false;
      return classes.every((k) => have.has(k)) && !notClasses.some((k) => have.has(k));
    })
  );
}

// Last value of `prop` (bare property, not a longer one like
// background-color when asked for color) declared in a rule body.
function declValue(body, prop) {
  let found = null;
  const re = new RegExp(`(?<![-\\w])${prop}\\s*:\\s*([^;]+)`, 'gi');
  for (const m of body.matchAll(re)) found = m[1].replace(/!important/i, '').trim();
  return found;
}

// ---------------------------------------------------------------------------
// network
// ---------------------------------------------------------------------------

async function fetchText(url, deadline) {
  const remaining = deadline ? deadline - Date.now() : TIMEOUT_MS;
  if (remaining <= 0) {
    return { ok: false, status: 0, url, text: '', bytes: 0, err: 'wall-time budget exceeded' };
  }
  const timeoutMs = Math.max(500, Math.min(TIMEOUT_MS, remaining));
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), timeoutMs);
  try {
    const r = await fetch(url, {
      headers: { 'user-agent': UA, accept: 'text/html,text/css,*/*' },
      redirect: 'follow',
      signal: ctl.signal,
    });
    const buf = Buffer.from(await r.arrayBuffer());
    return {
      ok: r.ok,
      status: r.status,
      url: r.url,
      text: buf.subarray(0, MAX_BYTES).toString('utf8'),
      bytes: buf.length,
    };
  } catch (e) {
    return { ok: false, status: 0, url, text: '', bytes: 0, err: e.message };
  } finally {
    clearTimeout(timer);
  }
}

// Reads only the first HEADER_SNIFF_BYTES of a remote resource (via Range,
// cancelling the stream once we have enough) so dimension sniffing never
// downloads a whole image.
async function fetchHeaderBytes(url, deadline, maxBytes = HEADER_SNIFF_BYTES) {
  const remaining = deadline ? deadline - Date.now() : TIMEOUT_MS;
  if (remaining <= 0) return { ok: false, buf: Buffer.alloc(0), totalBytes: null };
  const timeoutMs = Math.max(500, Math.min(TIMEOUT_MS, remaining));
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      headers: { 'user-agent': UA, range: `bytes=0-${maxBytes - 1}` },
      redirect: 'follow',
      signal: ctl.signal,
    });
    let totalBytes = null;
    const cr = res.headers.get('content-range');
    const cl = res.headers.get('content-length');
    if (cr) {
      const m = cr.match(/\/(\d+)$/);
      if (m) totalBytes = Number(m[1]);
    } else if (cl) {
      totalBytes = Number(cl);
    }
    let buf;
    if (res.body && typeof res.body.getReader === 'function') {
      const reader = res.body.getReader();
      const chunks = [];
      let received = 0;
      while (received < maxBytes) {
        const { done, value } = await reader.read();
        if (done) break;
        chunks.push(value);
        received += value.length;
      }
      try {
        reader.cancel();
      } catch {
        /* ignore */
      }
      buf = Buffer.concat(chunks.map((c) => Buffer.from(c))).subarray(0, maxBytes);
    } else {
      buf = Buffer.from(await res.arrayBuffer()).subarray(0, maxBytes);
    }
    return { ok: res.ok || res.status === 206, buf, totalBytes };
  } catch {
    return { ok: false, buf: Buffer.alloc(0), totalBytes: null };
  } finally {
    clearTimeout(timer);
  }
}

function readLocalHeaderBytes(path, maxBytes = HEADER_SNIFF_BYTES) {
  try {
    const stat = statSync(path);
    const fd = openSync(path, 'r');
    const buf = Buffer.alloc(Math.min(maxBytes, stat.size));
    const bytesRead = readSync(fd, buf, 0, buf.length, 0);
    closeSync(fd);
    return { ok: true, buf: buf.subarray(0, bytesRead), totalBytes: stat.size };
  } catch {
    return { ok: false, buf: Buffer.alloc(0), totalBytes: null };
  }
}

// ---------------------------------------------------------------------------
// color helpers (sRGB only — enough for classification, not color science)
// ---------------------------------------------------------------------------

function parseColor(s) {
  s = s.trim().toLowerCase();
  let m;
  if ((m = s.match(/^#([0-9a-f]{3,8})$/))) {
    let h = m[1];
    if (h.length === 3 || h.length === 4) h = [...h].map((c) => c + c).join('');
    if (h.length < 6) return null;
    return { r: parseInt(h.slice(0, 2), 16), g: parseInt(h.slice(2, 4), 16), b: parseInt(h.slice(4, 6), 16) };
  }
  if ((m = s.match(/^rgba?\(\s*([\d.]+)[\s,]+([\d.]+)[\s,]+([\d.]+)/))) {
    return { r: +m[1], g: +m[2], b: +m[3] };
  }
  if ((m = s.match(/^hsla?\(\s*([\d.]+)[\s,]+([\d.]+)%[\s,]+([\d.]+)%/))) {
    const h = +m[1] / 360;
    const sl = +m[2] / 100;
    const l = +m[3] / 100;
    const f = (n) => {
      const k = (n + h * 12) % 12;
      const a = sl * Math.min(l, 1 - l);
      return Math.round(255 * (l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1))));
    };
    return { r: f(0), g: f(8), b: f(4) };
  }
  return null;
}

function hslOf({ r, g, b }) {
  r /= 255;
  g /= 255;
  b /= 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  if (max === min) return { h: 0, s: 0, l };
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h = max === r ? (g - b) / d + (g < b ? 6 : 0) : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return { h: h * 60, s, l };
}

const hexOf = ({ r, g, b }) => '#' + [r, g, b].map((v) => Math.round(v).toString(16).padStart(2, '0')).join('');

// sRGB → OKLab, for one number the reader can compare: how far a page color
// sits from the logo's own color.
function oklabOf({ r, g, b }) {
  const lin = (v) => {
    v /= 255;
    return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  };
  const [lr, lg, lb] = [lin(r), lin(g), lin(b)];
  const l = Math.cbrt(0.4122214708 * lr + 0.5363325363 * lg + 0.0514459929 * lb);
  const m = Math.cbrt(0.2119034982 * lr + 0.6806995451 * lg + 0.1073969566 * lb);
  const s = Math.cbrt(0.0883024619 * lr + 0.2817188376 * lg + 0.6299787005 * lb);
  return [
    0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
    1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
    0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
  ];
}

// ΔE in OKLab, scaled by 100: 0 is the same color, under about 5 reads as
// the same color, over about 15 is plainly a different one.
function deltaEOk(hexA, hexB) {
  const a = parseColor(hexA);
  const b = parseColor(hexB);
  if (!a || !b) return null;
  const [l1, a1, b1] = oklabOf(a);
  const [l2, a2, b2] = oklabOf(b);
  return Math.round(Math.hypot(l1 - l2, a1 - a2, b1 - b2) * 1000) / 10;
}

// The logo whose colors colors[].logoDistance is measured against: the
// first of the top three non-strip candidates (og:image is a photo, not a
// mark) that paints with a saturated color.
// The logo the distances are measured against. Candidates where a logo
// sits (home link, header, footer) come first: when the real logo there is
// greys only, a picture further down the page is not the brand's color
// (Fiklon's grey logo would otherwise hand the reference to an
// illustration in the content).
function logoReference(logos) {
  const pool = logos.filter((l) => !l.strip && l.kind !== 'og:image').slice(0, 3);
  const placed = pool.filter((l) => l.homeLink || l.location === 'header' || l.location === 'footer');
  return (placed.length ? placed : pool).find((l) => Array.isArray(l.colors) && l.colors.length > 0) || null;
}

function addLogoDistances(site) {
  const ref = logoReference(site.logo || []);
  site.logoDistanceFrom = ref ? { url: ref.url, kind: ref.kind, colors: ref.colors.map((c) => c.hex) } : null;
  for (const c of site.colors || []) {
    if (!ref) {
      c.logoDistance = null;
      continue;
    }
    const ds = ref.colors.map((lc) => deltaEOk(c.hex, lc.hex)).filter((d) => d != null);
    c.logoDistance = ds.length ? Math.min(...ds) : null;
  }
}

const isVendorVar = (name) => {
  if (isBrandNamespaceVar(name)) return false;
  const n = name.toLowerCase();
  return VENDOR_VAR_PATTERNS.some((p) => n.includes(p));
};

// ---------------------------------------------------------------------------
// logo[].whiteOnTransparent — cheap raster/vector inspection, no decoder deps
// ---------------------------------------------------------------------------

function extOf(urlOrPath) {
  const clean = (urlOrPath || '').split('?')[0].split('#')[0];
  const m = clean.match(/\.([a-z0-9]+)$/i);
  return m ? m[1].toLowerCase() : '';
}

// Minimal chunked-PNG walk: signature + length-prefixed chunks. Never throws
// on truncated input — a chunk whose declared length runs past the buffer
// just gets clamped, so a partial (first-64KB) read degrades gracefully.
function parsePngChunks(buf) {
  const chunks = [];
  if (buf.length < 8) return chunks;
  let off = 8;
  while (off + 8 <= buf.length) {
    const len = buf.readUInt32BE(off);
    const type = buf.toString('ascii', off + 4, off + 8);
    const dataStart = off + 8;
    const dataEnd = Math.min(dataStart + len, buf.length);
    chunks.push({ type, data: buf.subarray(dataStart, dataEnd) });
    if (type === 'IEND') break;
    off = dataStart + len + 4; // skip the 4-byte CRC we don't verify
  }
  return chunks;
}

// PNG "None"/"Sub"/"Up"/"Average"/"Paeth" scanline unfilter for one row.
function unfilterRow(filterType, src, prevRow, dst, bpp) {
  for (let i = 0; i < src.length; i++) {
    const x = src[i];
    const a = i >= bpp ? dst[i - bpp] : 0;
    const b = prevRow[i] || 0;
    const c = i >= bpp ? prevRow[i - bpp] || 0 : 0;
    let value;
    switch (filterType) {
      case 1:
        value = x + a;
        break;
      case 2:
        value = x + b;
        break;
      case 3:
        value = x + ((a + b) >> 1);
        break;
      case 4: {
        const p = a + b - c;
        const pa = Math.abs(p - a);
        const pb = Math.abs(p - b);
        const pc = Math.abs(p - c);
        value = x + (pa <= pb && pa <= pc ? a : pb <= pc ? b : c);
        break;
      }
      default:
        value = x; // filter 0 (None), or an unrecognized type
    }
    dst[i] = value & 0xff;
  }
}

// PNG whiteOnTransparent per the teach spec: palette images pass if every
// PLTE entry is near-white and a tRNS chunk is present; RGBA (color type 6,
// 8-bit) images are inflated and sampled at up to ~2000 pixels. Returns
// true/false, or null when the buffer can't be classified (unsupported
// depth/color type mid-decode, or a decode error) rather than guessing.
function detectPngWhiteOnTransparent(buf) {
  try {
    if (!buf || buf.length < 24 || buf[0] !== 0x89 || buf[1] !== 0x50 || buf[2] !== 0x4e || buf[3] !== 0x47) {
      return null;
    }
    const chunks = parsePngChunks(buf);
    const ihdr = chunks.find((c) => c.type === 'IHDR');
    if (!ihdr || ihdr.data.length < 13) return null;
    const width = ihdr.data.readUInt32BE(0);
    const height = ihdr.data.readUInt32BE(4);
    const bitDepth = ihdr.data[8];
    const colorType = ihdr.data[9];
    if (!width || !height) return null;

    if (colorType === 3) {
      const plte = chunks.find((c) => c.type === 'PLTE');
      const trns = chunks.find((c) => c.type === 'tRNS');
      if (!plte || !trns || plte.data.length < 3) return false;
      // A fully-transparent palette entry's RGB is cosmetically irrelevant
      // (encoders often leave it at 0,0,0) — only entries that actually
      // paint a pixel need to clear the near-white floor, and at least one
      // entry must actually be transparent for "on transparent" to hold.
      let anyTransparent = false;
      for (let i = 0; i + 2 < plte.data.length; i += 3) {
        const idx = i / 3;
        const alpha = idx < trns.data.length ? trns.data[idx] : 255;
        if (alpha === 0) {
          anyTransparent = true;
          continue;
        }
        if (plte.data[i] < 0xf0 || plte.data[i + 1] < 0xf0 || plte.data[i + 2] < 0xf0) return false;
      }
      return anyTransparent;
    }

    if (colorType !== 6) return false; // no alpha channel — no transparency signal
    if (bitDepth !== 8) return null; // unsupported depth for the pixel sampler below

    const idat = Buffer.concat(chunks.filter((c) => c.type === 'IDAT').map((c) => c.data));
    if (idat.length === 0) return null;
    let raw;
    try {
      // Z_SYNC_FLUSH tolerates a stream truncated by the 64KB read budget
      // instead of throwing on unexpected end-of-input.
      raw = inflateSync(idat, { finishFlush: zlibConstants.Z_SYNC_FLUSH });
    } catch {
      return null;
    }

    const bpp = 4;
    const stride = width * bpp;
    const rows = Math.min(height, Math.floor(raw.length / (stride + 1)));
    if (rows < 1) return null;

    const pixels = Buffer.alloc(rows * stride);
    let prevRow = Buffer.alloc(stride);
    for (let y = 0; y < rows; y++) {
      const rowStart = y * (stride + 1);
      const filterType = raw[rowStart];
      const src = raw.subarray(rowStart + 1, rowStart + 1 + stride);
      const dst = pixels.subarray(y * stride, y * stride + stride);
      unfilterRow(filterType, src, prevRow, dst, bpp);
      prevRow = dst;
    }

    const totalPixels = rows * width;
    if (totalPixels === 0) return null;
    const step = Math.max(1, Math.floor(totalPixels / 2000));
    let sampled = 0;
    let transparent = 0;
    let nonTransparent = 0;
    let whiteish = 0;
    for (let p = 0; p < totalPixels; p += step) {
      const o = p * bpp;
      const r = pixels[o];
      const g = pixels[o + 1];
      const b = pixels[o + 2];
      const a = pixels[o + 3];
      sampled++;
      if (a === 0) {
        transparent++;
      } else {
        nonTransparent++;
        if (r >= 0xe0 && g >= 0xe0 && b >= 0xe0) whiteish++;
      }
    }
    if (sampled === 0) return null;
    const transparentRatio = transparent / sampled;
    const whiteRatio = nonTransparent > 0 ? whiteish / nonTransparent : 0;
    return whiteRatio >= 0.95 && transparentRatio >= 0.1;
  } catch {
    return null;
  }
}

// SVG whiteOnTransparent: true only when every fill declaration (attribute
// or CSS) resolves to white/near-white or currentColor, and at least one
// fill was found at all.
function detectSvgWhiteOnTransparent(svgText) {
  try {
    const fills = [...svgText.matchAll(/\bfill\s*[:=]\s*["']?\s*([^"';)\s>]+)/gi)].map((m) => m[1].toLowerCase());
    const relevant = fills.filter((f) => f !== 'none' && f !== 'transparent');
    if (relevant.length === 0) return false;
    const isWhiteish = (v) => v === 'white' || v === '#fff' || v === '#ffffff' || v === 'currentcolor';
    return relevant.every(isWhiteish);
  } catch {
    return null;
  }
}

// logo[].colors: the saturated colors a logo paints with. Quantized to 16
// levels per channel so anti-aliased edges fold into their fill; buckets
// under 5% of the saturated pixels are noise and dropped.
const isSaturated = ([r, g, b]) => {
  const { s, l } = hslOf({ r, g, b });
  return s >= 0.35 && l > 0.12 && l < 0.92;
};

function dominantColors(samples, total) {
  const buckets = new Map();
  let saturated = 0;
  for (const [rgb, weight] of samples) {
    if (!isSaturated(rgb)) continue;
    saturated += weight;
    const key = rgb.map((v) => v >> 4).join(',');
    const b = buckets.get(key) || { n: 0, sum: [0, 0, 0] };
    b.n += weight;
    rgb.forEach((v, k) => (b.sum[k] += v * weight));
    buckets.set(key, b);
  }
  // Neighbouring buckets of one fill (shading, edges) merge into the
  // biggest of them.
  const merged = [];
  const mean = (b) => b.sum.map((v) => v / b.n);
  for (const b of [...buckets.values()].sort((x, y) => y.n - x.n)) {
    const near = merged.find((m) => mean(m).every((v, k) => Math.abs(v - mean(b)[k]) <= 40));
    if (near) {
      near.n += b.n;
      b.sum.forEach((v, k) => (near.sum[k] += v));
    } else merged.push({ n: b.n, sum: [...b.sum] });
  }
  return merged
    .filter((b) => b.n >= saturated * 0.05)
    .sort((a, b) => b.n - a.n)
    .slice(0, 4)
    .map((b) => ({ hex: hexOf({ r: b.sum[0] / b.n, g: b.sum[1] / b.n, b: b.sum[2] / b.n }), share: Math.round((b.n / total) * 1000) / 1000 }));
}

function svgLogoColors(svgText) {
  try {
    const samples = [];
    for (const m of svgText.matchAll(/\b(?:fill|stroke|stop-color)\s*[:=]\s*["']?\s*(#[0-9a-f]{3,8}\b|rgba?\([^)]*\)|hsla?\([^)]*\))/gi)) {
      const c = parseColor(m[1]);
      if (c) samples.push([[c.r, c.g, c.b], 1]);
    }
    if (!samples.length) return [];
    return dominantColors(samples, samples.length);
  } catch {
    return null;
  }
}

function pngLogoColors(buf) {
  try {
    if (!buf || buf.length < 24 || buf[0] !== 0x89 || buf[1] !== 0x50) return null;
    const chunks = parsePngChunks(buf);
    const ihdr = chunks.find((c) => c.type === 'IHDR')?.data;
    if (!ihdr || ihdr.length < 13) return null;
    const width = ihdr.readUInt32BE(0);
    const height = ihdr.readUInt32BE(4);
    const bitDepth = ihdr[8];
    const colorType = ihdr[9];
    if (ihdr[12] !== 0 || !width || !height) return null;
    const plte = chunks.find((c) => c.type === 'PLTE')?.data;
    const trns = chunks.find((c) => c.type === 'tRNS')?.data;
    if (colorType === 3 && bitDepth !== 8) {
      // Low-depth palette: weigh every opaque entry the same.
      if (!plte) return null;
      const samples = [];
      for (let i = 0; i + 2 < plte.length; i += 3) {
        if (trns && i / 3 < trns.length && trns[i / 3] < 200) continue;
        samples.push([[plte[i], plte[i + 1], plte[i + 2]], 1]);
      }
      return samples.length ? dominantColors(samples, samples.length) : [];
    }
    const bpp = { 2: 3, 3: 1, 6: 4 }[colorType];
    if (!bpp || bitDepth !== 8) return null;
    const idat = Buffer.concat(chunks.filter((c) => c.type === 'IDAT').map((c) => c.data));
    const raw = inflateSync(idat, { finishFlush: zlibConstants.Z_SYNC_FLUSH });
    const stride = width * bpp;
    const rows = Math.min(height, Math.floor(raw.length / (stride + 1)));
    if (rows < 1) return null;
    let prev = Buffer.alloc(stride);
    const pixels = Buffer.alloc(rows * stride);
    for (let y = 0; y < rows; y++) {
      const dst = pixels.subarray(y * stride, (y + 1) * stride);
      unfilterRow(raw[y * (stride + 1)], raw.subarray(y * (stride + 1) + 1, y * (stride + 1) + 1 + stride), prev, dst, bpp);
      prev = dst;
    }
    const total = rows * width;
    const step = Math.max(1, Math.floor(total / 4000));
    const samples = [];
    let painted = 0;
    for (let p = 0; p < total; p += step) {
      const o = p * bpp;
      let rgb;
      let a = 255;
      if (colorType === 3) {
        const idx = pixels[o];
        if (!plte || idx * 3 + 2 >= plte.length) continue;
        rgb = [plte[idx * 3], plte[idx * 3 + 1], plte[idx * 3 + 2]];
        if (trns && idx < trns.length) a = trns[idx];
      } else {
        rgb = [pixels[o], pixels[o + 1], pixels[o + 2]];
        if (colorType === 6) a = pixels[o + 3];
      }
      if (a < 200) continue;
      painted++;
      samples.push([rgb, 1]);
    }
    return painted ? dominantColors(samples, painted) : [];
  } catch {
    return null;
  }
}

async function readLogoAnalysisBytes(url, isLocal, deadline) {
  if (isLocal) {
    if (/^https?:\/\//i.test(url)) return null; // no network fetches from local-file mode
    const info = readLocalHeaderBytes(url, LOGO_ANALYSIS_BYTES);
    return info.ok ? info.buf : null;
  }
  const info = await fetchHeaderBytes(url, deadline, LOGO_ANALYSIS_BYTES);
  return info.ok ? info.buf : null;
}

// Fills in `whiteOnTransparent` on every url-bearing logo candidate whose
// extension we can classify. svg-inline candidates are handled inline at
// collection time (the markup is already in hand); this pass covers img,
// background, og:image, and icon candidates instead.
async function resolveWhiteOnTransparent(candidates, { isLocal, deadline }) {
  for (const c of candidates) {
    if (c.whiteOnTransparent !== null || !c.url) continue;
    const ext = extOf(c.url);
    if (ext === 'jpg' || ext === 'jpeg') {
      c.whiteOnTransparent = false; // no alpha channel — never a transparency candidate
      continue;
    }
    if (ext !== 'png' && ext !== 'svg') continue; // unclassifiable extension — leave null
    if (Date.now() > deadline) continue;
    try {
      const buf = await readLogoAnalysisBytes(c.url, isLocal, deadline);
      if (!buf || buf.length === 0) continue;
      c.whiteOnTransparent = ext === 'png' ? detectPngWhiteOnTransparent(buf) : detectSvgWhiteOnTransparent(buf.toString('utf8'));
      c.colors = ext === 'png' ? pngLogoColors(buf) : svgLogoColors(buf.toString('utf8'));
    } catch {
      c.whiteOnTransparent = null;
    }
  }
}

// ---------------------------------------------------------------------------
// colors[]
// ---------------------------------------------------------------------------

const CONTEXT_TESTS = [
  ['button', /\bbtn\b|\bbutton\b|\bcta\b/i],
  ['nav', /\bnav\b|\bmenu\b/i],
  ['header', /\bheader\b|\bmasthead\b/i],
  ['link', /(^|[\s,>+~])a(?=[.:#[,\s]|$)|\blink\b/i],
  ['heading', /\bh[1-6]\b|\bheading\b|\btitle\b/i],
];

const COLOR_TOKEN_RE = /(#[0-9a-f]{3,8}\b|rgba?\([^)]*\)|hsla?\([^)]*\))/gi;

// A selector part that only applies in an interaction state: `a:hover`,
// `.button:focus`, `input:checked`, placeholders. Its color is what the page
// turns into, not what it shows; Fiklon's yellow was "nav" only through
// `nav#nav a:hover`.
const STATE_PSEUDO_RE = /:(?:hover|focus|focus-visible|focus-within|active|checked|visited|disabled|placeholder-shown)\b|::?(?:-[\w-]+-)?placeholder|::selection/i;
const PSEUDO_ELEMENT_RE = /::?(?:before|after|marker|first-letter|first-line)\b/gi;
const BLOCK_TAGS = new Set(['section', 'div', 'article', 'aside', 'main', 'header', 'footer', 'body', 'li']);
// Contexts read off the elements a rule matched, for utility classes whose
// names say nothing (`.color-2` on thirteen h3 titles is a heading color).
const TAG_CONTEXTS = [
  ['link', /^a$/],
  ['heading', /^h[1-6]$/],
  ['button', /^button$/],
];

// A fully transparent stop (`rgba(255, 206, 0, 0)`) is no color on screen.
const isTransparentToken = (t) => /^(?:rgba|hsla)\(.*[,/]\s*0(?:\.0+)?%?\s*\)$/i.test(t.trim());

// How many elements of the fetched page a selector part matches, with the
// tag names it hit. Pseudo-elements count their host element (a
// `li::before` bullet paints once per li). Universal and root selectors
// (`*`, `:root`, `html`) carry variables and defaults, not a painted
// surface, so they count nothing. Parts the parser cannot read count
// nothing rather than guessing.
function elementCounter(html) {
  const root = parseHtml(html.replace(/<script\b[\s\S]*?<\/script>/gi, ''));
  const cache = new Map();
  return (part) => {
    if (cache.has(part)) return cache.get(part);
    let res = { n: 0, tags: new Set() };
    const sel = part.replace(PSEUDO_ELEMENT_RE, '').trim();
    if (sel && !/^(\*|:root|html)$/i.test(sel)) {
      let els = null;
      try {
        els = root.querySelectorAll(sel);
      } catch {
        els = null;
      }
      if (els) res = { n: els.length, tags: new Set(els.map((e) => e.tagName?.toLowerCase()).filter(Boolean)) };
    }
    cache.set(part, res);
    return res;
  };
}

// Colors painted by inline <svg> markup outside the header/nav: partner and
// customer logos, illustrations. Attribute and inline-style values only.
function inlineSvgBodyColors(html) {
  const withoutHeader = html.replace(/<(header|nav)\b[\s\S]*?<\/\1>/gi, ' ');
  const set = new Set();
  for (const m of withoutHeader.matchAll(/<svg\b[\s\S]*?<\/svg>/gi)) {
    for (const am of m[0].matchAll(/\b(?:fill|stroke|stop-color|color|style)\s*=\s*["']([^"']*)["']/gi)) {
      for (const cm of am[1].matchAll(COLOR_TOKEN_RE)) {
        const c = parseColor(cm[1]);
        if (c) set.add(hexOf(c));
      }
    }
  }
  return set;
}

// ctx.pageIndex: class/id index of the fetched HTML, or null when the page
// is a JS shell (then every rule counts as on-page). ctx.svgBodyColors: the
// set from inlineSvgBodyColors(). ctx.countElements: elementCounter() over
// the page, or null for a JS shell (then elements is null and the ranking
// falls back to occurrences).
function extractColors(css, rules = parseRules(css), ctx = {}) {
  const props = customProps(css);
  const pageIndex = ctx.pageIndex || null;
  const svgBodyColors = ctx.svgBodyColors || new Set();
  const countElements = ctx.countElements || null;

  const byHex = new Map();
  const entryFor = (hexVal) => {
    let entry = byHex.get(hexVal);
    if (!entry) {
      entry = {
        occurrences: 0,
        contexts: new Set(),
        variables: new Set(),
        brandContextHits: 0,
        ownLiteralHits: 0,
        ownPageLiteralHits: 0,
        vendorSelectorHits: 0,
        pageHits: 0,
        elements: 0,
        stateContexts: new Set(),
      };
      byHex.set(hexVal, entry);
    }
    return entry;
  };

  for (const [name, value] of props) {
    const c = parseColor(value);
    if (!c) continue;
    const entry = entryFor(hexOf(c));
    entry.occurrences++;
    entry.variables.add(name);
  }

  for (const rule of rules) {
    const parts = selectorParts(rule.selector);
    if (!parts.length) continue;
    const vendorSelector = parts.every((p) => VENDOR_SELECTOR_RE.test(p));
    // Every part targets an SVG shape: the rule colors an icon or an inline
    // logo. Its button/nav context would be a lie (the icon inside a
    // "Sign in with ChatGPT" button is not the button's color).
    const svgTarget = parts.every((p) => {
      const comps = compoundsOf(p);
      const { tag } = parseCompound(comps[comps.length - 1] || '');
      return tag && SVG_TAGS.has(tag);
    });
    const onPage = parts.some((p) => partMatchesPage(p, pageIndex));
    // Interaction states (`a:hover`) and rules for markup this page does not
    // render say where a color COULD appear; their contexts go to
    // stateContexts or nowhere, so `contexts` only names places the page
    // shows the color.
    const stateRule = parts.every((p) => STATE_PSEUDO_RE.test(p));
    let contexts = vendorSelector ? [] : CONTEXT_TESTS.filter(([, re]) => re.test(rule.selector)).map(([n]) => n);
    if (svgTarget && !vendorSelector) {
      contexts = contexts.includes('header') ? ['header'] : ['inline-svg-body'];
    }
    // Elements the rule paints on this page, interaction states left out.
    let ruleElements = 0;
    const ruleTags = new Set();
    if (countElements && !vendorSelector) {
      for (const part of parts) {
        if (STATE_PSEUDO_RE.test(part)) continue;
        const { n, tags } = countElements(part);
        ruleElements += n;
        for (const t of tags) ruleTags.add(t);
      }
    }
    // With markup to count against, a rule that paints no element shows
    // nothing: `.type-2.button` names a class pair no element carries, even
    // though each class occurs somewhere on the page.
    const rendered = countElements ? ruleElements > 0 : !pageIndex || onPage;
    const shownContexts = stateRule || !rendered ? [] : contexts;
    const addContexts = (entry, prop) => {
      if (stateRule) for (const k of contexts) entry.stateContexts.add(k);
      for (const k of shownContexts) entry.contexts.add(k);
      if (!stateRule && ruleElements > 0 && !svgTarget) {
        for (const [k, re] of TAG_CONTEXTS) {
          // An <a class="button"> is a button, not a text link.
          if (k === 'link' && contexts.includes('button')) continue;
          if ([...ruleTags].some((t) => re.test(t))) entry.contexts.add(k);
        }
      }
      // A background on a section or block on this page, outside a button:
      // the color is a surface the reader sees as an area.
      if (/^background(-color)?$/.test(prop) && ruleElements > 0 && !contexts.includes('button') && [...ruleTags].some((t) => BLOCK_TAGS.has(t))) {
        entry.contexts.add('surface');
      }
    };
    for (const decl of rule.body.split(';')) {
      const colon = decl.indexOf(':');
      if (colon < 0) continue;
      const prop = decl.slice(0, colon).trim().toLowerCase();
      const isVarDecl = prop.startsWith('--');
      const value = decl.slice(colon + 1);
      // `background: var(--wp--preset--color--primary)` on a button: the
      // variable's color gets the rule's context and its elements (no extra
      // occurrence; the count stays "places the hex is written").
      if (!isVarDecl && /var\(/.test(value) && !vendorSelector) {
        const c = parseColor(resolveVarChain(value.trim(), props));
        const entry = c && byHex.get(hexOf(c));
        if (entry) {
          addContexts(entry, prop);
          entry.elements += ruleElements;
        }
      }
      for (const cm of value.matchAll(COLOR_TOKEN_RE)) {
        const c = parseColor(cm[1]);
        if (!c) continue;
        const entry = entryFor(hexOf(c));
        entry.occurrences++;
        if (isTransparentToken(cm[1])) continue;
        addContexts(entry, prop);
        if (!isVarDecl) entry.elements += ruleElements;
        if (!vendorSelector && contexts.some((k) => BRAND_RESCUE_CONTEXTS.has(k))) entry.brandContextHits++;
        if (vendorSelector) entry.vendorSelectorHits++;
        else if (!isVarDecl) {
          entry.ownLiteralHits++;
          if (onPage) entry.ownPageLiteralHits++;
        }
        if (onPage && !vendorSelector) entry.pageHits++;
      }
    }
  }

  const out = [];
  for (const [hexVal, entry] of byHex) {
    const rgb = parseColor(hexVal);
    const { s, l } = hslOf(rgb);
    // HSL saturation alone calls a near-black with a faint hue (#141319)
    // saturated; the chroma it can actually show is s * (1 - |2l - 1|).
    const chroma = s * (1 - Math.abs(2 * l - 1));
    const neutral = s < 0.12 || l > 0.95 || l < 0.06 || chroma < 0.05;
    const variables = [...entry.variables];
    if (svgBodyColors.has(hexVal)) entry.contexts.add('inline-svg-body');
    // A color whose ONLY variable name(s) are vendor-prefixed reads as a
    // widget/plugin color — UNLESS it also shows up, unnamed, directly on
    // >=3 brand surfaces (button/nav/header), which means it's the site's
    // real accent and the vendor variable is incidental (seen on a Tailwind SaaS site:
    // the real accent was only ever named via --tw-ring-color).
    const isDefaultKit = (n) => ELEMENTOR_DEFAULT_KIT[n.toLowerCase()] === hexVal;
    const vendorOnly = variables.length > 0 && variables.every((n) => isVendorVar(n) || isDefaultKit(n));
    const rescued = vendorOnly && entry.brandContextHits >= 3;
    // No variable names it, and every literal use this page can render sits
    // under admin-bar or cookie-banner selectors: somebody else's chrome.
    // (Kestrel: #2c3338 is the WP admin bar plus one 404-plugin card that is
    // not on the page.)
    const selectorVendor = variables.length === 0 && entry.vendorSelectorHits > 0 && entry.ownPageLiteralHits === 0;
    const vendor = (vendorOnly && !rescued) || selectorVendor;
    const entryOut = {
      hex: hexVal,
      occurrences: entry.occurrences,
      saturated: !neutral,
      lightness: Math.round(l * 1000) / 1000,
      contexts: [...entry.contexts],
      variables,
      vendor,
      neutral,
      // How many uses sit in rules whose classes/ids occur in the fetched
      // HTML. 0 means the stylesheet carries the color for some other page
      // or a component this page does not render.
      pageHits: entry.pageHits,
      onPage: pageIndex ? entry.pageHits > 0 : null,
      // Elements of this page the color paints, interaction states left
      // out; var() uses count toward the color the variable resolves to.
      // The ranking key: occurrences counts how often the hex is WRITTEN,
      // and a stylesheet full of hover states and unused utility classes
      // writes a CTA yellow 34 times that the page shows on 4 buttons.
      elements: countElements ? entry.elements : null,
    };
    if (entry.stateContexts.size) entryOut.stateContexts = [...entry.stateContexts];
    if (vendor) entryOut.vendorReason = selectorVendor ? 'selector' : variables.every(isDefaultKit) ? 'builder-default' : 'variable';
    if (rescued) entryOut.vendorVariables = variables;
    out.push(entryOut);
  }
  const onPageRank = (c) => (c.onPage === false ? 1 : 0);
  out.sort(
    (a, b) =>
      Number(b.saturated) - Number(a.saturated) ||
      onPageRank(a) - onPageRank(b) ||
      (b.elements ?? 0) - (a.elements ?? 0) ||
      b.occurrences - a.occurrences
  );
  return out;
}

// ---------------------------------------------------------------------------
// fonts
// ---------------------------------------------------------------------------

function resolveVarChain(value, props, depth = 0) {
  if (!value || depth > 5) return value;
  const m = value.match(/var\(\s*(--[\w-]+)\s*(?:,([^)]+))?\)/);
  if (!m) return value;
  const [, varName, fallback] = m;
  if (props.has(varName)) return resolveVarChain(value.replace(m[0], props.get(varName)), props, depth + 1);
  if (fallback) return resolveVarChain(value.replace(m[0], fallback.trim()), props, depth + 1);
  return value;
}

function firstFamily(value) {
  if (!value) return null;
  const f = value.split(',')[0].replace(/["']/g, '').trim();
  return f || null;
}

const FONT_WEIGHT_KEYWORDS = { bold: 700, normal: 400, light: 300 };

function normalizeFontWeight(raw) {
  const s = String(raw).trim().toLowerCase();
  if (s in FONT_WEIGHT_KEYWORDS) return FONT_WEIGHT_KEYWORDS[s];
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

// A selector (or comma-separated selector list) counts as "bare" when
// EVERY part is a plain element name with no class/id/attribute/pseudo/
// combinator — "h1", "h1, h2, h3", "h1,h2", "body" all qualify; ".hero h2"
// and ".page-header h1" do not. Used to split fonts.weights into what a
// document should use (base) vs. what's a banner/hero override (contextual).
function isBareElementSelectorList(selector) {
  const parts = selector.split(',').map((p) => p.trim()).filter(Boolean);
  return parts.length > 0 && parts.every((p) => /^[a-z][a-z0-9]*$/i.test(p));
}

function selectorListIncludesTag(selector, tag) {
  return selector
    .split(',')
    .map((p) => p.trim())
    .some((p) => new RegExp(`^${tag}$`, 'i').test(p));
}

// fonts.weights: font-weight values seen on rules whose selector names a
// heading/display role, plus whatever the plain body rule declares.
// Deduplicated, numeric, keyword-normalized (bold/normal/light).
//
// fonts.weights.base / fonts.weights.contextual split the h1/h2 values by
// selector shape: base comes ONLY from bare element selectors or element
// lists ("h1", "h1, h2, h3", "h1,h2", "body") — what a document should
// actually set. contextual comes from selectors carrying a class or id
// ((".page-header h1", ".hero h2") — banners and hero blocks, not the
// document's real heading weight.
function extractFontWeights(css) {
  const collect = (selectorTest) => {
    const set = new Set();
    for (const m of css.matchAll(/([^{}]{0,300})\{([^{}]*)\}/g)) {
      if (!selectorTest(m[1])) continue;
      for (const wm of m[2].matchAll(/font-weight\s*:\s*([^;]+)/gi)) {
        const w = normalizeFontWeight(wm[1]);
        if (w != null) set.add(w);
      }
    }
    return set;
  };
  const sorted = (set) => [...set].sort((a, b) => a - b);
  const bodySet = collect((s) => /\bbody\b/i.test(s));

  const baseFor = (tag) =>
    sorted(collect((s) => isBareElementSelectorList(s) && selectorListIncludesTag(s, tag)));
  const contextualFor = (tag) =>
    sorted(collect((s) => !isBareElementSelectorList(s) && new RegExp(`\\b${tag}\\b`, 'i').test(s)));
  const baseBodySet = collect((s) => isBareElementSelectorList(s) && selectorListIncludesTag(s, 'body'));

  return {
    body: bodySet.size ? sorted(bodySet)[0] : null,
    h1: sorted(collect((s) => /\bh1\b/i.test(s))),
    h2: sorted(collect((s) => /\bh2\b/i.test(s))),
    display: sorted(collect((s) => /\.page-header\b|\.hero\b/i.test(s))),
    base: {
      h1: baseFor('h1'),
      h2: baseFor('h2'),
      body: baseBodySet.size ? sorted(baseBodySet)[0] : null,
    },
    contextual: {
      h1: contextualFor('h1'),
      h2: contextualFor('h2'),
    },
  };
}

// Family names requested from Google Fonts in <link> tags or CSS @import,
// every `family=` parameter of every URL (css2 repeats the parameter; the
// v1 API joins families with `|`).
function googleFontFamilies(text) {
  const out = new Set();
  for (const m of text.matchAll(/fonts\.googleapis\.com\/css2?\?([^"'\s)]+)/gi)) {
    const query = decodeEntities(m[1]);
    for (const fm of query.matchAll(/(?:^|&)family=([^&]+)/gi)) {
      let value;
      try {
        value = decodeURIComponent(fm[1]);
      } catch {
        value = fm[1];
      }
      for (const fam of value.split('|')) {
        const name = fam.split(':')[0].replace(/\+/g, ' ').trim();
        if (name) out.add(name);
      }
    }
  }
  return [...out];
}

// Fontshare CSS API links: `api.fontshare.com/v2/css?f[]=clash-grotesk@400`
// -> "Clash Grotesk".
function fontshareFamilies(html) {
  const out = new Set();
  for (const m of html.matchAll(/api\.fontshare\.com\/[^"'\s]*/gi)) {
    let url = m[0];
    try {
      url = decodeURIComponent(url);
    } catch {
      /* keep raw */
    }
    for (const fm of url.matchAll(/f\[\]=([a-z0-9-]+)/gi)) {
      out.add(fm[1].split('-').map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' '));
    }
  }
  return [...out];
}

// Where a family's files come from, per @font-face src: fonts.gstatic.com
// -> google-fonts, fontshare -> fontshare, Adobe (typekit) -> adobe-fonts,
// anything else -> self-hosted.
function fontFaceSources(css) {
  const map = new Map();
  for (const m of css.matchAll(/@font-face\s*\{([^}]*)\}/gi)) {
    const fam = (declValue(m[1], 'font-family') || '').replace(/["']/g, '').trim();
    if (!fam) continue;
    const src = (m[1].match(/\bsrc\s*:([^}]*)/i) || [])[1] || '';
    const kind = /fonts\.gstatic\.com/i.test(src)
      ? 'google-fonts'
      : /fontshare\.com/i.test(src)
        ? 'fontshare'
        : /typekit\.net/i.test(src)
          ? 'adobe-fonts'
          : 'self-hosted';
    const key = fam.toLowerCase();
    if (!map.has(key) || map.get(key) === 'self-hosted') map.set(key, kind);
  }
  return map;
}

const INHERIT_RE = /^(inherit|initial|unset|revert|revert-layer)$/i;

// The last compound of some part of the selector targets one of `tags`.
function partTargetsTag(part, tags) {
  const comps = compoundsOf(part);
  const last = parseCompound(comps[comps.length - 1] || '');
  return !last.pseudo && last.tag && tags.includes(last.tag);
}

// For each element of `tag`, the last rule (source order) matched through
// its own classes that declares `prop`; then the most common resulting
// value across elements. Returns { value, selector, elements } or null.
function resolveThroughElementClasses(rules, html, tag, prop, valueOf) {
  const tally = new Map();
  for (const classes of elementClassLists(html, tag)) {
    let hit = null;
    for (const r of rulesForElementClasses(rules, classes, tag)) {
      const raw = declValue(r.body, prop);
      const v = raw == null ? null : valueOf(raw);
      if (v != null) hit = { value: v, selector: r.selector };
    }
    if (!hit) continue;
    const key = String(hit.value);
    const t = tally.get(key) || { ...hit, elements: 0 };
    t.elements++;
    tally.set(key, t);
  }
  let best = null;
  for (const t of tally.values()) if (!best || t.elements > best.elements) best = t;
  return best;
}

// fonts.weights.resolved.h1/h2: one weight per heading level, with where it
// came from. base-rule = last bare `h1`/`h2` rule with a font-weight;
// class = the classes the page puts on its h1/h2 elements (Tailwind
// `.bold`, `.font-semibold`); ua-default = nothing declared, so browsers
// render 700.
function resolveHeadingWeight(rules, props, html, tag) {
  let base = null;
  for (const r of rules) {
    if (!isBareElementSelectorList(r.selector) || !selectorListIncludesTag(r.selector, tag)) continue;
    const raw = declValue(r.body, 'font-weight');
    const w = raw == null ? null : normalizeFontWeight(resolveVarChain(raw, props));
    if (w != null) base = { value: w, source: 'base-rule', selector: r.selector };
  }
  if (base) return base;
  const viaClass = resolveThroughElementClasses(rules, html, tag, 'font-weight', (raw) =>
    normalizeFontWeight(resolveVarChain(raw, props))
  );
  if (viaClass) return { value: viaClass.value, source: 'class', selector: viaClass.selector };
  return { value: 700, source: 'ua-default', selector: null };
}

function extractFonts(css, html, rules = parseRules(css), ctx = {}) {
  const props = customProps(css);
  const pageIndex = ctx.pageIndex || null;

  const googleFonts = [...new Set([...googleFontFamilies(html), ...googleFontFamilies(css)])];
  const fontshare = fontshareFamilies(html);
  const faceSources = fontFaceSources(css);
  const googleLower = new Set(googleFonts.map((f) => f.toLowerCase()));
  const fontshareLower = new Set(fontshare.map((f) => f.toLowerCase()));
  const fontSourceOf = (family) => {
    if (!family) return 'none';
    const key = family.toLowerCase();
    if (googleLower.has(key)) return 'google-fonts';
    if (faceSources.has(key)) return faceSources.get(key);
    if (fontshareLower.has(key)) return 'fontshare';
    return 'none';
  };

  const famCounts = new Map();
  for (const m of css.matchAll(/font-family\s*:\s*([^;}]+)/gi)) {
    const resolved = resolveVarChain(m[1].trim(), props);
    const f = firstFamily(resolved);
    if (f && !INHERIT_RE.test(f)) famCounts.set(f, (famCounts.get(f) || 0) + 1);
  }
  // Icon fonts go last and carry icon: true. They are glyph sets and never
  // a candidate for body or heading text, however often they occur.
  const families = [...famCounts]
    .map(([family, occurrences]) => ({ family, occurrences, icon: isIconFont(family), fontSource: fontSourceOf(family) }))
    .sort((a, b) => Number(a.icon) - Number(b.icon) || b.occurrences - a.occurrences);

  const allFaces = [
    ...new Set(
      [...css.matchAll(/@font-face\s*\{[^}]*font-family\s*:\s*["']?([^;"'}]+)/gi)].map((m) => m[1].trim())
    ),
  ];
  const faces = allFaces.filter((f) => !isIconFont(f));
  const iconFaces = allFaces.filter((f) => isIconFont(f));

  const buildRule = (raw, extra) => {
    if (raw == null) return null;
    raw = raw.replace(/!important/i, '').trim();
    const resolved = resolveVarChain(raw, props);
    const family = firstFamily(resolved);
    return {
      raw,
      resolved,
      family,
      generic: family ? GENERIC_FONT_RE.test(family) : true,
      fontSource: family && !GENERIC_FONT_RE.test(family) ? fontSourceOf(family) : 'none',
      ...extra,
    };
  };

  // Body: the plain html/body rule, overridden by a rule on the classes the
  // <body> element carries (Elementor's `.elementor-kit-N`, Tailwind's
  // `.font-body`), which wins the cascade on specificity.
  const bodyMatch = css.match(/(?:^|[}\s,])(?:html|body)(?:\.[\w-]+)?\s*(?:,[^{]*)?\{[^}]*font-family\s*:\s*([^;}]+)/i);
  const bodyTagRule = bodyMatch ? buildRule(bodyMatch[1], { origin: 'body-rule' }) : null;
  const bodyClasses = elementClassLists(html, 'body')[0] || [];
  let bodyClassRule = null;
  for (const r of rulesForElementClasses(rules, bodyClasses, 'body')) {
    const v = declValue(r.body, 'font-family');
    if (v && !INHERIT_RE.test(v)) bodyClassRule = buildRule(v, { origin: 'body-class', selector: r.selector });
  }
  let bodyRule = bodyTagRule;
  if (bodyClassRule && !isIconFont(bodyClassRule.family)) {
    bodyRule = bodyTagRule && bodyTagRule.family !== bodyClassRule.family ? { ...bodyClassRule, tagRule: bodyTagRule } : bodyClassRule;
  }

  // Heading: (1) a bare h1/h2 rule, (2) any h1/h2 rule whose classes occur
  // on the page, (3) the classes the page puts on its h1/h2 elements
  // (Tailwind `.font-heading`), (4) an explicit `inherit` resolves to the
  // body family. Rules that say inherit are skipped in (1) and (2).
  const usable = (v) => {
    if (!v) return false;
    const fam = firstFamily(resolveVarChain(v, props));
    return fam && !INHERIT_RE.test(fam) && !isIconFont(fam);
  };
  let headingRule = null;
  let sawInherit = false;
  const headingRules = rules.filter((r) => declValue(r.body, 'font-family') != null);
  for (const r of headingRules) {
    if (!isBareElementSelectorList(r.selector)) continue;
    if (!selectorListIncludesTag(r.selector, 'h1') && !selectorListIncludesTag(r.selector, 'h2')) continue;
    const v = declValue(r.body, 'font-family');
    if (usable(v)) {
      headingRule = buildRule(v, { origin: 'h1-h2-rule', selector: r.selector });
      break;
    }
    sawInherit = true;
  }
  if (!headingRule) {
    for (const r of headingRules) {
      const parts = selectorParts(r.selector).filter(
        (p) => partTargetsTag(p, ['h1', 'h2']) && partMatchesPage(p, pageIndex)
      );
      if (!parts.length || isBareElementSelectorList(r.selector)) continue;
      const v = declValue(r.body, 'font-family');
      if (usable(v)) {
        headingRule = buildRule(v, { origin: 'h1-h2-rule', selector: r.selector });
        break;
      }
      sawInherit = true;
    }
  }
  if (!headingRule) {
    const viaClass =
      resolveThroughElementClasses(rules, html, 'h1', 'font-family', (raw) => (usable(raw) ? raw.trim() : null)) ||
      resolveThroughElementClasses(rules, html, 'h2', 'font-family', (raw) => (usable(raw) ? raw.trim() : null));
    if (viaClass) headingRule = buildRule(viaClass.value, { origin: 'class', selector: viaClass.selector });
  }
  if (!headingRule && sawInherit && bodyRule) {
    headingRule = { ...bodyRule, origin: 'inherit-body', selector: null };
    delete headingRule.tagRule;
  }

  const weights = extractFontWeights(css);
  weights.resolved = {
    h1: resolveHeadingWeight(rules, props, html, 'h1'),
    h2: resolveHeadingWeight(rules, props, html, 'h2'),
  };

  return {
    faces,
    iconFaces,
    googleFonts,
    fontshare,
    bodyRule,
    headingRule,
    families,
    weights,
  };
}

// ---------------------------------------------------------------------------
// page.bodyTextColor
// ---------------------------------------------------------------------------

// Selector part that styles the root element or <body> itself: `body`,
// `html`, `:root`, `html body`, or those qualified by classes the element
// actually carries (`body.home`). Paragraph and block rules never count:
// a `p` inside a dark hero band is not the page's text color.
function rootElementOf(part, classesByTag) {
  const comps = compoundsOf(part);
  if (!comps.length) return null;
  const parsed = comps.map((c) => ({ raw: c, ...parseCompound(c) }));
  const tagOf = (p) => (p.raw.trim().toLowerCase() === ':root' ? 'html' : p.tag);
  for (let i = 0; i < parsed.length; i++) {
    const p = parsed[i];
    const tag = tagOf(p);
    if (tag !== 'html' && tag !== 'body') return null;
    if (p.raw.trim().toLowerCase() !== ':root' && p.pseudo) return null;
    if (p.ids.length) return null;
    const have = classesByTag[tag] || [];
    if (p.classes.some((k) => !have.includes(k))) return null;
    if (i < parsed.length - 1 && tag !== 'html') return null;
  }
  return tagOf(parsed[parsed.length - 1]);
}

function colorFromValue(raw, props, { firstToken = false } = {}) {
  if (!raw) return null;
  const resolved = resolveVarChain(raw, props);
  if (/^(transparent|none|inherit|initial|unset|currentcolor)$/i.test(resolved.trim())) return null;
  let c = parseColor(resolved);
  if (!c && firstToken) {
    const tok = resolved.match(COLOR_TOKEN_RE);
    if (tok) c = parseColor(tok[0]);
  }
  if (!c) return null;
  // An alpha-0 color (rgba(0,0,0,0)) is no color.
  const alpha = resolved.match(/rgba?\([^)]*[,/]\s*(0(?:\.0+)?)\s*\)/i);
  if (alpha) return null;
  return hexOf(c);
}

// page.bodyTextColor / page.pageBackground / page.siteIsDark.
//
// Both colors come from the element itself, in cascade order: a rule on
// the classes <body> carries (Tailwind `.text-body`, `.bg-white`) beats a
// `body` rule, which beats an inherited `html` / `:root` rule; within a
// tier the later rule wins. When the text is light (lightness > 0.8) the
// site is dark: bodyTextColor.value is null with a reason, because white
// text is never a document's ink.
function extractPageColors(rules, props, html) {
  const classesByTag = {
    body: elementClassLists(html, 'body')[0] || [],
    html: elementClassLists(html, 'html')[0] || [],
  };
  const bodyClassRules = new Set(rulesForElementClasses(rules, classesByTag.body, 'body'));

  const find = (pick) => {
    const tiers = { 'body-class': null, body: null, html: null };
    for (const r of rules) {
      let tier = null;
      if (bodyClassRules.has(r)) tier = 'body-class';
      else {
        for (const part of selectorParts(r.selector)) {
          const el = rootElementOf(part, classesByTag);
          if (el === 'body') {
            tier = 'body';
            break;
          }
          if (el === 'html') tier = 'html';
        }
      }
      if (!tier) continue;
      const v = pick(r.body);
      if (v) tiers[tier] = { value: v, source: tier, selector: r.selector };
    }
    return tiers['body-class'] || tiers.body || tiers.html || null;
  };

  const text = find((body) => colorFromValue(declValue(body, 'color'), props));
  const background = find(
    (body) =>
      colorFromValue(declValue(body, 'background-color'), props) ||
      colorFromValue(declValue(body, 'background'), props, { firstToken: true })
  );

  const lightnessOf = (hexVal) => hslOf(parseColor(hexVal)).l;
  const textLight = text ? lightnessOf(text.value) > 0.8 : false;
  const bgDark = background ? lightnessOf(background.value) < 0.5 : null;

  // Dark means light text on a dark (or unknown) ground. A dark body
  // background under dark text is a frame around white content panels
  // (arkona), not a dark site.
  const siteIsDark = text ? textLight && bgDark !== false : null;

  let bodyTextColor;
  if (!text) {
    bodyTextColor = { value: null, source: null };
  } else if (textLight) {
    bodyTextColor = {
      value: null,
      source: text.source,
      observed: text.value,
      reason: background && !bgDark ? 'light-text' : 'site-is-dark',
    };
  } else {
    bodyTextColor = { value: text.value, source: text.source };
  }
  return {
    bodyTextColor,
    pageBackground: background ? { value: background.value, source: background.source } : { value: null, source: null },
    siteIsDark,
  };
}

// ---------------------------------------------------------------------------
// page.nameForms
// ---------------------------------------------------------------------------

// "text after © / (c) up to the first './,'/year": strips a leading year
// right after the mark (the common "© 2026 Acme Corp" order) and stops the
// captured text at whichever comes first — a period, a comma, or a
// trailing 4-digit year ("(c) Acme Corp 2026").
function extractCopyrightName(text) {
  const m = text.match(/(?:©|\(c\))\s*(?:\d{4}\s*)?([^\n]*?)(?=[.,]|\s\d{4}\b|$)/i);
  if (!m) return null;
  // "© 2026 Markloop Built with Framekit": the builder credit is not a name
  // form, and leaving it in makes teach ask which name to use.
  const val = m[1]
    .replace(/\s+/g, ' ')
    .replace(/\s*[|·–-]?\s*(?:built|made|powered|designed|created)\s+(?:with|by)\b.*$/i, '')
    .trim();
  return val || null;
}

// "text before ' | ' / ' – ' / ' - ' in <title>": only the segment before
// the FIRST such delimiter, and only when it reads like a brand name
// rather than a broken CMS title — skipped when the (already tag-stripped)
// title still carries a stray '(' or the literal `add_theme_support` (both
// symptoms of a broken title-tag theme function leaking into the string),
// or when the title is implausibly long.
function extractTitlePrefix(title) {
  if (!title) return null;
  if (title.includes('(') || title.includes('add_theme_support') || title.length > 120) return null;
  const m = title.match(/^(.*?)\s(?:\||–|-)\s/);
  if (!m) return null;
  const prefix = m[1].trim();
  if (!prefix || prefix.length > 40) return null;
  return prefix;
}

// A name form longer than this, or one that looks like code or JSON, is a
// scraping accident (an inline script caught by the copyright regex), not
// a way anybody writes the company's name.
const MAX_NAME_FORM_CHARS = 60;
const looksLikeCode = (v) => /[{}<>[\]]|":|=>|\bfunction\s*\(|;\s*[\w-]+\s*[:=]/.test(v);

// A legal form at the end of a name ("Vantora Labs Inc", "Arkona Supply Sp. z
// o.o.") belongs on an invoice, not in a document header. It is cut off into
// `legalName`, so the form offered as the name is the one people say.
const LEGAL_FORM_RE = /,?\s+(?:Inc\.?|INC\.?|LLC|L\.L\.C\.|Ltd\.?|LTD\.?|GmbH|S\.\s?A\.|[Ss]p\.\s?z\s?o\.\s?o\.|[Ss]p\.\s?[jJ]\.|AG)$/;
// "kestrel.example" is an address, not a name anybody puts on a
// document; it is offered only when nothing else was found.
const DOMAIN_RE = /^(?:https?:\/\/)?(?:www\.)?[a-z0-9-]+(?:\.[a-z0-9-]+)*\.[a-z]{2,}\/?$/i;

// Case-insensitive dedupe by value, keeping first-seen order/casing/source.
// Values are entity-decoded first (`Mroomy&#174; &#8211; ...`), and code or
// overlong values are dropped. A legal form is split off into `legalName`,
// and bare domains go when any other form exists.
function dedupeNameForms(list) {
  const seen = new Map();
  const out = [];
  for (const c of list) {
    if (!c || !c.value) continue;
    const full = decodeEntities(c.value).replace(/\s+/g, ' ').trim();
    if (!full || full.length > MAX_NAME_FORM_CHARS || looksLikeCode(full)) continue;
    const short = full.replace(LEGAL_FORM_RE, '').trim();
    const value = short || full;
    const legalName = c.legalName || (value !== full ? full : null);
    const key = value.toLowerCase();
    if (seen.has(key)) {
      const prev = seen.get(key);
      if (!prev.legalName && legalName) prev.legalName = legalName;
      continue;
    }
    const entry = { value, source: c.source, ...(legalName ? { legalName } : {}) };
    seen.set(key, entry);
    out.push(entry);
  }
  const named = out.filter((c) => !DOMAIN_RE.test(c.value));
  return named.length ? named : out;
}

// ---------------------------------------------------------------------------
// page
// ---------------------------------------------------------------------------

function extractPage(html, rules, props) {
  const head = html.slice(0, 300_000);
  const lang = (head.match(/<html[^>]*\blang=["']([^"']+)["']/i) || [])[1] || null;
  const titleRaw = (head.match(/<title[^>]*>([\s\S]*?)<\/title>/i) || [])[1];
  const title = titleRaw ? stripTags(titleRaw).slice(0, 200) || null : null;
  const h1Raw = (html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i) || [])[1];
  const h1 = h1Raw ? stripTags(h1Raw).slice(0, 200) || null : null;
  const h2 = [...html.matchAll(/<h2[^>]*>([\s\S]*?)<\/h2>/gi)]
    .map((m) => stripTags(m[1]))
    .filter(Boolean)
    .slice(0, 20);

  const paragraphs = [];
  for (const m of html.matchAll(/<p[^>]*>([\s\S]*?)<\/p>/gi)) {
    const text = stripTags(m[1]);
    if (text.length >= 40) paragraphs.push(text.slice(0, 300));
    if (paragraphs.length >= 3) break;
  }

  const textChars = stripTags(html.replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/gi, '')).length;

  const ogSiteName =
    (head.match(/property=["']og:site_name["'][^>]*content=["']([^"']+)/i) ||
      head.match(/content=["']([^"']+)["'][^>]*property=["']og:site_name["']/i) ||
      [])[1] || null;
  const footerMatch = html.match(/<footer[\s\S]*?<\/footer>/i);
  const footerText = footerMatch ? visibleText(footerMatch[0]) : '';
  const footerCopyrightName = footerText ? extractCopyrightName(footerText) : null;
  // A copyright line found outside <footer> (or when there is no <footer>
  // at all) is weaker evidence of "this is the footer's brand name" than
  // one actually inside the footer, so it gets its own source label.
  const globalCopyrightName = footerCopyrightName ? null : extractCopyrightName(visibleText(html));
  const titlePrefix = extractTitlePrefix(title);

  const { bodyTextColor, pageBackground, siteIsDark } = extractPageColors(rules, props, html);

  // Name forms read from TEXT only — never decoded from an image. logo-alt
  // is appended later, once the logo candidates (and their `strip` flag)
  // are known.
  const nameForms = dedupeNameForms([
    ogSiteName && { value: ogSiteName, source: 'og:site_name' },
    footerCopyrightName && { value: footerCopyrightName, source: 'footer' },
    globalCopyrightName && { value: globalCopyrightName, source: 'copyright-line' },
    titlePrefix && { value: titlePrefix, source: 'title-prefix' },
  ]);

  return {
    lang,
    title,
    h1,
    h2,
    paragraphs,
    textChars,
    bodyTextColor,
    pageBackground,
    siteIsDark,
    nameForms,
  };
}

function extractTells(html) {
  const head = html.slice(0, 300_000);
  const visibleText = stripTags(html.replace(/<script[\s\S]*?<\/script>/gi, ''));
  return {
    wordpress: /wp-content|wp-includes/i.test(html),
    webflow: /webflow/i.test(html),
    next: /_next\//.test(html) || /__NEXT_DATA__/.test(html),
    tailwind: /class=["'][^"']*\b(?:bg|text|px|py|flex|grid)-[\w./[\]-]+/i.test(head),
    jsShell: visibleText.length < 800,
  };
}

// ---------------------------------------------------------------------------
// logo[]
// ---------------------------------------------------------------------------

function sniffImageDimensions(buf) {
  if (!buf || buf.length < 8) return null;
  // PNG: signature then IHDR chunk (width/height at fixed offsets).
  if (buf.length >= 24 && buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47) {
    const width = buf.readUInt32BE(16);
    const height = buf.readUInt32BE(20);
    if (width && height) return { width, height };
  }
  // GIF87a/GIF89a: little-endian width/height right after the signature.
  if (buf.length >= 10 && buf.toString('ascii', 0, 3) === 'GIF') {
    const width = buf.readUInt16LE(6);
    const height = buf.readUInt16LE(8);
    if (width && height) return { width, height };
  }
  // JPEG: walk markers looking for a SOFn segment.
  if (buf.length >= 4 && buf[0] === 0xff && buf[1] === 0xd8) {
    let offset = 2;
    while (offset < buf.length - 9) {
      if (buf[offset] !== 0xff) {
        offset++;
        continue;
      }
      const marker = buf[offset + 1];
      if (marker === 0xd8 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) {
        offset += 2;
        continue;
      }
      if (marker === 0xd9) break; // EOI
      if (offset + 4 > buf.length) break;
      const segLen = buf.readUInt16BE(offset + 2);
      const isSOF = marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc;
      if (isSOF) {
        if (offset + 9 > buf.length) break;
        const height = buf.readUInt16BE(offset + 5);
        const width = buf.readUInt16BE(offset + 7);
        if (width && height) return { width, height };
        break;
      }
      offset += 2 + segLen;
    }
  }
  // SVG: text-based, look for width/height attrs or a viewBox.
  const head = buf.toString('utf8', 0, Math.min(buf.length, 4096));
  if (/<svg[\s>]/i.test(head)) {
    const wm = head.match(/\bwidth=["']?([\d.]+)/i);
    const hm = head.match(/\bheight=["']?([\d.]+)/i);
    if (wm && hm) return { width: Number(wm[1]), height: Number(hm[1]) };
    const vb = head.match(/viewBox=["']\s*[-\d.]+\s+[-\d.]+\s+([\d.]+)\s+([\d.]+)/i);
    if (vb) return { width: Number(vb[1]), height: Number(vb[2]) };
  }
  return null;
}

function locationOf(snippet, headerSlice, footerSlice) {
  if (headerSlice && headerSlice.includes(snippet)) return 'header';
  if (footerSlice && footerSlice.includes(snippet)) return 'footer';
  return 'content';
}

function newLogoCandidate(fields) {
  return {
    // The file itself. When the page loaded it through an image optimizer
    // (Next.js /_next/image?url=…), this is the original and optimizedUrl
    // is what the page requested.
    url: null,
    optimizedUrl: null,
    kind: 'img',
    location: 'content',
    alt: null,
    width: null,
    height: null,
    aspect: null,
    bytes: null,
    strip: false,
    whiteOnTransparent: null,
    // Sits inside a link to the home page (`<a href="/">` or the origin):
    // the strongest single signal that an image is the site's own logo.
    homeLink: false,
    // The file name, alt, class or id says logo/brand.
    logoWord: false,
    // The saturated colors the artwork paints with, most used first:
    // [{ hex, share }], share of the painted pixels (PNG) or of the color
    // declarations (SVG). [] when it paints only greys; null when unread.
    colors: null,
    ...fields,
  };
}

// Resolves a url(...) found INSIDE a stylesheet against that stylesheet's
// own location, not the page's — CSS relative URLs are stylesheet-relative.
function resolveCssUrl(base, href, isLocal) {
  if (!href) return null;
  if (/^https?:\/\//i.test(href)) return href;
  if (isLocal) {
    try {
      return resolvePath(base, href);
    } catch {
      return null;
    }
  }
  return absUrl(base, href);
}

// "brand" only as its own token (navbar-brand, brand.svg), not inside
// a word like "brandon.png".
// "logo" anywhere (site-logo, mainlogo.svg), except where it starts a word
// about speech therapy: Polish logopeda / logopedia / neurologopeda and
// English logopedics, which put a therapist's portrait on the logo list.
const LOGO_WORD_RE = /logo(?!ped|pæd|terap|therap)|(^|[^a-z])brand(s|mark)?([^a-z]|$)/i;
// Unnamed header images qualify as logo candidates only with logo-like
// proportions; anything under ICON_MAX_PX on its longer side is an icon
// (hamburger, close X, social glyph), never the mark.
const UNNAMED_MIN_ASPECT = 1.2;
const UNNAMED_MAX_ASPECT = 8;
const UNNAMED_MIN_WIDTH = 60;
const ICON_MAX_PX = 32;
const MAX_UNNAMED_PER_SLICE = 2;

// `href` points at the site's home page: "/", "./", "index.html", or the
// origin itself (with or without a trailing slash). Hash-only links ("#",
// "#!home") are not home links.
function isHomeHref(href, pageUrl, isLocal) {
  if (!href) return false;
  const h = attrUrl(href) || '';
  if (!h || h.startsWith('#') || /^(mailto:|tel:|javascript:)/i.test(h)) return false;
  if (/^(\/|\.\/|\.\/index\.html?|\/index\.(html?|php))$/i.test(h) || /^index\.html?$/i.test(h)) return true;
  if (isLocal) return false;
  const u = absUrl(pageUrl, h);
  if (!u) return false;
  try {
    const target = new URL(u);
    const page = new URL(pageUrl);
    return target.origin === page.origin && /^\/?(index\.(html?|php))?$/i.test(target.pathname) && !target.search;
  } catch {
    return false;
  }
}

// Opening tag + inner HTML of every <a> that links to the home page.
function homeLinkSlices(html, pageUrl, isLocal) {
  const out = [];
  for (const m of html.matchAll(/<a\b([^>]*)>([\s\S]*?)<\/a>/gi)) {
    const href = (m[1].match(/\bhref=(?:"([^"]*)"|'([^']*)'|([^\s>]+))/i) || []).slice(1).find((v) => v != null);
    if (isHomeHref(href, pageUrl, isLocal)) out.push(m[0]);
  }
  return out.join('\n');
}

// The strip of markup at the top of <body> before the first <h1>/<main>:
// the header bar on sites that build it from <div>s instead of <header>.
function topBarSlice(html) {
  const bodyStart = html.search(/<body\b/i);
  const from = bodyStart >= 0 ? bodyStart : 0;
  const rest = html.slice(from);
  const stop = rest.search(/<h1\b|<main\b/i);
  return rest.slice(0, Math.min(stop >= 0 ? stop : 30_000, 30_000));
}

// A URL read from an HTML attribute (src, srcset, href, content, a style
// url()) still carries the page's entity encoding: `?url=%2Flogo.png&amp;w=828`
// is a different request, and an image optimizer answers it with 400.
function attrUrl(raw) {
  if (raw == null) return null;
  const v = decodeEntities(String(raw)).trim();
  return v || null;
}

// srcset candidates as { url, w, x }, in source order. URLs may carry
// commas (Cloudinary transforms), so split on whitespace first, the way
// the HTML spec's parser does, not on every comma.
function parseSrcset(value) {
  const out = [];
  const s = attrUrl(value) || '';
  let i = 0;
  while (i < s.length) {
    while (i < s.length && /[\s,]/.test(s[i])) i++;
    if (i >= s.length) break;
    let j = i;
    while (j < s.length && !/\s/.test(s[j])) j++;
    let url = s.slice(i, j);
    let desc = '';
    if (/,$/.test(url)) {
      url = url.replace(/,+$/, '');
      i = j;
    } else {
      let k = j;
      while (k < s.length && s[k] !== ',') k++;
      desc = s.slice(j, k).trim();
      i = k + 1;
    }
    if (!url) continue;
    const w = Number((desc.match(/(\d+(?:\.\d+)?)w\b/) || [])[1]) || null;
    const x = Number((desc.match(/(\d+(?:\.\d+)?)x\b/) || [])[1]) || (w ? null : 1);
    out.push({ url, w, x });
  }
  return out;
}

// The original file behind an image-optimizer URL, or null when `href` is
// not one. The optimizer's URL is the wrong thing to save: it re-encodes
// the file, and Next.js answers anything but the page's own <img> request
// with 400. Patterns:
//   /_next/image?url=…   Next.js          /_vercel/image?url=…  Vercel
//   /.netlify/images?url=…  Netlify       /_image?href=…        Astro
//   any /image, /images, /img path with a url/src parameter
//   /cdn-cgi/image/<opts>/<file>  Cloudflare   /_ipx/<mods>/<file>  Nuxt
//   /image/fetch/<transforms>/<url>  Cloudinary fetch
//   i0.wp.com/<host>/<path>  Jetpack Photon
// Relative originals resolve against the optimizer URL; only http(s)
// results count.
const OPTIMIZER_PATH_RE = /\/[._]?(?:image|images|img)\/?$/i;
function originalImageUrl(href, base) {
  let u;
  try {
    u = new URL(href, base);
  } catch {
    return null;
  }
  const ok = (v) => {
    if (!v) return null;
    try {
      const r = new URL(v, u);
      return /^https?:$/.test(r.protocol) && r.href !== u.href ? r.href : null;
    } catch {
      return null;
    }
  };
  if (OPTIMIZER_PATH_RE.test(u.pathname)) {
    for (const name of ['url', 'href', 'src']) {
      const v = u.searchParams.get(name);
      if (v) return ok(v);
    }
  }
  const fetchAt = u.href.search(/\/image\/fetch\//i);
  if (fetchAt >= 0) {
    const rest = u.href.slice(fetchAt);
    const at = rest.search(/https?:\/\/?[^/]/i);
    if (at >= 0) return ok(decodeURIComponent(rest.slice(at)).replace(/^(https?:)\/(?!\/)/i, '$1//'));
  }
  const pathOpt = u.pathname.match(/^(?:.*\/)?(?:cdn-cgi\/image|_ipx)\/[^/]+\/(.+)$/i);
  if (pathOpt) {
    const rest = decodeURIComponent(pathOpt[1]);
    return ok(/^https?:\/\/?/i.test(rest) ? rest.replace(/^(https?:)\/(?!\/)/i, '$1//') : `/${rest}`);
  }
  if (/^i[0-3]\.wp\.com$/i.test(u.hostname)) {
    const rest = u.pathname.replace(/^\/+/, '');
    if (/^[a-z0-9.-]+\.[a-z]{2,}\//i.test(rest)) return ok(`https://${rest}`);
  }
  return null;
}

// Stand-in origin for unwrapping optimizer URLs in local-file mode, where
// the page has no origin: `/logo.png` there means next to the HTML file.
const LOCAL_BASE = 'http://local.invalid/';

// { url, optimizedUrl } for one attribute value: `url` is the original file
// when the page went through an image optimizer (and `optimizedUrl` what
// the page actually requested), else the value itself, absolute.
function resolveImageUrl(raw, toAbs, isLocal, pageUrl) {
  const v = attrUrl(raw);
  if (!v) return { url: null, optimizedUrl: null };
  const used = toAbs(v);
  if (/^data:/i.test(v)) return { url: used, optimizedUrl: null };
  const orig = originalImageUrl(v, isLocal || !pageUrl ? LOCAL_BASE : pageUrl);
  if (!orig) return { url: used, optimizedUrl: null };
  const url = orig.startsWith(LOCAL_BASE) ? toAbs(`.${decodeURIComponent(new URL(orig).pathname)}`) : orig;
  return url ? { url, optimizedUrl: used } : { url: used, optimizedUrl: null };
}

// The image file an <img> stands for. Lazy-loaders put a placeholder in src
// (a data: URI, or a real file such as WP Fastest Cache's blank.gif) and the
// file in a data-* attribute; when one is present it wins over src. An
// optimizer URL in src or srcset resolves to the original; only when no
// original can be derived does the largest srcset candidate beat src.
const LAZY_SRC_ATTRS = ['data-lazy-src', 'data-src', 'data-wpfc-original-src', 'data-original', 'data-lazy'];
const LAZY_SRCSET_ATTRS = ['data-lazy-srcset', 'data-srcset', 'data-wpfc-original-srcset'];
function imgSource(tag, toAbs, isLocal, pageUrl) {
  const attr = (name) => (tag.match(new RegExp(`\\s${name}=(?:"([^"]*)"|'([^']*)')`, 'i')) || []).slice(1).find((v) => v != null);
  const lazySrc = LAZY_SRC_ATTRS.map(attr).find((v) => v && !/^data:/i.test(v));
  const lazySet = LAZY_SRCSET_ATTRS.map(attr).find(Boolean);
  const src = lazySrc || attr('src') || null;
  const set = parseSrcset(lazySet || attr('srcset') || '');
  set.sort((a, b) => (b.w || 0) - (a.w || 0) || (b.x || 0) - (a.x || 0));
  const tries = [src, ...set.map((c) => c.url)].filter((v) => v && !/^data:/i.test(attrUrl(v) || ''));
  for (const t of tries) {
    const r = resolveImageUrl(t, toAbs, isLocal, pageUrl);
    if (r.optimizedUrl) return { raw: attrUrl(src) || '', ...r };
  }
  const pick = set.length && !/^data:/i.test(attrUrl(set[0].url) || '') ? set[0].url : src;
  if (!pick) return null;
  return { raw: attrUrl(src) || '', ...resolveImageUrl(pick, toAbs, isLocal, pageUrl) };
}

// iconColors[]: the colors of small same-site SVG files the page shows as
// <img> (Fiklon's green rings, nine of them, behind a lazy-load
// placeholder). CSS and inline SVG never see them. They are decoration
// evidence, never primary candidates, so they stay out of colors[].
const MAX_ICON_FILES = 10;
const MAX_ICON_BYTES = 20_000;
async function collectIconColors(html, { toAbs, isLocal, pageUrl, deadline, skip = new Set() }) {
  const uses = new Map();
  const host = pageUrl ? safeOrigin(pageUrl) : null;
  for (const m of html.matchAll(/<img\b[^>]*>/gi)) {
    const img = imgSource(m[0], toAbs, isLocal, pageUrl);
    const url = img?.url;
    if (!url || skip.has(url) || !/\.svg(?:[?#]|$)/i.test(url)) continue;
    if (!isLocal && safeOrigin(url) !== host) continue;
    uses.set(url, (uses.get(url) || 0) + 1);
  }
  const byHex = new Map();
  for (const [url, n] of [...uses].sort((a, b) => b[1] - a[1]).slice(0, MAX_ICON_FILES)) {
    let text = '';
    if (isLocal) {
      try {
        if (statSync(url).size <= MAX_ICON_BYTES) text = readFileSync(url, 'utf8');
      } catch {
        continue;
      }
    } else {
      const r = await fetchText(url, deadline);
      if (!r.ok || r.bytes > MAX_ICON_BYTES) continue;
      text = r.text;
    }
    const seen = new Set();
    for (const cm of text.matchAll(/\b(?:fill|stroke|stop-color)\s*[:=]\s*["']?\s*(#[0-9a-f]{3,8}\b|rgba?\([^)]*\)|hsla?\([^)]*\))/gi)) {
      const c = parseColor(cm[1]);
      if (!c) continue;
      const hexVal = hexOf(c);
      if (seen.has(hexVal)) continue;
      seen.add(hexVal);
      const e = byHex.get(hexVal) || { hex: hexVal, uses: 0, files: [] };
      e.uses += n;
      e.files.push(url.split(/[?#]/)[0].split('/').pop());
      byHex.set(hexVal, e);
    }
  }
  return [...byHex.values()]
    .map((e) => {
      const { r, g, b } = parseColor(e.hex);
      return { ...e, saturated: isSaturated([r, g, b]) };
    })
    .sort((a, b) => Number(b.saturated) - Number(a.saturated) || b.uses - a.uses);
}

function collectLogoCandidates(html, cssSegments, toAbs, isLocal, pageUrl) {
  const candidates = [];
  const headerSlice =
    [...html.matchAll(/<header[\s\S]*?<\/header>/gi)].map((m) => m[0]).join('\n') +
    '\n' +
    [...html.matchAll(/<nav[\s\S]*?<\/nav>/gi)].map((m) => m[0]).join('\n');
  const topSlice = topBarSlice(html);
  const footerSlice = [...html.matchAll(/<footer[\s\S]*?<\/footer>/gi)].map((m) => m[0]).join('\n');
  const homeSlice = homeLinkSlices(html, pageUrl, isLocal);

  // The first few images in the header/nav and in the top bar, whatever
  // their names: `Untitled-design-3.svg` with an empty alt is still a logo
  // when it is the first thing in the header.
  const firstImgs = new Set();
  for (const slice of [headerSlice, topSlice]) {
    let n = 0;
    for (const m of slice.matchAll(/<img\b[^>]*>/gi)) {
      if (n >= MAX_UNNAMED_PER_SLICE) break;
      firstImgs.add(m[0]);
      n++;
    }
  }

  // <img> whose src/alt/class mentions logo or brand, that sits in a home
  // link, or that is one of the first images of the header / top bar.
  for (const m of html.matchAll(/<img\b[^>]*>/gi)) {
    const tag = m[0];
    const img = imgSource(tag, toAbs, isLocal, pageUrl);
    if (!img?.url) continue;
    // The name test reads the attribute as written plus, behind an
    // optimizer, the original's file name; never the whole resolved path,
    // whose directories can say "brand" about something else.
    const src = `${img.raw} ${img.optimizedUrl ? img.url.split(/[?#]/)[0].split('/').pop() : ''}`;
    const alt = (tag.match(/\balt=["']([^"']*)["']/i) || [])[1] || null;
    const cls = (tag.match(/\bclass=["']([^"']*)["']/i) || [])[1] || '';
    const id = (tag.match(/\bid=["']([^"']*)["']/i) || [])[1] || '';
    const logoWord = LOGO_WORD_RE.test(`${src} ${alt || ''} ${cls} ${id}`);
    const homeLink = homeSlice.includes(tag);
    const early = firstImgs.has(tag);
    if (!logoWord && !homeLink && !early) continue;
    const width = Number((tag.match(/\bwidth=["']?(\d+)/i) || [])[1]) || null;
    const height = Number((tag.match(/\bheight=["']?(\d+)/i) || [])[1]) || null;
    let location = locationOf(tag, headerSlice, footerSlice);
    if (location === 'content' && (early || topSlice.includes(tag))) location = 'header';
    candidates.push(
      newLogoCandidate({
        url: img.url,
        optimizedUrl: img.optimizedUrl,
        kind: 'img',
        location,
        alt: alt ? decodeEntities(alt) : alt,
        width,
        height,
        aspect: width && height ? round(width / height) : null,
        homeLink,
        logoWord,
      })
    );
  }

  // <svg> inside header/nav (or the top bar when the page has neither).
  const svgSource = headerSlice.trim() ? headerSlice : topSlice;
  for (const m of svgSource.matchAll(/<svg\b[\s\S]*?<\/svg>/gi)) {
    const svg = m[0];
    const openTag = (svg.match(/^<svg\b[^>]*>/i) || [''])[0];
    let width = Number((openTag.match(/\bwidth=["']?([\d.]+)/i) || [])[1]) || null;
    let height = Number((openTag.match(/\bheight=["']?([\d.]+)/i) || [])[1]) || null;
    if (!width || !height) {
      const vb = openTag.match(/viewBox=["']\s*[-\d.]+\s+[-\d.]+\s+([\d.]+)\s+([\d.]+)/i);
      if (vb) {
        width = Number(vb[1]);
        height = Number(vb[2]);
      }
    }
    const label = `${openTag} ${(svg.match(/<title>([^<]*)<\/title>/i) || [])[1] || ''}`;
    const inlineCandidate = newLogoCandidate({
      url: null,
      kind: 'svg-inline',
      location: 'header',
      width: width || null,
      height: height || null,
      aspect: width && height ? round(width / height) : null,
      bytes: Buffer.byteLength(svg),
      whiteOnTransparent: detectSvgWhiteOnTransparent(svg),
      colors: svgLogoColors(svg),
      homeLink: homeSlice.includes(svg),
      logoWord: LOGO_WORD_RE.test(label),
    });
    // The markup rides along for --save-logo, but stays out of the JSON.
    Object.defineProperty(inlineCandidate, 'markup', { value: svg, enumerable: false });
    candidates.push(inlineCandidate);
  }

  // background-image via inline style on any element inside header/nav.
  for (const m of headerSlice.matchAll(/style=["'][^"']*background(?:-image)?\s*:\s*url\(([^)]+)\)[^"']*["']/gi)) {
    const raw = (attrUrl(m[1]) || '').replace(/["']/g, '').trim();
    const r = resolveImageUrl(raw, toAbs, isLocal, pageUrl);
    candidates.push(newLogoCandidate({ url: r.url, optimizedUrl: r.optimizedUrl, kind: 'background', location: 'header', logoWord: LOGO_WORD_RE.test(attrUrl(m[0])) }));
  }

  // background-image declared in CSS for header/nav/#logo/.logo selectors.
  // Resolved against each STYLESHEET's own base, not the page's, since a
  // relative url() inside a fetched CSS file is stylesheet-relative.
  for (const seg of cssSegments) {
    for (const m of seg.text.matchAll(/([^{}]{0,200})\{([^{}]*)\}/g)) {
      const selector = m[1];
      const body = m[2];
      if (!/#logo\b|\.logo\b/i.test(selector)) continue;
      const bgm = body.match(/background(?:-image)?\s*:[^;]*url\(([^)]+)\)/i);
      if (!bgm) continue;
      const raw = bgm[1].replace(/["']/g, '').trim();
      // In a home link when the #logo / .logo element is (or sits in) one.
      const token = (selector.match(/[#.]logo\b/i) || [''])[0];
      const homeLink =
        token && homeSlice
          ? token[0] === '#'
            ? /\bid=["']logo["']/i.test(homeSlice)
            : /\bclass=["'][^"']*\blogo\b/i.test(homeSlice)
          : false;
      // #logo/.logo is a header-equivalent container per contract even when
      // the page has no literal <header>/<nav> tag (common in older themes).
      candidates.push(
        newLogoCandidate({
          url: resolveCssUrl(seg.base, raw, isLocal),
          kind: 'background',
          location: 'header',
          homeLink,
          logoWord: true,
        })
      );
    }
  }

  // og:image
  const og =
    (html.match(/property=["']og:image["'][^>]*content=["']([^"']+)/i) ||
      html.match(/content=["']([^"']+)["'][^>]*property=["']og:image["']/i) ||
      [])[1];
  if (og) {
    const r = resolveImageUrl(og, toAbs, isLocal, pageUrl);
    candidates.push(newLogoCandidate({ url: r.url, optimizedUrl: r.optimizedUrl, kind: 'og:image', location: 'meta' }));
  }

  // favicon / icon
  const icon = (html.match(/<link[^>]+rel=["'][^"']*icon[^"']*["'][^>]*href=["']([^"']+)["']/i) || [])[1];
  if (icon) {
    const r = resolveImageUrl(icon, toAbs, isLocal, pageUrl);
    candidates.push(newLogoCandidate({ url: r.url, optimizedUrl: r.optimizedUrl, kind: 'icon', location: 'meta' }));
  }

  return candidates;
}

async function resolveDimensions(candidates, { isLocal, deadline }) {
  for (const c of candidates) {
    if ((c.width && c.height) || !c.url) continue;
    if (Date.now() > deadline) break;
    try {
      let info;
      if (isLocal) {
        if (/^https?:\/\//i.test(c.url)) continue; // no network fetches from local-file mode
        info = readLocalHeaderBytes(c.url);
      } else {
        info = await fetchHeaderBytes(c.url, deadline);
      }
      const dims = sniffImageDimensions(info.buf);
      if (dims) {
        c.width = dims.width;
        c.height = dims.height;
        c.aspect = round(dims.width / dims.height);
      }
      if (info.totalBytes) c.bytes = info.totalBytes;
    } catch {
      // leave dimensions unknown — never throw on a bad image
    }
  }
}

// Drops header images/SVGs that have no logo word and turn out to be icons
// or wrong-shaped once their size is known. Candidates named "logo", meta
// candidates (og:image, favicon) and CSS backgrounds are kept as before.
function dropNonLogoShapes(candidates) {
  return candidates.filter((c) => {
    if (c.logoWord || (c.kind !== 'img' && c.kind !== 'svg-inline')) return true;
    const w = c.width;
    const h = c.height;
    if (w && h && Math.max(w, h) < ICON_MAX_PX) return false; // icon
    if (c.homeLink) return true;
    // An unnamed header image or SVG outside a home link needs logo
    // proportions (a 320x512 icon glyph does not qualify).
    if (!w || !h) return false;
    const aspect = w / h;
    return aspect >= UNNAMED_MIN_ASPECT && aspect <= UNNAMED_MAX_ASPECT && w >= UNNAMED_MIN_WIDTH;
  });
}

function formatRank(c) {
  const ext = (c.url || '').split('?')[0].split('.').pop().toLowerCase();
  if (c.kind === 'svg-inline' || ext === 'svg') return 0;
  if (ext === 'png') return 1;
  if (ext === 'jpg' || ext === 'jpeg') return 2;
  return 3;
}

function dedupeAndRankLogos(candidates) {
  const byKey = new Map();
  for (const c of candidates) {
    if (c.width && c.height) {
      const norm = Math.max(c.width / c.height, c.height / c.width);
      c.strip = norm > 12;
    }
    const key = `${c.kind}|${c.url || ''}|${c.location}`;
    const prev = byKey.get(key);
    if (!prev) byKey.set(key, c);
    else {
      prev.homeLink = prev.homeLink || c.homeLink;
      prev.logoWord = prev.logoWord || c.logoWord;
    }
  }
  const list = [...byKey.values()];
  const locRank = (l) => (l === 'header' ? 0 : l === 'content' ? 1 : l === 'footer' ? 2 : 3);
  list.sort((a, b) => {
    // A candidate in a home link outranks everything but a strip; a logo
    // word outranks an unnamed header image.
    if (a.strip !== b.strip) return a.strip ? 1 : -1;
    if (a.homeLink !== b.homeLink) return a.homeLink ? -1 : 1;
    if (locRank(a.location) !== locRank(b.location)) return locRank(a.location) - locRank(b.location);
    if (a.logoWord !== b.logoWord) return a.logoWord ? -1 : 1;
    const an = a.aspect ? Math.max(a.aspect, 1 / a.aspect) : Infinity;
    const bn = b.aspect ? Math.max(b.aspect, 1 / b.aspect) : Infinity;
    if (an !== bn) return an - bn;
    return formatRank(a) - formatRank(b);
  });
  return list;
}

async function extractLogos(html, cssSegments, ctx) {
  const candidates = collectLogoCandidates(html, cssSegments, ctx.toAbs, ctx.isLocal, ctx.pageUrl);
  await resolveDimensions(candidates, ctx);
  const kept = dropNonLogoShapes(candidates);
  await resolveWhiteOnTransparent(kept, ctx);
  return dedupeAndRankLogos(kept);
}

// Only MAX_CSS_PER_PAGE stylesheets get fetched, so fetch the ones that
// carry the brand first: the theme's main stylesheet, then other theme and
// site CSS, then plugin and vendor bundles. A WordPress page with 40 links
// otherwise spends the whole budget on plugins and never sees the theme's
// body and heading rules. Stable within a tier.
function stylesheetTier(href) {
  const h = href.toLowerCase();
  if (/\/plugins\/|\/vendor\/|node_modules|cdnjs\.|jsdelivr\.|unpkg\.|googleapis\.|gstatic\.|bootstrapcdn|fontawesome|swiper|slick|flickity|glightbox|animate(\.min)?\.css|aos\.css/.test(h)) return 3;
  if (/\/themes\/[^?#]*\/(style|main|app|theme|global|site|styles)(\.min)?\.css/.test(h)) return 0;
  if (/\/(dist|build|assets\/css)\/[^?#]*(main|app|style|styles|theme|global|site)(\.min)?\.css/.test(h)) return 0;
  if (/\/themes\//.test(h)) return 1;
  return 2;
}

function orderStylesheets(hrefs) {
  return hrefs
    .map((href, i) => ({ href, i, tier: stylesheetTier(href) }))
    .sort((a, b) => a.tier - b.tier || a.i - b.i)
    .map((x) => x.href);
}

// ---------------------------------------------------------------------------
// per-site processing
// ---------------------------------------------------------------------------

function emptySite(input, error) {
  return {
    input,
    finalUrl: null,
    status: null,
    timingMs: {},
    page: null,
    css: null,
    colors: [],
    fonts: null,
    logo: [],
    iconColors: [],
    tells: null,
    warnings: [],
    error,
  };
}

async function processSite(input, opts) {
  const site = emptySite(input, null);
  const t0 = Date.now();
  const deadline = t0 + SITE_WALL_MS;

  try {
    const local = isLocalInput(input);
    let html;
    let base; // { local: true, dir } | { local: false, base: url }
    let origin = null;

    if (local) {
      const abs = resolvePath(process.cwd(), input);
      if (!existsSync(abs)) throw new Error(`local file not found: ${abs}`);
      html = readFileSync(abs, 'utf8');
      site.finalUrl = abs;
      site.status = null;
      base = { local: true, dir: dirname(abs) };
      progress(`read local file ${abs}`);
    } else {
      const tPage0 = Date.now();
      const res = await fetchText(input, deadline);
      site.timingMs.page = Date.now() - tPage0;
      if (!res.ok && !res.text) throw new Error(res.err || `fetch failed (status ${res.status})`);
      html = res.text;
      site.finalUrl = res.url;
      site.status = res.status;
      base = { local: false, base: res.url };
      origin = safeOrigin(res.url);
      progress(`fetched ${input} -> ${res.url} [${res.status}] in ${site.timingMs.page}ms`);
    }

    const pagesInfo = [{ url: site.finalUrl, role: 'main', status: site.status }];
    const htmlPages = [html];
    // Each segment carries its OWN base (the stylesheet's own URL/directory,
    // not the page's) so background-image url()s resolve correctly later.
    let cssSegments = [];
    let stylesheetsLinked = 0;
    let stylesheetsFetched = 0;
    let cssBytes = 0;
    let inlineBlocks = 0;

    const collectCssFrom = async (htmlText, baseInfo) => {
      const segments = [];
      const inline = [...htmlText.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/gi)].map((m) => m[1]);
      inlineBlocks += inline.length;
      if (inline.length) {
        segments.push({ text: inline.join('\n'), base: baseInfo.local ? baseInfo.dir : baseInfo.base });
      }
      const linkTags = [...htmlText.matchAll(/<link[^>]+rel=["'][^"']*stylesheet[^"']*["'][^>]*>/gi)].map((m) => m[0]);
      const allHrefs = linkTags
        .map((l) => decodeEntities((l.match(/href=["']([^"']+)["']/i) || [])[1] || ''))
        .filter(Boolean);
      // Choose which ones to fetch by priority, then fetch them in document
      // order so "later rule wins" still follows the page's own cascade.
      const chosen = new Set(
        orderStylesheets(allHrefs.filter((h) => !SKIP_STYLESHEET_HOSTS.some((x) => h.includes(x)))).slice(0, MAX_CSS_PER_PAGE)
      );
      const hrefs = allHrefs.filter((h) => chosen.has(h) || SKIP_STYLESHEET_HOSTS.some((x) => h.includes(x)));
      stylesheetsLinked += allHrefs.length;

      let fetchedCount = 0;
      for (const href of hrefs) {
        if (fetchedCount >= MAX_CSS_PER_PAGE) break;
        if (Date.now() > deadline) {
          site.warnings.push('wall-time budget exceeded before fetching all stylesheets');
          break;
        }
        if (SKIP_STYLESHEET_HOSTS.some((h) => href.includes(h))) continue; // handled via Google Fonts regex instead
        if (baseInfo.local) {
          if (/^https?:\/\//i.test(href)) {
            const r = await fetchText(href, deadline);
            if (r.ok) {
              segments.push({ text: r.text, base: r.url });
              cssBytes += r.bytes;
              fetchedCount++;
            } else {
              site.warnings.push(`stylesheet fetch failed: ${href}`);
            }
          } else {
            try {
              const p = resolvePath(baseInfo.dir, href);
              const t = readFileSync(p, 'utf8');
              segments.push({ text: t, base: dirname(p) });
              cssBytes += Buffer.byteLength(t);
              fetchedCount++;
            } catch {
              site.warnings.push(`local stylesheet not found: ${href}`);
            }
          }
        } else {
          const abs2 = absUrl(baseInfo.base, href);
          if (!abs2) continue;
          const r = await fetchText(abs2, deadline);
          if (r.ok) {
            segments.push({ text: r.text, base: r.url });
            cssBytes += r.bytes;
            fetchedCount++;
          } else {
            site.warnings.push(`stylesheet fetch failed: ${abs2}`);
          }
        }
      }
      stylesheetsFetched += fetchedCount;
      return segments;
    };

    cssSegments = cssSegments.concat(await collectCssFrom(html, base));

    if (opts.depth === 1) {
      if (base.local) {
        site.warnings.push('depth=1 ignored for local file input (no same-origin concept)');
      } else {
        const navHtml =
          [...html.matchAll(/<nav[\s\S]*?<\/nav>/gi)].map((m) => m[0]).join('\n') +
          '\n' +
          [...html.matchAll(/<header[\s\S]*?<\/header>/gi)].map((m) => m[0]).join('\n');
        const hrefs = [...navHtml.matchAll(/<a[^>]+href=["']([^"'#][^"']*)["']/gi)].map((m) => attrUrl(m[1]));
        const seen = new Set([site.finalUrl]);
        const navTargets = [];
        for (const h of hrefs) {
          if (/^(mailto:|tel:|javascript:)/i.test(h)) continue;
          const u = absUrl(site.finalUrl, h);
          if (!u || seen.has(u) || safeOrigin(u) !== origin) continue;
          seen.add(u);
          navTargets.push(u);
          if (navTargets.length >= MAX_NAV_LINKS) break;
        }
        if (navTargets.length === 0) {
          site.warnings.push('depth=1 requested but no same-origin nav links found');
        }
        for (const u of navTargets) {
          if (Date.now() > deadline) {
            site.warnings.push('wall-time budget exceeded before crawling all nav links');
            break;
          }
          const r = await fetchText(u, deadline);
          pagesInfo.push({ url: u, role: 'nav-link', status: r.status });
          if (r.ok) {
            htmlPages.push(r.text);
            cssSegments = cssSegments.concat(await collectCssFrom(r.text, { local: false, base: r.url }));
          } else {
            site.warnings.push(`nav-link fetch failed: ${u}`);
          }
        }
      }
    }

    site.css = {
      stylesheetsLinked,
      stylesheetsFetched,
      bytes: cssBytes,
      inlineBlocks,
      pages: pagesInfo,
    };

    const toAbs = (href) => {
      if (!href) return null;
      if (base.local) {
        if (/^https?:\/\//i.test(href)) return href;
        try {
          return resolvePath(base.dir, href);
        } catch {
          return null;
        }
      }
      return absUrl(base.base, href);
    };

    const cssText = stripCssComments(cssSegments.map((s) => s.text).join('\n'));
    const rules = parseRules(cssText);
    const props = customProps(cssText);
    site.tells = extractTells(html);
    // Page matching needs real markup; a JS shell has almost none, so every
    // rule counts as on-page there (onPage: null in colors[]).
    const pageIndex = site.tells.jsShell ? null : htmlTokenIndex(htmlPages);
    if (!pageIndex) site.warnings.push('page looks like a JS shell; colors[].onPage not computed');
    site.colors = extractColors(cssText, rules, {
      pageIndex,
      svgBodyColors: inlineSvgBodyColors(html),
      countElements: pageIndex ? elementCounter(html) : null,
    });
    site.fonts = extractFonts(cssText, html, rules, { pageIndex });
    site.page = extractPage(html, rules, props);

    if (site.page.bodyTextColor.value) {
      const entry = site.colors.find((c) => c.hex === site.page.bodyTextColor.value);
      if (entry && !entry.contexts.includes('text')) entry.contexts.push('text');
    }

    const tLogo0 = Date.now();
    site.logo = await extractLogos(html, cssSegments, {
      toAbs,
      isLocal: base.local,
      deadline,
      pageUrl: base.local ? null : site.finalUrl,
    });
    site.timingMs.logo = Date.now() - tLogo0;
    site.iconColors = await collectIconColors(html, {
      toAbs,
      isLocal: base.local,
      pageUrl: base.local ? null : site.finalUrl,
      deadline,
      skip: new Set(site.logo.map((l) => l.url).filter(Boolean)),
    });

    // logo-alt is text (the alt attribute), never the decoded image — but a
    // strip/partner-bar candidate's alt ("partner logos") is not a name
    // form, and neither is the alt of a picture in the content (Fiklon's
    // "Konsultacja z neurologopedą" came from an illustration whose src was
    // a lazy-load placeholder) or a bare "logo". Only a non-strip candidate
    // where logos sit (home link, header, footer) counts.
    const logoAlt = site.logo.find(
      (l) =>
        l.alt &&
        !l.strip &&
        (l.homeLink || l.location === 'header' || l.location === 'footer') &&
        !/^(logo|logotyp|logotype|image|img|home|strona główna)$/i.test(l.alt.trim())
    )?.alt;
    if (logoAlt) {
      site.page.nameForms = dedupeNameForms([...site.page.nameForms, { value: logoAlt, source: 'logo-alt' }]);
    }
    addLogoDistances(site);
  } catch (e) {
    site.error = (e && e.message) || String(e);
  }

  site.timingMs.total = Date.now() - t0;
  return site;
}

// ---------------------------------------------------------------------------
// --save-logo: one logo candidate, written to disk as fetched
// ---------------------------------------------------------------------------

const MAX_LOGO_BYTES = 5_000_000;
const IMAGE_EXT_RE = /\.(png|jpe?g|gif|webp|ico|svg|avif)$/i;

// The file type from the bytes, not the URL: `logo.php?id=3` is a PNG, and
// a `.png` URL sometimes serves an SVG.
function sniffImageExt(buf, urlHint) {
  if (buf.length >= 8 && buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47) return 'png';
  if (buf.length >= 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return 'jpg';
  if (buf.length >= 6 && buf.subarray(0, 3).toString('latin1') === 'GIF') return 'gif';
  if (buf.length >= 12 && buf.subarray(0, 4).toString('latin1') === 'RIFF' && buf.subarray(8, 12).toString('latin1') === 'WEBP') return 'webp';
  if (buf.length >= 12 && buf.subarray(4, 12).toString('latin1') === 'ftypavif') return 'avif';
  if (buf.length >= 4 && buf[0] === 0 && buf[1] === 0 && buf[2] === 1 && buf[3] === 0) return 'ico';
  if (/<svg[\s>]/i.test(buf.subarray(0, 4096).toString('utf8'))) return 'svg';
  const hinted = extOf(urlHint || '');
  return hinted === 'jpeg' ? 'jpg' : hinted || null;
}

async function fetchLogoBytes(url, deadline) {
  const timeoutMs = Math.max(500, Math.min(TIMEOUT_MS, deadline - Date.now()));
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), timeoutMs);
  try {
    const res = await fetch(url, { headers: { 'user-agent': UA }, redirect: 'follow', signal: ctl.signal });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.length > MAX_LOGO_BYTES) throw new Error(`file is ${buf.length} bytes, over the ${MAX_LOGO_BYTES} byte limit`);
    return buf;
  } finally {
    clearTimeout(timer);
  }
}

// Writes logo candidate `index` of `site` to `dest`, with the extension the
// bytes call for (`logo` -> `logo.png`, `logo.svg` holding a PNG ->
// `logo.png`). Returns { index, url, kind, path, bytes }.
async function saveLogo(site, index, dest) {
  const cand = (site.logo || [])[index];
  if (!cand) throw new Error(`no logo candidate ${index} (the page has ${(site.logo || []).length})`);
  let buf;
  if (cand.kind === 'svg-inline') {
    let svg = cand.markup || '';
    if (!svg) throw new Error('inline SVG markup not available');
    if (!/<svg\b[^>]*\bxmlns=/i.test(svg)) svg = svg.replace(/<svg\b/i, '<svg xmlns="http://www.w3.org/2000/svg"');
    buf = Buffer.from(svg, 'utf8');
  } else if (!cand.url) {
    throw new Error(`logo candidate ${index} has no file`);
  }
  // The original file first; the optimizer's copy only when the original
  // cannot be fetched (a re-encoded logo beats no logo).
  let from = cand.url;
  if (cand.kind !== 'svg-inline') {
    const read = (u) => (isLocalInput(u) ? readFileSync(u) : fetchLogoBytes(u, Date.now() + TIMEOUT_MS));
    try {
      buf = await read(cand.url);
    } catch (e) {
      if (!cand.optimizedUrl) throw e;
      buf = await read(cand.optimizedUrl);
      from = cand.optimizedUrl;
      progress(`--save-logo: original ${cand.url} failed (${(e && e.message) || e}); saved the optimized copy instead`);
    }
  }
  const ext = sniffImageExt(buf, from) || 'bin';
  let path = resolvePath(process.cwd(), dest);
  path = IMAGE_EXT_RE.test(path) ? path.replace(IMAGE_EXT_RE, `.${ext}`) : `${path}.${ext}`;
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, buf);
  // Relative to where the command ran, so the path drops straight into
  // brand-tokens.mjs --logo.
  const rel = relativePath(process.cwd(), path);
  return { index, url: from, kind: cand.kind, path: rel && !rel.startsWith('..') ? rel : path, bytes: buf.length };
}

// ---------------------------------------------------------------------------
// --summary: the decision inputs for teach, in about sixty lines
// ---------------------------------------------------------------------------

const SUMMARY_COLORS = 5;
const SUMMARY_LOGOS = 3;
const clip = (t, n) => {
  const s = String(t ?? '').replace(/\s+/g, ' ').trim();
  return s.length > n ? `${s.slice(0, n - 1)}…` : s;
};
const yesNo = (v) => (v === true ? 'yes' : v === false ? 'no' : '?');

function summaryColorLine(c, label) {
  const bits = [
    `${label}${c.hex}`,
    c.elements != null ? `${c.elements} el (${c.occurrences}x in CSS)` : `${c.occurrences}x`,
    c.contexts.length ? c.contexts.join('/') : 'no context',
  ];
  const stateOnly = (c.stateContexts || []).filter((k) => !c.contexts.includes(k));
  if (stateOnly.length) bits.push(`hover-only ${stateOnly.join('/')}`);
  if (c.variables.length) bits.push(c.variables.slice(0, 2).join(' '));
  if (c.vendorVariables) bits.push('(vendor var, kept: used on brand surfaces)');
  if (c.onPage === false) bits.push('NOT on this page');
  bits.push(`L ${c.lightness}`);
  bits.push(`logoDistance ${c.logoDistance ?? 'n/a'}`);
  return `  ${bits.join('  ')}`;
}

function summarizeSite(site) {
  const L = [];
  L.push(`site: ${site.finalUrl || site.input}${site.status ? ` [${site.status}]` : ''}`);
  if (site.error) {
    L.push(`error: ${site.error}`);
    return L;
  }
  const p = site.page || {};
  const names = (p.nameForms || []).map((n) => `"${n.value}" (${n.source}${n.legalName ? `; legalName "${n.legalName}"` : ''})`);
  L.push(`name: ${names.length ? names.join('; ') : 'none found'}`);
  L.push(`lang: ${p.lang || 'not declared'}`);
  const bt = p.bodyTextColor || {};
  const btText = bt.value ? `${bt.value} (${bt.source})` : `null${bt.reason ? ` (${bt.reason}${bt.observed ? `, saw ${bt.observed}` : ''})` : ''}`;
  L.push(`page: siteIsDark ${yesNo(p.siteIsDark)}; pageBackground ${p.pageBackground?.value || 'null'}; bodyTextColor ${btText}`);

  // Colors: non-vendor, saturated, in the JSON's order, with the ones used
  // on a button, nav, link or heading first. The color nearest the logo is
  // added when it did not make the list, since teach decides close calls
  // by it.
  const ref = site.logoDistanceFrom;
  L.push(
    ref
      ? `colors (non-vendor, saturated, most elements on this page first; el = elements painted, hover left out; logoDistance = ΔE OKLab x100 to the logo's ${ref.colors.join(' ')}, from ${ref.url ? clip(ref.url.split('/').pop(), 60) : 'the inline SVG logo'}; under 5 reads as the same color):`
      : 'colors (non-vendor, saturated, most elements on this page first; el = elements painted, hover left out; logoDistance n/a: no logo candidate paints with a saturated color):'
  );
  // On a dark site the darkest tones are the theme's surfaces (panel and
  // button backgrounds), not brand accents; they get their own line so a
  // dark logo cannot pull the primary toward a surface color.
  const all = site.colors.filter((c) => !c.vendor && c.saturated);
  const isSurface = (c) => p.siteIsDark && c.lightness < 0.3;
  const pool = all.filter((c) => !isSurface(c));
  const surfaces = all.filter(isSurface);
  const ranked = [...pool.filter((c) => c.contexts.length), ...pool.filter((c) => !c.contexts.length)];
  const top = ranked.slice(0, SUMMARY_COLORS);
  top.forEach((c, i) => L.push(summaryColorLine(c, `${i + 1}. `)));
  if (!top.length) L.push('  none');
  const nearest = pool.filter((c) => c.logoDistance != null).sort((a, b) => a.logoDistance - b.logoDistance)[0];
  if (nearest && !top.includes(nearest)) L.push(summaryColorLine(nearest, 'nearest the logo: '));
  if (surfaces.length) L.push(`  dark-site surfaces, not primary candidates: ${surfaces.slice(0, 4).map((c) => c.hex).join(' ')}`);
  // Light brand tints painted as section backgrounds: the --accent
  // candidates (teach.md, secondary color).
  const lightSurfaces = pool.filter((c) => c.contexts.includes('surface') && c.lightness >= 0.8 && c.onPage !== false).slice(0, 3);
  if (lightSurfaces.length) {
    L.push(`  light surfaces (section backgrounds, accent candidates): ${lightSurfaces.map((c) => `${c.hex} ${c.elements ?? '?'} el`).join('; ')}`);
  }
  const icons = (site.iconColors || []).filter((c) => c.saturated).slice(0, 3);
  if (icons.length) {
    L.push(`  icon colors (SVG images, decoration only): ${icons.map((c) => `${c.hex} ${c.uses}x ${clip(c.files.join(','), 40)}`).join('; ')}`);
  }
  const vendorCount = site.colors.filter((c) => c.vendor).length;
  if (vendorCount) L.push(`  (${vendorCount} vendor colors left out)`);

  const f = site.fonts || {};
  const fontLine = (rule) =>
    rule ? `${rule.family || rule.resolved || 'generic'}${rule.generic ? ' (generic)' : ''}; origin ${rule.origin}; source ${rule.fontSource || 'none'}` : null;
  L.push('fonts:');
  L.push(`  body: ${fontLine(f.bodyRule) || 'not found'}`);
  L.push(`  heading: ${fontLine(f.headingRule) || 'nothing styles headings, so the body face'}`);
  const res = f.weights?.resolved || {};
  const w = (k) => (res[k] ? `${res[k].value} (${res[k].source})` : 'n/a');
  L.push(`  weights: h2 ${w('h2')}; h1 ${w('h1')}; body ${f.weights?.body ?? 'n/a'}`);
  const fams = (f.families || []).filter((x) => !x.icon).slice(0, 4);
  if (fams.length) L.push(`  families: ${fams.map((x) => `${x.family} (${x.fontSource || 'none'}, ${x.occurrences}x)`).join('; ')}`);

  L.push(`logo candidates (best first; pick another with --logo-index N):`);
  const logos = (site.logo || []).slice(0, SUMMARY_LOGOS);
  logos.forEach((l, i) => {
    const size = l.width && l.height ? `${l.width}x${l.height}` : 'size ?';
    const colors = Array.isArray(l.colors) ? (l.colors.length ? l.colors.map((c) => c.hex).join(' ') : 'greys only') : 'colors ?';
    L.push(`  ${i}. ${l.url ? clip(l.url, 110) : '(inline SVG)'}`);
    L.push(`     ${l.kind}, ${l.location}, ${size};${l.optimizedUrl ? ' original of an optimized image;' : ''} homeLink ${yesNo(l.homeLink)}; logoWord ${yesNo(l.logoWord)}; strip ${yesNo(l.strip)}; whiteOnTransparent ${yesNo(l.whiteOnTransparent)}; ${colors}`);
  });
  if (!logos.length) L.push('  none');
  if (site.savedLogo) L.push(`  saved #${site.savedLogo.index} to ${site.savedLogo.path}`);

  L.push('tone:');
  if (p.h1) L.push(`  h1: ${clip(p.h1, 140)}`);
  if (p.h2?.length) L.push(`  h2: ${clip(p.h2.slice(0, 6).join(' | '), 160)}`);
  for (const para of (p.paragraphs || []).slice(0, 3)) L.push(`  p: ${clip(para, 160)}`);
  if (site.tells?.jsShell) L.push('  (page looks like a JS shell: little text without running scripts)');
  if (site.warnings?.length) L.push(`warnings: ${site.warnings.length} (in the full JSON)`);
  return L;
}

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------

function printUsage() {
  console.error(
    'usage: node brand-evidence.mjs [--depth 0|1] [--pretty] [--summary] [--out <file.json>]\n' +
      '                               [--save-logo <path> [--logo-index N]] <url-or-local-file> ...'
  );
}

async function main() {
  const args = process.argv.slice(2);
  let depth = 0;
  let pretty = false;
  let summary = false;
  let outPath = null;
  let saveLogoPath = null;
  let logoIndex = 0;
  const inputs = [];

  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === '--depth') {
      depth = Number(args[++i]);
    } else if (a.startsWith('--depth=')) {
      depth = Number(a.slice('--depth='.length));
    } else if (a === '--pretty') {
      pretty = true;
    } else if (a === '--summary') {
      summary = true;
    } else if (a === '--out') {
      outPath = args[++i];
    } else if (a === '--save-logo') {
      saveLogoPath = args[++i];
    } else if (a === '--logo-index') {
      logoIndex = Number(args[++i]);
    } else if (a === '-h' || a === '--help') {
      printUsage();
      process.exit(0);
    } else if (a.startsWith('--')) {
      console.error(`unknown flag: ${a}`);
      printUsage();
      process.exit(1);
    } else {
      inputs.push(a);
    }
  }

  if (inputs.length === 0) {
    printUsage();
    process.exit(1);
  }
  if (!Number.isInteger(depth) || (depth !== 0 && depth !== 1)) {
    console.error('--depth must be 0 or 1');
    process.exit(1);
  }
  if ((args.includes('--out') && !outPath) || (args.includes('--save-logo') && !saveLogoPath)) {
    console.error('--out and --save-logo need a path');
    process.exit(1);
  }
  if (!Number.isInteger(logoIndex) || logoIndex < 0) {
    console.error('--logo-index must be a whole number, 0 or more');
    process.exit(1);
  }

  const sites = [];
  for (const input of inputs) {
    progress(`processing ${input}`);
    let site;
    try {
      site = await processSite(input, { depth });
    } catch (e) {
      site = emptySite(input, (e && e.message) || String(e));
    }
    sites.push(site);
    const suffix = site.error ? ` (error: ${site.error})` : '';
    progress(`done ${input} in ${site.timingMs?.total ?? '?'}ms${suffix}`);
  }

  // --save-logo acts on the first site only: one profile, one logo file.
  let exitCode = 0;
  if (saveLogoPath) {
    try {
      if (sites[0].error) throw new Error(sites[0].error);
      sites[0].savedLogo = await saveLogo(sites[0], logoIndex, saveLogoPath);
      progress(`saved logo #${logoIndex} to ${sites[0].savedLogo.path}`);
    } catch (e) {
      console.error(`brand-evidence: --save-logo failed: ${(e && e.message) || e}`);
      exitCode = 3;
    }
  }

  const output = { schema: 1, generatedAt: new Date().toISOString(), sites };
  const json = (pretty ? JSON.stringify(output, null, 2) : JSON.stringify(output)) + '\n';
  if (outPath) {
    const abs = resolvePath(process.cwd(), outPath);
    mkdirSync(dirname(abs), { recursive: true });
    writeFileSync(abs, json);
    progress(`wrote the full JSON to ${abs}`);
  }
  if (summary) {
    const lines = [];
    sites.forEach((site, i) => {
      if (i > 0) lines.push('');
      lines.push(...summarizeSite(site));
    });
    lines.push(outPath ? `full JSON: ${outPath}` : 'full JSON: run again with --out <file.json>');
    process.stdout.write(lines.join('\n') + '\n');
  } else if (!outPath) {
    process.stdout.write(json);
  }
  process.exit(exitCode);
}

main();
