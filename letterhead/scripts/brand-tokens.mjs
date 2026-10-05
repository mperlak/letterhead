#!/usr/bin/env node
// Purpose: compose a client/brand tokens.css by overriding a small set of
// derivable slots on a base style's tokens.css — primary color (+ its
// text-safe ink variant), accent tint, optional foreground/background,
// body/heading fonts, an optional embedded logo — while leaving every other
// token in the base file (radii, shadows, chart colors, spacing, motion,
// sidebar mirrors that don't track primary/accent/ring, ...) untouched. The
// base file's own three theme blocks (:root, [data-theme="dark"], and the
// @media (prefers-color-scheme: dark) OS-dark block) are located and edited
// in place, so comments, ordering and formatting outside the overridden
// lines survive verbatim.
//
// Usage:
//   node brand-tokens.mjs \
//     --style <base-tokens.css> \
//     --primary <hex|oklch> \
//     [--foreground <hex|oklch>] [--background <hex|oklch>] [--accent <hex|oklch>] \
//     --font-body "<family>[, <category>]" [--font-heading "<family>[, <category>]"] \
//     [--heading-weight 100..900] \
//     [--embed-fonts] [--lang <code>] [--font-file "<Family>[:<weight>]=<file.woff2>"]... \
//     [--logo <file.png|svg|jpg>] [--logo-on dark|light] \
//     [--logo-tint <hex|oklch>] \
//     --out <tokens.css> [--json]
//
// Behaviour summary (see the teach spec for the full contract):
//   1. Parse the base's three token blocks; every base token is preserved.
//   2. Override --primary/--primary-foreground/--ring/--accent/
//      --accent-foreground/--chart-1 (+ --foreground/--background if given),
//      --card-foreground/--popover-foreground (always the block's
//      foreground) and the font stack tokens; any base sidebar-* token that
//      mirrored the corresponding non-sidebar token in the base file keeps
//      mirroring it. --accent is a light tint of the primary's hue unless
//      --accent <color> names the brand's own accent: then the light theme
//      uses that color as given and the dark themes use its hue at a dark,
//      low-chroma fill. --accent-foreground is the block's foreground
//      when it clears 4.5:1 on that accent, else white or near-black.
//   3. Derive --primary-ink per block. Light: the primary hue at the
//      lightest lightness that still clears 4.5:1 on the background,
//      reducing chroma if that walk leaves the sRGB gamut. Dark: the primary
//      hue at the darkest lightness that clears 4.5:1 on the dark
//      background, at the most chroma sRGB holds there.
//   4. The dark --primary is the brand color unchanged when it has 3:1 on
//      the dark background; otherwise its lightness rises just enough to
//      reach 3:1, same hue, chroma kept as far as the gamut allows. --muted,
//      --border and --muted-foreground keep the style's lightness and take
//      the primary's hue at a very low chroma.
//   5. An optional logo is embedded once, as a data: URI, size-capped, with
//      --brand-logo-ratio (width / height, read from the file) next to it.
//      --logo-tint recolors single-color artwork (PNG with transparency, or
//      SVG) to one color, keeping the shape and the anti-aliased edges; it
//      refuses multi-color artwork rather than flattening a real logo. For
//      dark mode:
//        - single-color artwork on light: the copy goes into
//          --brand-logo-mask and documents draw it as a mask filled with
//          --brand-logo-color, which is the tint (or the artwork's own color,
//          or the text color) in :root and the dark theme's text color in
//          both dark blocks. --brand-logo is var(--brand-logo-mask), the
//          image in its light-theme color, for documents that draw it as a
//          background;
//        - multi-color artwork on light: the dark blocks set
//          --brand-logo-plate to a light color (the light theme's paper),
//          and :root sets it to transparent; documents put the logo on
//          that plate;
//        - artwork on dark (--logo-on dark): --brand-logo-plate is a dark
//          color in all three blocks, so the band stays dark in both themes.
//   6. With --embed-fonts, the body and heading families are embedded as
//      @font-face rules with data: URIs, between /* letterhead:fonts */ and
//      /* /letterhead:fonts */ at the top of the file (a later run replaces
//      that section). Families come from Google Fonts (weights 400, 700 and
//      --heading-weight; subsets from --lang: "en" → latin, anything else →
//      latin + latin-ext) or from --font-file. A family that cannot be
//      fetched is reported and skipped; the run never fails over a font.
//   7. The base style's header comment is replaced with one naming the
//      brand (read from profile.meta.json next to --out, when present).
//   8. All written/overridden colors are formatted oklch(L C H) with
//      3-decimal L/C and 1-decimal H; untouched base tokens are copied
//      byte-for-byte, including their own formatting.
//   9. After writing, this script runs check-tokens.mjs on the output and
//      relays its exit code.
//
// Exit codes:
//   0 — tokens.css written and check-tokens.mjs found no errors
//   1 — usage error (missing/invalid flag, unreadable input file), or
//       --logo-tint given for artwork that is not single-color
//   2 — tokens.css was written but check-tokens.mjs found errors
//
// Test hook: LETTERHEAD_FONTS_API overrides the Google Fonts CSS endpoint
// (default https://fonts.googleapis.com/css2), so the smoke test can
// simulate an unreachable network.
//
// No dependencies beyond Node's built-ins (global fetch, Node 18+) and the
// vendored scripts/vendor/culori.mjs (parse, formatHex, converter,
// wcagContrast).

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { inflateSync, deflateSync, brotliDecompressSync } from 'node:zlib';
import { spawnSync } from 'node:child_process';
import { dirname, join, basename, resolve as resolvePath } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse, formatHex, converter, wcagContrast } from './vendor/culori.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const CHECK_TOKENS_SCRIPT = join(HERE, 'check-tokens.mjs');
const MAX_LOGO_BASE64_BYTES = 200 * 1024;
const FONT_BUDGET_BASE64_BYTES = 350 * 1024;
const FONTS_API = process.env.LETTERHEAD_FONTS_API || 'https://fonts.googleapis.com/css2';
// Google Fonts serves woff2 with unicode-range subsets only to a browser it
// recognizes; without this header it answers with a single TTF per weight.
const BROWSER_UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36';
const FONTS_BEGIN = '/* letterhead:fonts */';
const FONTS_END = '/* /letterhead:fonts */';
const GENERIC_FAMILIES = new Set(['serif', 'sans-serif', 'monospace', 'cursive', 'fantasy', 'system-ui', 'ui-serif', 'ui-sans-serif', 'ui-monospace', 'ui-rounded', 'math', 'emoji', 'fangsong']);

const toRgb = converter('rgb');
const toOklch = converter('oklch');

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------

function usage() {
  console.error(
    [
      'usage: node brand-tokens.mjs --style <tokens.css> --primary <hex|oklch>',
      '         [--foreground <hex|oklch>] [--background <hex|oklch>] [--accent <hex|oklch>]',
      '         --font-body "<family>[, <category>]" [--font-heading "<family>[, <category>]"]',
      '         [--heading-weight 100..900]',
      '         [--embed-fonts] [--lang <code>] [--font-file "<Family>[:<weight>]=<file.woff2>"]...',
      '         [--logo <file.png|svg|jpg>] [--logo-on dark|light]',
      '         [--logo-tint <hex|oklch>]',
      '         --out <tokens.css> [--json]',
    ].join('\n')
  );
}

function parseArgs(argv) {
  const args = { json: false, embedFonts: false, fontFiles: [] };
  const need = (name) => {
    if (argv[i + 1] === undefined) {
      console.error(`${name} requires a value`);
      usage();
      process.exit(1);
    }
    return argv[++i];
  };
  let i = 0;
  for (; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--style') args.style = need('--style');
    else if (a === '--primary') args.primary = need('--primary');
    else if (a === '--foreground') args.foreground = need('--foreground');
    else if (a === '--background') args.background = need('--background');
    else if (a === '--accent') args.accent = need('--accent');
    else if (a === '--font-body') args.fontBody = need('--font-body');
    else if (a === '--font-heading') args.fontHeading = need('--font-heading');
    else if (a === '--heading-weight') args.headingWeight = need('--heading-weight');
    else if (a === '--logo') args.logo = need('--logo');
    else if (a === '--logo-on') args.logoOn = need('--logo-on');
    else if (a === '--logo-tint') args.logoTint = need('--logo-tint');
    else if (a === '--out') args.out = need('--out');
    else if (a === '--embed-fonts') args.embedFonts = true;
    else if (a === '--lang') args.lang = need('--lang');
    else if (a === '--font-file') args.fontFiles.push(need('--font-file'));
    else if (a === '--json') args.json = true;
    else if (a === '-h' || a === '--help') {
      usage();
      process.exit(0);
    } else {
      console.error(`unknown argument: ${a}`);
      usage();
      process.exit(1);
    }
  }
  const missing = ['style', 'primary', 'fontBody', 'out'].filter((k) => !args[k]);
  if (missing.length) {
    console.error(`missing required flag(s): ${missing.map((k) => `--${k.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`)}`).join(', ')}`);
    usage();
    process.exit(1);
  }
  if (args.headingWeight != null) {
    const w = Number(args.headingWeight);
    if (!/^\d+$/.test(args.headingWeight) || w < 100 || w > 900 || w % 100 !== 0) {
      console.error('--heading-weight must be a multiple of 100 from 100 to 900 (e.g. 400, 500, 700, 800)');
      process.exit(1);
    }
  }
  args.fontFiles = args.fontFiles.map((spec) => {
    const m = /^(.+?)(?::(\d{3})(?:-(\d{3}))?)?=(.+)$/.exec(spec);
    if (!m || !m[1].trim()) {
      console.error(`--font-file must look like "Family=path.woff2" or "Family:700=path.woff2", got "${spec}"`);
      process.exit(1);
    }
    return {
      family: m[1].trim().replace(/^["']|["']$/g, ''),
      weight: m[2] ? (m[3] ? `${Number(m[2])} ${Number(m[3])}` : String(Number(m[2]))) : null,
      path: m[4],
    };
  });
  if (args.logoOn != null && args.logoOn !== 'dark' && args.logoOn !== 'light') {
    console.error('--logo-on must be "dark" or "light"');
    process.exit(1);
  }
  return args;
}

// ---------------------------------------------------------------------------
// color helpers (culori-backed)
// ---------------------------------------------------------------------------

function parseColorArg(str, label) {
  const c = parse(str);
  if (!c) {
    console.error(`cannot parse ${label} color: "${str}"`);
    process.exit(1);
  }
  return toOklch(c);
}

const round3 = (n) => Math.round(n * 1000) / 1000;
const round1 = (n) => Math.round(n * 10) / 10;

function formatOklch({ l, c, h }) {
  const hue = Number.isFinite(h) ? h : 0;
  return `oklch(${round3(l).toFixed(3)} ${round3(Math.max(0, c)).toFixed(3)} ${round1(hue).toFixed(1)})`;
}

// Binary-searches chroma down until the color round-trips into sRGB, keeping
// L and H fixed — browsers clip out-of-gamut oklch() silently, so this is
// the only way a derived color is guaranteed to render as composed.
function inGamut(l, c, h) {
  const rgb = toRgb({ mode: 'oklch', l, c, h });
  const eps = 1e-4;
  return ['r', 'g', 'b'].every((k) => rgb[k] >= -eps && rgb[k] <= 1 + eps);
}

function clampChromaToGamut(l, c, h) {
  if (c <= 0 || inGamut(l, c, h)) return { l, c: Math.max(0, c), h };
  let lo = 0;
  let hi = c;
  for (let i = 0; i < 25; i++) {
    const mid = (lo + hi) / 2;
    if (inGamut(l, mid, h)) lo = mid;
    else hi = mid;
  }
  return { l, c: lo, h };
}

function contrastOklch(a, b) {
  return wcagContrast({ mode: 'oklch', l: a.l, c: a.c, h: a.h }, { mode: 'oklch', l: b.l, c: b.c, h: b.h });
}

const WHITE = { l: 1, c: 0, h: 0 };
const NEAR_BLACK = { l: 0.145, c: 0, h: 0 };
const BLACK = { l: 0, c: 0, h: 0 };

// White or near-black ink on a fill, whichever clears 4.5:1; if only one
// passes, that one wins; if both pass, the higher-contrast one. A fill in
// the narrow band where neither does gets pure black, which clears 4.5:1
// on everything white cannot.
function pickInkForFill(fill) {
  const cw = contrastOklch(WHITE, fill);
  const cb = contrastOklch(NEAR_BLACK, fill);
  const whitePasses = cw >= 4.5;
  const blackPasses = cb >= 4.5;
  if (whitePasses && !blackPasses) return WHITE;
  if (blackPasses && !whitePasses) return NEAR_BLACK;
  if (!whitePasses && !blackPasses && contrastOklch(BLACK, fill) >= 4.5) return BLACK;
  return cw >= cb ? WHITE : NEAR_BLACK;
}

// The value exactly as formatOklch() will write it, with chroma rounded
// down so a color computed on the gamut edge stays inside it. Contrast is
// measured on this, so rounding cannot drop a pair below its threshold.
function quantize({ l, c, h }) {
  return { l: round3(l), c: Math.floor(Math.max(0, c) * 1000 + 1e-9) / 1000, h: round1(Number.isFinite(h) ? h : 0) };
}

// Text-safe primary ink for one block: same hue as primary, chroma inherited
// from primary (gamut-clamped), lightness walked toward the floor that
// clears 4.5:1 against that block's own background (darker on a light block,
// lighter on a dark one). The contrast is measured on the value as it will
// be written (three decimals), so rounding cannot drop it below 4.5:1.
function computeInk(primary, background, direction) {
  const h = primary.h;
  let c = primary.c;
  let l = primary.l;
  const step = direction === 'darker' ? -0.01 : 0.01;
  let best = clampChromaToGamut(Math.max(0.02, Math.min(0.98, l)), c, h);
  for (let i = 0; i < 90; i++) {
    const candidate = clampChromaToGamut(l, c, h);
    const written = { l: round3(candidate.l), c: round3(candidate.c), h: round1(Number.isFinite(candidate.h) ? candidate.h : 0) };
    if (contrastOklch(written, background) >= 4.5) return candidate;
    best = candidate;
    l += step;
    if (l < 0.02 || l > 0.98) break;
  }
  return best;
}

// Dark-theme primary: the brand color itself whenever it already reads on
// the dark background (3:1, the bar for fills and rules). Otherwise the
// lightness goes up by the smallest step that reaches 3:1, keeping the hue
// and as much chroma as sRGB allows at that lightness. Deriving it from the
// style's own light-to-dark shift instead turned amber into cream and red
// into pink.
function computeDarkPrimary(primary, background) {
  if (contrastOklch(primary, background) >= 3) return primary;
  const h = Number.isFinite(primary.h) ? primary.h : 0;
  let last = null;
  for (let l = primary.l; l <= 0.99; l += 0.005) {
    last = quantize(clampChromaToGamut(l, primary.c, h));
    if (contrastOklch(last, background) >= 3) return last;
  }
  return last || primary;
}

// Dark-theme ink: the lowest lightness that clears 4.5:1 on the dark
// background, at the primary's hue and the most chroma sRGB holds there.
// Walking up from the primary with its own chroma is what produced a pale
// cream "amber" ink. A near-neutral brand keeps its low chroma, so a grey
// brand does not get a colored ink.
function computeDarkInk(primary, background) {
  const h = Number.isFinite(primary.h) ? primary.h : 0;
  const cap = primary.c < 0.03 ? primary.c : 0.4;
  let last = null;
  for (let l = Math.max(0.02, background.l); l <= 0.99; l += 0.005) {
    last = quantize(clampChromaToGamut(l, cap, h));
    if (contrastOklch(last, background) >= 4.5) return last;
  }
  return last || primary;
}

// Neutral surfaces and text (--muted, --border, --muted-foreground) keep
// the style's lightness and take the brand's hue at a very low chroma, so a
// red brand does not sit on the style's bluish greys. A value that would
// drop its text pair below 4.5:1, or that is not a plain color, stays as the
// style wrote it.
const NEUTRAL_TOKENS = ['muted', 'border', 'muted-foreground'];

function tintNeutrals(body, primary, background) {
  const out = [];
  if (!(primary.c >= 0.02) || !Number.isFinite(primary.h)) return out;
  const chroma = Math.min(0.012, primary.c * 0.06);
  for (const name of NEUTRAL_TOKENS) {
    const raw = getToken(body, name);
    if (!raw || /var\(/.test(raw)) continue;
    const parsed = parse(raw);
    if (!parsed) continue;
    const base = toOklch(parsed);
    if (parsed.alpha != null && parsed.alpha < 1) continue;
    const next = quantize(clampChromaToGamut(base.l, chroma, primary.h));
    if (name === 'muted-foreground' && background && contrastOklch(next, background) < 4.5) continue;
    out.push([name, formatOklch(next)]);
  }
  return out;
}

// ---------------------------------------------------------------------------
// tokens.css block location + surgical token get/set
// ---------------------------------------------------------------------------

// Finds every top-level `selector { body }` span in `css`, non-recursively —
// callers recurse into a span's own body text (with an offset) to reach
// nested rules, e.g. the :root inside @media (prefers-color-scheme: dark).
function findTopLevelBlocks(css) {
  const blocks = [];
  let i = 0;
  while (i < css.length) {
    const brace = css.indexOf('{', i);
    if (brace === -1) break;
    const selector = css.slice(i, brace).trim();
    let depth = 1;
    let j = brace + 1;
    while (j < css.length && depth > 0) {
      if (css[j] === '{') depth++;
      else if (css[j] === '}') depth--;
      j++;
    }
    blocks.push({ selector, bodyStart: brace + 1, bodyEnd: j - 1, blockEnd: j });
    i = j;
  }
  return blocks;
}

// Comments can contain arbitrary text (including a stray brace) and would
// otherwise get swept into whatever selector precedes them, so block
// discovery scans a comment-blanked copy — same length, so every offset
// found in it still lands correctly in the original `css` string.
function blankComments(css) {
  return css.replace(/\/\*[\s\S]*?\*\//g, (m) => ' '.repeat(m.length));
}

// Locates the base file's three theme blocks by absolute offset into the
// original text, so their bodies can be edited in place without disturbing
// anything else (header comment, the reduced-motion media query, ...).
function locateThemeBlocks(css) {
  const scan = blankComments(css);
  const top = findTopLevelBlocks(scan);
  const light = top.find((b) => b.selector === ':root');
  const darkExplicit = top.find((b) => b.selector === '[data-theme="dark"]');
  const darkMedia = top.find((b) => /^@media\s*\(\s*prefers-color-scheme\s*:\s*dark\s*\)/.test(b.selector));
  let darkOs = null;
  if (darkMedia) {
    const inner = scan.slice(darkMedia.bodyStart, darkMedia.bodyEnd);
    const innerBlocks = findTopLevelBlocks(inner);
    const rootIsh = innerBlocks.find((b) => /^:root/.test(b.selector));
    if (rootIsh) {
      darkOs = {
        selector: rootIsh.selector,
        bodyStart: darkMedia.bodyStart + rootIsh.bodyStart,
        bodyEnd: darkMedia.bodyStart + rootIsh.bodyEnd,
      };
    }
  }
  if (!light) throw new Error('base tokens.css has no top-level :root block');
  if (!darkExplicit) throw new Error('base tokens.css has no [data-theme="dark"] block');
  if (!darkOs) throw new Error('base tokens.css has no @media (prefers-color-scheme: dark) :root block');
  return { light, darkExplicit, darkOs };
}

// A declaration value may hold a quoted data: URI, which carries its own
// semicolons ("data:image/png;base64,..."), so quoted runs are skipped whole.
const VALUE_RE = `((?:"[^"]*"|'[^']*'|[^;"'])+)`;

function getToken(body, name) {
  const m = body.match(new RegExp(`--${name}\\s*:\\s*${VALUE_RE};`));
  return m ? m[1].trim() : null;
}

// Replaces an existing `--name: value;` declaration's value in place, or
// (when the base doesn't define that token) inserts a new declaration right
// before the block's closing whitespace, matching the base's 2-space indent.
// A same-line comment after a replaced value described the style's color
// ("ink navy") and would now describe the wrong one, so it goes too.
function setToken(body, name, value) {
  const re = new RegExp(`(--${name}\\s*:\\s*)${VALUE_RE}(;)([ \\t]*\\/\\*[^\\n]*?\\*\\/)?`);
  if (re.test(body)) return body.replace(re, (_m, pre, _old, semi) => `${pre}${value}${semi}`);
  // Match the block's own per-declaration indent (a block nested inside
  // @media is indented one level deeper than :root) rather than assuming 2
  // spaces everywhere.
  const indentMatch = body.match(/\n([ \t]+)--[\w-]/);
  const indent = indentMatch ? indentMatch[1] : '  ';
  const trimmedEnd = body.replace(/\s*$/, '');
  const trailing = body.slice(trimmedEnd.length) || '\n';
  return `${trimmedEnd}\n${indent}--${name}: ${value};${trailing}`;
}

// Drops a declaration (and a same-line comment after it) from a block.
function removeToken(body, name) {
  return body.replace(new RegExp(`\\n[ \\t]*--${name}\\s*:\\s*${VALUE_RE};[ \\t]*(?:\\/\\*[^\\n]*?\\*\\/)?`, 'g'), '');
}

const LOGO_TOKENS = ['brand-logo', 'brand-logo-mask', 'brand-logo-color', 'brand-logo-dark', 'brand-logo-on', 'brand-logo-plate', 'brand-logo-ratio'];

function applyOverrides(body, overrides) {
  let out = body;
  for (const [name, value] of overrides) out = setToken(out, name, value);
  return out;
}

// Any base sidebar-* token whose base value equalled its non-sidebar
// counterpart (the corporate base defines sidebar-primary == primary, etc.)
// keeps mirroring that counterpart's NEW value — a convention read off the
// base file itself, not hardcoded to any one style.
const SIDEBAR_MIRRORS = [
  ['sidebar-foreground', 'foreground'],
  ['sidebar-primary', 'primary'],
  ['sidebar-primary-foreground', 'primary-foreground'],
  ['sidebar-accent', 'accent'],
  ['sidebar-accent-foreground', 'accent-foreground'],
  ['sidebar-ring', 'ring'],
  ['sidebar-border', 'border'],
];

function withSidebarMirrors(originalBody, overrides) {
  const extra = [];
  const overrideMap = new Map(overrides);
  for (const [sidebarName, mainName] of SIDEBAR_MIRRORS) {
    if (!overrideMap.has(mainName)) continue;
    const baseSidebarVal = getToken(originalBody, sidebarName);
    const baseMainVal = getToken(originalBody, mainName);
    if (baseSidebarVal != null && baseMainVal != null && baseSidebarVal === baseMainVal) {
      extra.push([sidebarName, overrideMap.get(mainName)]);
    }
  }
  return [...overrides, ...extra];
}

// ---------------------------------------------------------------------------
// font stack composition
// ---------------------------------------------------------------------------

const quoteFamily = (name) => (/[\s,]/.test(name) ? `"${name}"` : name);
const unquote = (s) => s.trim().replace(/^["']|["']$/g, '').trim();
const splitStack = (value) => value.split(',').map((p) => p.trim()).filter(Boolean);

// "--font-heading "Poppins, sans-serif"": the first entry is the family,
// anything after it is the agent's own fallback, and a trailing generic
// family keyword is the category the fallback must stay in.
function parseFamilyArg(value) {
  const parts = splitStack(value).map(unquote);
  const family = parts[0];
  const rest = parts.slice(1);
  const category = rest.length && GENERIC_FAMILIES.has(rest[rest.length - 1].toLowerCase())
    ? rest[rest.length - 1].toLowerCase()
    : null;
  return { family, extra: category ? rest.slice(0, -1) : rest, category };
}

// "<family>", <fallback> — the new family leads, followed by a fallback
// stack from the base style (a declared stack minus its own first entry,
// which the new family replaces). With a category, the fallback comes from
// whichever base stack ends in that category, so a sans heading never falls
// back to the style's serif display face (Poppins → Georgia → serif).
function composeFontStack(defaultBase, spec, baseStacks) {
  let base = defaultBase;
  if (spec.category) {
    const endsIn = (s) => {
      const parts = splitStack(s);
      return parts[parts.length - 1]?.toLowerCase() === spec.category;
    };
    base = endsIn(defaultBase) ? defaultBase : baseStacks.find(endsIn) || null;
  }
  const fallback = base ? splitStack(base).slice(1) : [];
  const out = [];
  const seen = new Set();
  for (const item of [quoteFamily(spec.family), ...spec.extra.map(quoteFamily), ...fallback, ...(spec.category ? [spec.category] : [])]) {
    const key = unquote(item).toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(item);
  }
  return out.join(', ');
}

// ---------------------------------------------------------------------------
// font embedding
// ---------------------------------------------------------------------------

const b64len = (bytes) => 4 * Math.ceil(bytes / 3);

async function fetchWithTimeout(url, ms) {
  return fetch(url, { headers: { 'User-Agent': BROWSER_UA }, signal: AbortSignal.timeout(ms) });
}

function googleCssUrl(family, weights) {
  const fam = encodeURIComponent(family).replace(/%20/g, '+');
  return `${FONTS_API}?family=${fam}:wght@${weights.join(';')}&display=swap`;
}

// Parses the css2 response into faces: one per /* subset */ @font-face block.
function parseGoogleCss(css) {
  const faces = [];
  const re = /\/\*\s*([\w-]+)\s*\*\/\s*@font-face\s*\{([^}]*)\}/g;
  let m;
  while ((m = re.exec(css))) {
    const body = m[2];
    const prop = (name) => (new RegExp(`${name}\\s*:\\s*([^;]+);`).exec(body) || [])[1]?.trim() || null;
    const url = (/src\s*:\s*url\(\s*["']?([^"')]+)["']?\s*\)/.exec(body) || [])[1];
    if (!url) continue;
    faces.push({
      subset: m[1],
      style: prop('font-style') || 'normal',
      weight: Number(prop('font-weight')) || 400,
      unicodeRange: prop('unicode-range'),
      url,
    });
  }
  return faces;
}

// Fetches the css2 stylesheet for a family. A family that lacks one of the
// weights makes the whole request fail with 400, so a failed combined
// request is retried weight by weight and whatever exists is kept.
async function googleFaces(family, weights) {
  const attempt = async (ws) => {
    const res = await fetchWithTimeout(googleCssUrl(family, ws), 10000);
    if (!res.ok) return { status: res.status, faces: [] };
    return { status: res.status, faces: parseGoogleCss(await res.text()) };
  };
  let first;
  try {
    first = await attempt(weights);
  } catch (e) {
    return { faces: [], reason: `network: ${e.cause?.code || e.name || e.message}` };
  }
  if (first.faces.length) return { faces: first.faces };
  if (weights.length > 1) {
    const faces = [];
    for (const w of weights) {
      try {
        faces.push(...(await attempt([w])).faces);
      } catch {
        // one weight failing to arrive is the same as it not existing
      }
    }
    if (faces.length) return { faces };
  }
  return {
    faces: [],
    reason: first.status === 400 || first.status === 404 ? `not on Google Fonts (HTTP ${first.status})` : `Google Fonts answered HTTP ${first.status}`,
  };
}

async function download(url) {
  const res = await fetchWithTimeout(url, 20000);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return Buffer.from(await res.arrayBuffer());
}

// ---- reading a local font file's weight and style ----------------------------

const WOFF2_TAGS = ['cmap', 'head', 'hhea', 'hmtx', 'maxp', 'name', 'OS/2', 'post', 'cvt ', 'fpgm', 'glyf', 'loca', 'prep', 'CFF ', 'VORG', 'EBDT', 'EBLC', 'gasp', 'hdmx', 'kern', 'LTSH', 'PCLT', 'VDMX', 'vhea', 'vmtx', 'BASE', 'GDEF', 'GPOS', 'GSUB', 'EBSC', 'JSTF', 'MATH', 'CBDT', 'CBLC', 'COLR', 'CPAL', 'SVG ', 'sbix', 'acnt', 'avar', 'bdat', 'bloc', 'bsln', 'cvar', 'fdsc', 'feat', 'fmtx', 'fvar', 'gvar', 'hsty', 'just', 'lcar', 'mort', 'morx', 'opbd', 'prop', 'trak', 'Zapf', 'Silf', 'Glat', 'Gloc', 'Feat', 'Sill'];

function readBase128(buf, pos) {
  let v = 0;
  for (let i = 0; i < 5; i++) {
    const b = buf[pos.p++];
    v = v * 128 + (b & 0x7f);
    if (!(b & 0x80)) return v;
  }
  throw new Error('bad UIntBase128');
}

// Returns { 'OS/2': Buffer, fvar: Buffer } (whichever exist) for woff2,
// woff and plain TrueType/OpenType files.
function fontTables(buf, wanted) {
  const sig = buf.toString('latin1', 0, 4);
  const out = {};
  if (sig === 'wOF2') {
    const n = buf.readUInt16BE(12);
    const pos = { p: 48 };
    const dir = [];
    for (let i = 0; i < n; i++) {
      const flags = buf[pos.p++];
      let tag;
      if ((flags & 63) === 63) {
        tag = buf.toString('latin1', pos.p, pos.p + 4);
        pos.p += 4;
      } else tag = WOFF2_TAGS[flags & 63];
      const version = (flags >> 6) & 3;
      const origLength = readBase128(buf, pos);
      const transformed = tag === 'glyf' || tag === 'loca' ? version === 0 : version !== 0;
      dir.push({ tag, length: transformed ? readBase128(buf, pos) : origLength });
    }
    const data = brotliDecompressSync(buf.subarray(pos.p, pos.p + buf.readUInt32BE(20)));
    let off = 0;
    for (const d of dir) {
      if (wanted.includes(d.tag)) out[d.tag] = data.subarray(off, off + d.length);
      off += d.length;
    }
    return out;
  }
  if (sig === 'wOFF') {
    const n = buf.readUInt16BE(12);
    for (let i = 0; i < n; i++) {
      const e = 44 + i * 20;
      const tag = buf.toString('latin1', e, e + 4);
      if (!wanted.includes(tag)) continue;
      const offset = buf.readUInt32BE(e + 4);
      const compLength = buf.readUInt32BE(e + 8);
      const origLength = buf.readUInt32BE(e + 12);
      const raw = buf.subarray(offset, offset + compLength);
      out[tag] = compLength < origLength ? inflateSync(raw) : raw;
    }
    return out;
  }
  const n = buf.readUInt16BE(4);
  for (let i = 0; i < n; i++) {
    const e = 12 + i * 16;
    const tag = buf.toString('latin1', e, e + 4);
    if (wanted.includes(tag)) out[tag] = buf.subarray(buf.readUInt32BE(e + 8), buf.readUInt32BE(e + 8) + buf.readUInt32BE(e + 12));
  }
  return out;
}

function fontFormat(buf) {
  const sig = buf.toString('latin1', 0, 4);
  if (sig === 'wOF2') return { mime: 'font/woff2', format: 'woff2' };
  if (sig === 'wOFF') return { mime: 'font/woff', format: 'woff' };
  if (sig === 'OTTO') return { mime: 'font/otf', format: 'opentype' };
  if (buf.readUInt32BE(0) === 0x00010000 || sig === 'true') return { mime: 'font/ttf', format: 'truetype' };
  return null;
}

// A variable font declares its wght axis range; a static one its
// usWeightClass. The italic bit in fsSelection decides font-style.
function fontFileFacts(buf) {
  const t = fontTables(buf, ['OS/2', 'fvar']);
  let weight = null;
  let italic = false;
  if (t['OS/2'] && t['OS/2'].length >= 64) {
    const w = t['OS/2'].readUInt16BE(4);
    if (w >= 1 && w <= 1000) weight = String(w);
    italic = (t['OS/2'].readUInt16BE(62) & 1) === 1;
  }
  if (t.fvar && t.fvar.length >= 16) {
    const f = t.fvar;
    const axesOffset = f.readUInt16BE(4);
    const count = f.readUInt16BE(8);
    const size = f.readUInt16BE(10);
    for (let i = 0; i < count; i++) {
      const a = axesOffset + i * size;
      if (a + 16 > f.length) break;
      if (f.toString('latin1', a, a + 4) === 'wght') {
        weight = `${Math.round(f.readInt32BE(a + 4) / 65536)} ${Math.round(f.readInt32BE(a + 12) / 65536)}`;
      }
    }
  }
  return { weight, italic };
}

function weightRange(weights) {
  const ws = [...weights].sort((a, b) => a - b);
  return ws.length === 1 ? String(ws[0]) : `${ws[0]} ${ws[ws.length - 1]}`;
}

function fontFaceCss(face) {
  return [
    `/* ${face.family}${face.subset ? ` ${face.subset}` : ''} */`,
    '@font-face {',
    `  font-family: "${face.family}";`,
    `  font-style: ${face.style};`,
    `  font-weight: ${face.weight};`,
    '  font-display: swap;',
    `  src: url("data:${face.mime};base64,${face.base64}") format("${face.format}");`,
    ...(face.unicodeRange ? [`  unicode-range: ${face.unicodeRange};`] : []),
    '}',
  ].join('\n');
}

// Collects the @font-face rules for every family in `families`
// ({ family, roles }), from --font-file entries first and Google Fonts
// otherwise. Never throws: a family that cannot be embedded is reported.
async function embedFonts({ families, headingWeight, lang, fontFiles, warn }) {
  const subsets = !lang || lang.toLowerCase() !== 'en' ? ['latin', 'latin-ext'] : ['latin'];
  const baseWeights = [400, 700];
  const wanted = [...new Set([...baseWeights, headingWeight].filter(Boolean))].sort((a, b) => a - b);
  const extraWeights = wanted.filter((w) => !baseWeights.includes(w));
  const report = [];
  let faces = [];

  await Promise.all(families.map(async ({ family, roles }) => {
    const entry = { family, roles, source: null, embedded: false, reason: null, bytes: 0, weights: [], subsets: [] };
    report.push(entry);
    if (GENERIC_FAMILIES.has(family.toLowerCase())) {
      entry.reason = 'generic family, nothing to embed';
      return;
    }
    const files = fontFiles.filter((f) => f.family.toLowerCase() === family.toLowerCase());
    if (files.length) {
      entry.source = 'file';
      for (const f of files) {
        let buf;
        try {
          buf = readFileSync(resolvePath(process.cwd(), f.path));
        } catch (e) {
          entry.reason = `cannot read ${f.path}: ${e.code || e.message}`;
          continue;
        }
        const fmt = fontFormat(buf);
        if (!fmt) {
          entry.reason = `${basename(f.path)} is not a woff2, woff, ttf or otf file`;
          continue;
        }
        let facts = { weight: null, italic: false };
        try {
          facts = fontFileFacts(buf);
        } catch {
          // unreadable tables: fall back to the declared or default weight
        }
        const weight = f.weight || facts.weight || '400';
        if (!f.weight && !facts.weight) warn(`${basename(f.path)}: could not read its weight; declared as 400 (name it with --font-file "${family}:<weight>=...")`);
        faces.push({ family, subset: null, style: facts.italic ? 'italic' : 'normal', weight, unicodeRange: null, ...fmt, base64: buf.toString('base64'), bytes: buf.length, weightsCovered: null });
      }
      return;
    }
    entry.source = 'google-fonts';
    const got = await googleFaces(family, wanted);
    if (!got.faces.length) {
      entry.reason = got.reason;
      return;
    }
    // One file often serves several weights (variable fonts): dedupe by URL
    // and declare the weight range the file actually covers.
    const byUrl = new Map();
    for (const f of got.faces) {
      if (f.style !== 'normal' || !subsets.includes(f.subset)) continue;
      const cur = byUrl.get(f.url) || { family, subset: f.subset, style: f.style, unicodeRange: f.unicodeRange, url: f.url, weightsCovered: new Set() };
      cur.weightsCovered.add(f.weight);
      byUrl.set(f.url, cur);
    }
    if (!byUrl.size) {
      entry.reason = `no ${subsets.join('/')} subset in the Google Fonts answer`;
      return;
    }
    try {
      await Promise.all([...byUrl.values()].map(async (face) => {
        const buf = await download(face.url);
        faces.push({ ...face, weight: weightRange(face.weightsCovered), mime: 'font/woff2', format: 'woff2', base64: buf.toString('base64'), bytes: buf.length });
      }));
    } catch (e) {
      faces = faces.filter((f) => f.family !== family);
      entry.reason = `download failed: ${e.cause?.code || e.message}`;
    }
  }));

  let total = faces.reduce((n, f) => n + f.base64.length, 0);
  if (total > FONT_BUDGET_BASE64_BYTES && extraWeights.length) {
    // First thing to go: files that exist only for the heading weight.
    const before = faces.length;
    faces = faces.filter((f) => !f.weightsCovered || [...f.weightsCovered].some((w) => baseWeights.includes(w)));
    if (faces.length < before) {
      total = faces.reduce((n, f) => n + f.base64.length, 0);
      warn(`embedded fonts were over ${Math.round(FONT_BUDGET_BASE64_BYTES / 1024)} KB; dropped the heading weight ${extraWeights.join(', ')} (headings fall back to the nearest embedded weight)`);
    }
  }
  if (total > FONT_BUDGET_BASE64_BYTES) {
    warn(`embedded fonts come to ${Math.round(total / 1024)} KB, over the ${Math.round(FONT_BUDGET_BASE64_BYTES / 1024)} KB budget; every document carries them`);
  }

  for (const entry of report) {
    const mine = faces.filter((f) => f.family === entry.family);
    if (mine.length) {
      entry.embedded = true;
      entry.reason = null;
      entry.bytes = mine.reduce((n, f) => n + f.bytes, 0);
      const ws = new Set();
      for (const f of mine) {
        if (f.weightsCovered) f.weightsCovered.forEach((w) => ws.add(w));
        else ws.add(f.weight);
      }
      entry.weights = [...ws].sort((a, b) => String(a).localeCompare(String(b), 'en', { numeric: true }));
      entry.subsets = [...new Set(mine.map((f) => f.subset).filter(Boolean))];
    } else if (!entry.reason) {
      entry.reason = 'nothing embedded';
    }
    if (!entry.embedded) warn(`font "${entry.family}" not embedded: ${entry.reason}`);
  }

  const order = (f) => `${f.family}\u0000${String(f.weight).padStart(7, '0')}\u0000${f.subset === 'latin' ? 'z' : f.subset || ''}`;
  faces.sort((a, b) => order(a).localeCompare(order(b)));
  const css = faces.length ? `${FONTS_BEGIN}\n${faces.map(fontFaceCss).join('\n')}\n${FONTS_END}\n` : '';
  return { css, report: report.sort((a, b) => families.findIndex((f) => f.family === a.family) - families.findIndex((f) => f.family === b.family)), base64Bytes: total };
}

function stripFontsSection(css) {
  const start = css.indexOf(FONTS_BEGIN);
  if (start === -1) return css;
  const end = css.indexOf(FONTS_END, start);
  if (end === -1) return css;
  return css.slice(0, start) + css.slice(end + FONTS_END.length).replace(/^\n+/, '');
}

// ---------------------------------------------------------------------------
// header comment
// ---------------------------------------------------------------------------

// The base style's header says what the style is ("Reference style ... not
// a brand"); left in a brand's tokens.css it tells the next reader the
// opposite of the truth. The replacement names the brand and its source.
function brandHeader({ outPath, styleSlug }) {
  const today = new Date().toISOString().slice(0, 10);
  let meta = null;
  const metaPath = join(dirname(outPath), 'profile.meta.json');
  if (existsSync(metaPath)) {
    try {
      meta = JSON.parse(readFileSync(metaPath, 'utf8'));
    } catch {
      meta = null;
    }
  }
  const name = meta?.fields?.name?.value || meta?.name || null;
  const slug = meta?.brand || null;
  const source = (meta?.sources || []).find((s) => s && s.ref && s.type !== 'interview' && s.type !== 'owner')?.ref || null;
  const collected = typeof meta?.collectedAt === 'string' ? meta.collectedAt.slice(0, 10) : null;
  const clean = (s) => String(s).replace(/\*\//g, '* /');
  const lines = [];
  lines.push(name ? ` * ${clean(name)}: brand tokens${slug ? ` (profile "${clean(slug)}")` : ''}.` : ' * Brand tokens.');
  if (source) lines.push(` * Source: ${clean(source)}${collected ? `, collected ${collected}` : ''}.`);
  lines.push(` * Built ${today} on the "${clean(styleSlug)}" base style: colors, fonts and logo`);
  lines.push(' * are the brand\'s; spacing, radii, motion and the rest come from the style.');
  lines.push(' * Generated file; regenerate it instead of editing it.');
  return `/**\n${lines.join('\n')}\n */`;
}

// ---------------------------------------------------------------------------
// logo embedding
// ---------------------------------------------------------------------------

function detectImageMime(buf, filePath) {
  if (buf.length >= 8 && buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47) return 'image/png';
  if (buf.length >= 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return 'image/jpeg';
  const head = buf.subarray(0, Math.min(buf.length, 512)).toString('utf8');
  if (/<svg[\s>]/i.test(head) || /<\?xml/i.test(head)) return 'image/svg+xml';
  const ext = (filePath.match(/\.([a-z0-9]+)$/i) || [])[1]?.toLowerCase();
  if (ext === 'png') return 'image/png';
  if (ext === 'jpg' || ext === 'jpeg') return 'image/jpeg';
  if (ext === 'svg') return 'image/svg+xml';
  return null;
}

// ---------------------------------------------------------------------------
// logo tint: recolor single-color artwork, keep alpha
// ---------------------------------------------------------------------------

class TintError extends Error {}

// Opaque-enough pixels must all sit within this per-channel distance of the
// dominant color for the artwork to count as single-color. Anti-aliased
// edges are judged by their color, not their alpha, so they pass.
const TINT_TOLERANCE = 48;
const TINT_ALPHA_FLOOR = 128;
const TINT_OUTLIER_SHARE = 0.02;

function singleColorShare(colors) {
  const mean = [0, 1, 2].map((k) => colors.reduce((sum, c) => sum + c[k], 0) / colors.length);
  const outliers = colors.filter((c) => c.some((v, k) => Math.abs(v - mean[k]) > TINT_TOLERANCE)).length;
  return { mean, outlierShare: outliers / colors.length };
}

const MULTI_COLOR_MESSAGE = 'the artwork has more than one color, so recoloring would flatten it; run without --logo-tint (it keeps its colors and gets a light plate in dark mode), and add --logo-on dark if the artwork is light';

function assertSingleColor(colors) {
  // colors: array of [r, g, b] from pixels/entries that actually paint.
  if (colors.length === 0) throw new TintError('the artwork has no visible pixels');
  if (singleColorShare(colors).outlierShare > TINT_OUTLIER_SHARE) throw new TintError(MULTI_COLOR_MESSAGE);
}

// zlib.crc32 only exists from Node 20.15/22.2; the skill runs on Node 18.
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

function pngChunks(buf) {
  const chunks = [];
  let off = 8;
  while (off + 8 <= buf.length) {
    const len = buf.readUInt32BE(off);
    const type = buf.toString('ascii', off + 4, off + 8);
    chunks.push({ type, data: buf.subarray(off + 8, off + 8 + len) });
    if (type === 'IEND') break;
    off += 12 + len;
  }
  return chunks;
}

function pngChunk(type, data) {
  const out = Buffer.alloc(12 + data.length);
  out.writeUInt32BE(data.length, 0);
  out.write(type, 4, 'ascii');
  data.copy(out, 8);
  out.writeUInt32BE(crc32(out.subarray(4, 8 + data.length)) >>> 0, 8 + data.length);
  return out;
}

function unfilter(raw, width, height, bpp) {
  const stride = width * bpp;
  const pixels = Buffer.alloc(stride * height);
  for (let y = 0; y < height; y++) {
    const type = raw[y * (stride + 1)];
    const src = raw.subarray(y * (stride + 1) + 1, (y + 1) * (stride + 1));
    const row = pixels.subarray(y * stride, (y + 1) * stride);
    const prev = y > 0 ? pixels.subarray((y - 1) * stride, y * stride) : null;
    for (let i = 0; i < stride; i++) {
      const a = i >= bpp ? row[i - bpp] : 0;
      const b = prev ? prev[i] : 0;
      const c = prev && i >= bpp ? prev[i - bpp] : 0;
      let pred = 0;
      if (type === 1) pred = a;
      else if (type === 2) pred = b;
      else if (type === 3) pred = (a + b) >> 1;
      else if (type === 4) {
        const p = a + b - c;
        const pa = Math.abs(p - a);
        const pb = Math.abs(p - b);
        const pc = Math.abs(p - c);
        pred = pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
      }
      row[i] = (src[i] + pred) & 0xff;
    }
  }
  return pixels;
}

// Decodes the PNG shapes the tint path understands: a palette with
// transparency, or 8-bit gray+alpha / RGBA, not interlaced. `painted` holds
// the colors of the entries or pixels that actually paint.
function decodePng(buf) {
  const chunks = pngChunks(buf);
  const ihdr = chunks.find((c) => c.type === 'IHDR')?.data;
  if (!ihdr) throw new TintError('not a readable PNG');
  const width = ihdr.readUInt32BE(0);
  const height = ihdr.readUInt32BE(4);
  const [bitDepth, colorType, , , interlace] = [ihdr[8], ihdr[9], ihdr[10], ihdr[11], ihdr[12]];

  if (colorType === 3) {
    const plte = chunks.find((c) => c.type === 'PLTE')?.data;
    const trns = chunks.find((c) => c.type === 'tRNS')?.data;
    if (!plte || !trns) throw new TintError('the PNG has no transparency, so there is no shape to recolor');
    const painted = [];
    for (let i = 0; i + 2 < plte.length; i += 3) {
      const alpha = i / 3 < trns.length ? trns[i / 3] : 255;
      if (alpha >= TINT_ALPHA_FLOOR) painted.push([plte[i], plte[i + 1], plte[i + 2]]);
    }
    return { kind: 'palette', width, height, painted };
  }

  if ((colorType !== 6 && colorType !== 4) || bitDepth !== 8 || interlace !== 0) {
    throw new TintError('only PNGs with an alpha channel (8-bit, not interlaced) or a palette with transparency can be recolored');
  }
  const bpp = colorType === 6 ? 4 : 2;
  const raw = inflateSync(Buffer.concat(chunks.filter((c) => c.type === 'IDAT').map((c) => c.data)));
  const pixels = unfilter(raw, width, height, bpp);
  const painted = [];
  for (let o = 0; o < pixels.length; o += bpp) {
    if (pixels[o + bpp - 1] < TINT_ALPHA_FLOOR) continue;
    painted.push(bpp === 4 ? [pixels[o], pixels[o + 1], pixels[o + 2]] : [pixels[o], pixels[o], pixels[o]]);
  }
  return { kind: 'alpha', width, height, bpp, pixels, ihdr, painted };
}

function tintPng(buf, [R, G, B]) {
  const png = decodePng(buf);
  assertSingleColor(png.painted);

  if (png.kind === 'palette') {
    // Palette: recolor the entries, keep indices and transparency as they are.
    const out = Buffer.from(buf);
    let off = 8;
    while (off + 8 <= out.length) {
      const len = out.readUInt32BE(off);
      const type = out.toString('ascii', off + 4, off + 8);
      if (type === 'PLTE') {
        for (let i = 0; i + 2 < len; i += 3) {
          out[off + 8 + i] = R;
          out[off + 9 + i] = G;
          out[off + 10 + i] = B;
        }
        out.writeUInt32BE(crc32(out.subarray(off + 4, off + 8 + len)) >>> 0, off + 8 + len);
      }
      if (type === 'IEND') break;
      off += 12 + len;
    }
    return out;
  }

  const { width, height, bpp, pixels, ihdr } = png;
  // Re-encode as 8-bit RGBA, filter 0 on every row.
  const outRaw = Buffer.alloc(height * (width * 4 + 1));
  for (let y = 0; y < height; y++) {
    const rowOut = y * (width * 4 + 1);
    for (let x = 0; x < width; x++) {
      const o = (y * width + x) * bpp;
      const d = rowOut + 1 + x * 4;
      outRaw[d] = R;
      outRaw[d + 1] = G;
      outRaw[d + 2] = B;
      outRaw[d + 3] = pixels[o + bpp - 1];
    }
  }
  const newIhdr = Buffer.from(ihdr);
  newIhdr[8] = 8;
  newIhdr[9] = 6;
  return Buffer.concat([
    buf.subarray(0, 8),
    pngChunk('IHDR', newIhdr),
    pngChunk('IDAT', deflateSync(outRaw, { level: 9 })),
    pngChunk('IEND', Buffer.alloc(0)),
  ]);
}

const SVG_COLOR_RE = /((?:fill|stroke|stop-color|color)\s*(?:=\s*["']|:\s*))\s*(#[0-9a-f]{3,8}\b|rgba?\([^)]*\)|white|black)/gi;

// The colors an SVG paints with. No explicit color at all means everything
// paints in the default black.
function svgColors(text) {
  const found = [...text.matchAll(SVG_COLOR_RE)].map((m) => {
    const rgb = toRgb(parse(m[2].toLowerCase()));
    return rgb ? [rgb.r * 255, rgb.g * 255, rgb.b * 255] : null;
  });
  if (found.some((c) => c === null)) throw new TintError('the SVG uses a color this script cannot read');
  if (/\b(?:fill|stroke)\s*[:=]\s*["']?\s*url\(/i.test(text)) {
    throw new TintError('the SVG uses gradients or patterns; recoloring would flatten it');
  }
  return found.length ? found : [[0, 0, 0]];
}

function tintSvg(text, hex) {
  const found = svgColors(text);
  if (![...text.matchAll(SVG_COLOR_RE)].length) {
    // No explicit color: everything paints in the default black, so a fill
    // on the root element recolors all of it.
    return text.replace(/<svg\b/i, `<svg fill="${hex}"`);
  }
  assertSingleColor(found);
  return text.replace(SVG_COLOR_RE, (_, prefix) => `${prefix}${hex}`);
}

// What the artwork is made of, read without recoloring it: whether it is
// one color (the same test --logo-tint applies), that color, and whether it
// is light, i.e. mostly near-white and so invisible on paper.
function analyzeArtwork(logo) {
  const buf = Buffer.from(logo.base64, 'base64');
  let colors;
  try {
    if (logo.mime === 'image/png') colors = decodePng(buf).painted;
    else if (logo.mime === 'image/svg+xml') colors = svgColors(buf.toString('utf8'));
    else throw new TintError('a JPG has no transparency, so there is no shape to recolor');
  } catch (e) {
    if (!(e instanceof TintError)) throw e;
    return { readable: false, single: false, color: null, light: null, reason: e.message };
  }
  if (colors.length === 0) return { readable: true, single: false, color: null, light: null, reason: 'the artwork has no visible pixels' };
  const { mean, outlierShare } = singleColorShare(colors);
  const lightShare = colors.filter((c) => wcagContrast({ mode: 'rgb', r: c[0] / 255, g: c[1] / 255, b: c[2] / 255 }, '#ffffff') < 2).length / colors.length;
  return {
    readable: true,
    single: outlierShare <= TINT_OUTLIER_SHARE,
    color: toOklch({ mode: 'rgb', r: mean[0] / 255, g: mean[1] / 255, b: mean[2] / 255 }),
    light: lightShare >= 0.6,
    reason: outlierShare <= TINT_OUTLIER_SHARE ? null : 'the artwork has more than one color',
  };
}

// Width over height of the artwork as a browser sizes it: PNG IHDR, JPEG
// SOF, SVG width/height when both are plain lengths, else its viewBox.
// Documents size the logo box from this instead of decoding the image.
function logoRatio(logo) {
  const buf = Buffer.from(logo.base64, 'base64');
  let w = null;
  let h = null;
  if (logo.mime === 'image/png' && buf.length >= 24) {
    w = buf.readUInt32BE(16);
    h = buf.readUInt32BE(20);
  } else if (logo.mime === 'image/svg+xml') {
    const open = /<svg\b[^>]*>/i.exec(buf.toString('utf8', 0, Math.min(buf.length, 8192)))?.[0] || '';
    const len = (name) => {
      const m = new RegExp(`\\s${name}\\s*=\\s*["']\\s*([\\d.]+)\\s*(px)?\\s*["']`, 'i').exec(open);
      return m ? Number(m[1]) : null;
    };
    const vb = /viewBox\s*=\s*["']\s*[-\d.]+[\s,]+[-\d.]+[\s,]+([\d.]+)[\s,]+([\d.]+)/i.exec(open);
    if (len('width') > 0 && len('height') > 0) {
      w = len('width');
      h = len('height');
    } else if (vb) {
      w = Number(vb[1]);
      h = Number(vb[2]);
    }
  } else if (logo.mime === 'image/jpeg') {
    let o = 2;
    while (o + 9 < buf.length && buf[o] === 0xff) {
      const marker = buf[o + 1];
      if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) {
        h = buf.readUInt16BE(o + 5);
        w = buf.readUInt16BE(o + 7);
        break;
      }
      o += 2 + buf.readUInt16BE(o + 2);
    }
  }
  if (!(w > 0 && h > 0)) return null;
  return Math.round((w / h) * 10000) / 10000;
}

function tintLogo(logo, color) {
  const hex = formatHex(color);
  const rgb = toRgb(color);
  const buf = Buffer.from(logo.base64, 'base64');
  let out;
  if (logo.mime === 'image/png') {
    out = tintPng(buf, [rgb.r, rgb.g, rgb.b].map((v) => Math.round(Math.min(1, Math.max(0, v)) * 255)));
  } else if (logo.mime === 'image/svg+xml') {
    out = Buffer.from(tintSvg(buf.toString('utf8'), hex), 'utf8');
  } else {
    throw new TintError('a JPG has no transparency, so there is no shape to recolor');
  }
  return { ...logo, base64: out.toString('base64'), bytes: out.length, tint: hex };
}

// Reads, base64-encodes and size-caps the logo. Returns null (with a warning
// on stderr) rather than throwing when the file can't be embedded — a
// missing/oversized logo should never abort the rest of the run.
function loadLogo(filePath, warn) {
  let buf;
  try {
    buf = readFileSync(resolvePath(process.cwd(), filePath));
  } catch (e) {
    warn(`cannot read --logo file: ${e.message} — skipping --brand-logo`);
    return null;
  }
  const mime = detectImageMime(buf, filePath);
  if (!mime) {
    warn(`--logo file is not a recognizable png/svg/jpg — skipping --brand-logo`);
    return null;
  }
  const base64 = buf.toString('base64');
  if (base64.length > MAX_LOGO_BASE64_BYTES) {
    warn(
      `--logo encodes to ${Math.round(base64.length / 1024)}KB (base64), over the ${Math.round(MAX_LOGO_BASE64_BYTES / 1024)}KB cap — skipping --brand-logo`
    );
    return null;
  }
  return { mime, base64, bytes: buf.length, isPng: mime === 'image/png' };
}

// ---------------------------------------------------------------------------
// main
// ---------------------------------------------------------------------------

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const warnings = [];
  const warn = (msg) => {
    warnings.push(msg);
    console.error(`warning: ${msg}`);
  };

  let baseCss;
  try {
    baseCss = readFileSync(resolvePath(process.cwd(), args.style), 'utf8');
  } catch (e) {
    console.error(`cannot read --style file: ${e.message}`);
    process.exit(1);
  }
  // A previous run's output passed back in as --style: its font section is
  // rebuilt below, not carried over twice.
  if (args.embedFonts) baseCss = stripFontsSection(baseCss);

  let spans;
  try {
    spans = locateThemeBlocks(baseCss);
  } catch (e) {
    console.error(`cannot parse --style file: ${e.message}`);
    process.exit(1);
  }

  let lightBodyOrig = baseCss.slice(spans.light.bodyStart, spans.light.bodyEnd);
  let darkBodyOrig = baseCss.slice(spans.darkExplicit.bodyStart, spans.darkExplicit.bodyEnd);
  let darkOsBodyOrig = baseCss.slice(spans.darkOs.bodyStart, spans.darkOs.bodyEnd);

  // ---- primary / derived colors -------------------------------------------------

  const primaryLight = parseColorArg(args.primary, '--primary');
  const primaryForegroundLight = pickInkForFill(primaryLight);

  // The brand's own accent (a named secondary color, or the logo's second
  // color) when --accent names one; otherwise a light tint of the primary.
  // Light theme: the color as given (chroma clamped only if an oklch()
  // input leaves sRGB). Dark themes: the same hue as a dark, low-chroma
  // fill, because the pastel itself would glare on a dark page.
  let accentArg = null;
  if (args.accent) {
    const given = parseColorArg(args.accent, '--accent');
    const h = Number.isFinite(given.h) ? given.h : primaryLight.h;
    accentArg = quantize(clampChromaToGamut(given.l, given.c || 0, h));
    if ((given.c || 0) - accentArg.c > 0.002) warn(`--accent ${args.accent} is outside sRGB; chroma lowered to ${round3(accentArg.c)}`);
  }
  const accentLight = accentArg || clampChromaToGamut(0.95, 0.05, primaryLight.h);
  const accentDark = accentArg
    ? quantize(clampChromaToGamut(0.3, Math.min(accentArg.c, 0.05), accentArg.h))
    : clampChromaToGamut(0.25, 0.05, primaryLight.h);

  const foregroundLight = args.foreground ? parseColorArg(args.foreground, '--foreground') : null;
  const backgroundLight = args.background ? parseColorArg(args.background, '--background') : null;

  const foregroundLightRaw = foregroundLight ? formatOklch(foregroundLight) : getToken(lightBodyOrig, 'foreground');
  const foregroundDarkRaw = getToken(darkBodyOrig, 'foreground'); // dark foreground stays the base's own

  // --accent-foreground is the block's own foreground whenever it reads on
  // the accent at 4.5:1; a brand accent dark enough to fail gets its ink
  // re-picked (white or near-black) instead of unreadable text on a fill.
  // Without --accent the derived tint keeps the block's foreground as before.
  const accentInk = (fill, fgRaw) => {
    const parsed = fgRaw ? parse(fgRaw) : null;
    const fg = parsed ? toOklch(parsed) : null;
    if (!accentArg || (fg && contrastOklch(fg, fill) >= 4.5)) return { raw: fgRaw, color: fg, repicked: false };
    const ink = pickInkForFill(fill);
    return { raw: formatOklch(ink), color: ink, repicked: true };
  };
  const accentForegroundLight = accentInk(accentLight, foregroundLightRaw);
  const accentForegroundDark = accentInk(accentDark, foregroundDarkRaw);
  if (accentArg && accentForegroundLight.repicked) {
    warn(`the block's text color does not reach 4.5:1 on --accent ${args.accent}; --accent-foreground is ${accentForegroundLight.raw} instead`);
  }

  const backgroundLightForContrast = backgroundLight || toOklch(parse(getToken(lightBodyOrig, 'background') || 'oklch(1 0 0)'));
  const backgroundDarkForContrast = toOklch(parse(getToken(darkBodyOrig, 'background') || 'oklch(0.2 0 0)'));

  // Dark theme: the brand color as it is when it reads on the dark page,
  // lifted just enough when it does not; the ink is the same hue at full
  // chroma, as dark as 4.5:1 allows.
  const primaryDark = computeDarkPrimary(primaryLight, backgroundDarkForContrast);
  const primaryForegroundDark = pickInkForFill(primaryDark);

  const primaryInkLight = computeInk(primaryLight, backgroundLightForContrast, 'darker');
  const primaryInkDark = computeDarkInk(primaryLight, backgroundDarkForContrast);

  // ---- fonts ---------------------------------------------------------------------

  const baseFontSans = getToken(lightBodyOrig, 'font-sans') || '"Segoe UI", ui-sans-serif, system-ui, sans-serif';
  const baseFontDisplay = getToken(lightBodyOrig, 'font-display') || baseFontSans;
  const baseStacks = ['font-sans', 'font-display', 'font-serif', 'font-mono'].map((n) => getToken(lightBodyOrig, n)).filter(Boolean);
  const bodySpec = parseFamilyArg(args.fontBody);
  const headingSpec = args.fontHeading ? parseFamilyArg(args.fontHeading) : null;
  if (!bodySpec.family || (headingSpec && !headingSpec.family)) {
    console.error('--font-body/--font-heading need a family name first');
    process.exit(1);
  }
  const fontSans = composeFontStack(baseFontSans, bodySpec, baseStacks);
  // A heading in the body's own family takes the body's whole stack: the
  // style's display fallback belongs to the style's display face.
  const headingIsBody = !headingSpec || headingSpec.family.toLowerCase() === bodySpec.family.toLowerCase();
  const fontDisplay = headingIsBody && !headingSpec?.category && !headingSpec?.extra.length
    ? fontSans
    : composeFontStack(baseFontDisplay, headingSpec, baseStacks);

  let fonts = null;
  if (args.embedFonts) {
    const families = [{ family: bodySpec.family, roles: ['body'] }];
    if (!headingIsBody) families.push({ family: headingSpec.family, roles: ['heading'] });
    else families[0].roles.push('heading');
    if (!args.lang) warn('--embed-fonts without --lang; embedding latin and latin-ext');
    fonts = await embedFonts({
      families,
      headingWeight: args.headingWeight != null ? Number(args.headingWeight) : null,
      lang: args.lang,
      fontFiles: args.fontFiles,
      warn,
    });
  } else if (args.fontFiles.length) {
    warn('--font-file given without --embed-fonts; ignoring');
  }

  // ---- logo ------------------------------------------------------------------------

  let logo = null;
  let logoOn = null;
  let logoRatioValue = null;
  let logoColors = null; // mask mode: { light, dark }
  let logoDark = null; // { mode: 'mask' | 'plate' | 'band', ... }
  if (args.logo) {
    const source = loadLogo(args.logo, warn);
    logo = source;
    const tint = source && args.logoTint ? parseColorArg(args.logoTint, '--logo-tint') : null;
    if (logo && tint) {
      try {
        logo = tintLogo(logo, tint);
      } catch (e) {
        if (!(e instanceof TintError)) throw e;
        console.error(`--logo-tint: ${e.message}`);
        process.exit(1);
      }
    }
    if (logo) {
      const art = analyzeArtwork(source);
      logoRatioValue = logoRatio(source);
      if (logoRatioValue == null) warn('could not read the logo\'s proportions; --brand-logo-ratio left out');
      // A tinted logo's background follows from the tint: dark ink sits on
      // paper, light ink needs a dark band.
      const tintIsDark = tint ? contrastOklch(tint, WHITE) >= 3 : null;
      logoOn = args.logoOn || (tint ? (tintIsDark ? 'light' : 'dark') : 'light');
      if (!args.logoOn && !tint) {
        if (art.light === true && !art.single) {
          warn('the logo is light and has more than one color; on paper it will barely show. Pass --logo-on dark to put it on a dark band');
        } else if (art.light === null && source.isPng) {
          warn(`could not read the PNG's colors (${art.reason}); if the artwork is light, pass --logo-on dark`);
        }
      }

      // Dark mode. Single-color artwork is drawn as a mask: one copy of the
      // shape, painted with --brand-logo-color, which each theme sets.
      // Anything else gets a light plate to stand on in dark mode, and
      // artwork that needs a dark band keeps the band in both themes.
      if (logoOn === 'light' && art.single) {
        // The light-theme color: the tint, else the artwork's own color when
        // it reads on paper, else the text color (white artwork nobody
        // tinted). --brand-logo stays an image in that color.
        let lightColor = tint;
        if (!lightColor) {
          if (contrastOklch(art.color, backgroundLightForContrast) >= 3) {
            lightColor = art.color;
          } else {
            lightColor = toOklch(parse(foregroundLightRaw || 'oklch(0.2 0 0)'));
            logo = tintLogo(source, lightColor);
          }
        }
        logoColors = { light: formatOklch(clampChromaToGamut(lightColor.l, lightColor.c, lightColor.h)), dark: foregroundDarkRaw || 'oklch(0.930 0.000 0.0)' };
        logoDark = { mode: 'mask' };
      } else if (logoOn === 'light') {
        logoDark = { mode: 'plate', plate: formatOklch(backgroundLightForContrast), reason: art.reason };
      } else {
        // Light artwork on a dark band keeps the band in both themes; the
        // band is the light theme's (dark) text color, not the dark theme's.
        logoDark = { mode: 'band', plate: foregroundLightRaw };
      }
    }
  } else if (args.logoOn || args.logoTint) {
    warn('--logo-on/--logo-tint given without --logo; ignoring');
  }

  // ---- assemble overrides ----------------------------------------------------------

  const lightOverrides = [
    ['primary', formatOklch(primaryLight)],
    ['primary-foreground', formatOklch(primaryForegroundLight)],
    ['ring', formatOklch(primaryLight)],
    ['accent', formatOklch(accentLight)],
    ['accent-foreground', accentForegroundLight.raw],
    ['primary-ink', formatOklch(primaryInkLight)],
    ['card-foreground', foregroundLightRaw],
    ['popover-foreground', foregroundLightRaw],
    ['font-sans', fontSans],
    ['font-display', fontDisplay],
    ...tintNeutrals(lightBodyOrig, primaryLight, backgroundLightForContrast),
  ];
  if (getToken(lightBodyOrig, 'chart-1') != null) lightOverrides.push(['chart-1', formatOklch(primaryLight)]);
  if (foregroundLight) lightOverrides.push(['foreground', formatOklch(foregroundLight)]);
  if (backgroundLight) lightOverrides.push(['background', formatOklch(backgroundLight)]);
  if (args.headingWeight != null) lightOverrides.push(['font-heading-weight', String(Number(args.headingWeight))]);
  if (logo) {
    const dataUrl = `url("data:${logo.mime};base64,${logo.base64}")`;
    if (logoDark.mode === 'mask') {
      lightOverrides.push(['brand-logo-mask', dataUrl]);
      lightOverrides.push(['brand-logo', 'var(--brand-logo-mask)']);
      lightOverrides.push(['brand-logo-color', logoColors.light]);
    } else {
      lightOverrides.push(['brand-logo', dataUrl]);
    }
    lightOverrides.push(['brand-logo-on', logoOn]);
    if (logoRatioValue != null) lightOverrides.push(['brand-logo-ratio', String(logoRatioValue)]);
    if (logoDark.mode === 'plate') lightOverrides.push(['brand-logo-plate', 'transparent']);
    if (logoDark.mode === 'band') lightOverrides.push(['brand-logo-plate', logoDark.plate]);
  }

  const darkOverrides = [
    ['primary', formatOklch(primaryDark)],
    ['primary-foreground', formatOklch(primaryForegroundDark)],
    ['ring', formatOklch(primaryDark)],
    ['accent', formatOklch(accentDark)],
    ['accent-foreground', accentForegroundDark.raw],
    ['primary-ink', formatOklch(primaryInkDark)],
    ['card-foreground', foregroundDarkRaw],
    ['popover-foreground', foregroundDarkRaw],
    ...tintNeutrals(darkBodyOrig, primaryLight, backgroundDarkForContrast),
  ];
  if (getToken(darkBodyOrig, 'chart-1') != null) darkOverrides.push(['chart-1', formatOklch(primaryDark)]);
  if (logo) {
    if (logoDark.mode === 'mask') {
      darkOverrides.push(['brand-logo-color', logoColors.dark]);
      darkOverrides.push(['brand-logo-on', 'dark']);
    } else if (logoDark.mode === 'plate') {
      darkOverrides.push(['brand-logo-on', 'light']);
      darkOverrides.push(['brand-logo-plate', logoDark.plate]);
    } else {
      darkOverrides.push(['brand-logo-on', 'dark']);
      darkOverrides.push(['brand-logo-plate', logoDark.plate]);
    }
  }

  // A previous run's output passed back in as --style carries its own logo
  // tokens; a new --logo replaces all of them, so a stale dark copy or plate
  // cannot outlive the logo it belonged to.
  const clearLogo = (body) => (logo ? LOGO_TOKENS.reduce((b, name) => removeToken(b, name), body) : body);
  lightBodyOrig = clearLogo(lightBodyOrig);
  darkBodyOrig = clearLogo(darkBodyOrig);
  darkOsBodyOrig = clearLogo(darkOsBodyOrig);

  const lightFinal = withSidebarMirrors(lightBodyOrig, lightOverrides);
  const darkFinal = withSidebarMirrors(darkBodyOrig, darkOverrides);

  const newLightBody = applyOverrides(lightBodyOrig, lightFinal);
  const newDarkBody = applyOverrides(darkBodyOrig, darkFinal);
  const newDarkOsBody = applyOverrides(darkOsBodyOrig, darkFinal);

  // Splice the three edited bodies back into the original text by absolute
  // offset (processed in reverse order so earlier offsets stay valid).
  const edits = [
    { start: spans.darkOs.bodyStart, end: spans.darkOs.bodyEnd, text: newDarkOsBody },
    { start: spans.darkExplicit.bodyStart, end: spans.darkExplicit.bodyEnd, text: newDarkBody },
    { start: spans.light.bodyStart, end: spans.light.bodyEnd, text: newLightBody },
  ].sort((a, b) => b.start - a.start);

  let outCss = baseCss;
  for (const e of edits) outCss = outCss.slice(0, e.start) + e.text + outCss.slice(e.end);

  // Header comment, then the font faces, then the theme blocks.
  const outPath = resolvePath(process.cwd(), args.out);
  const lead = /^\s*\/\*[\s\S]*?\*\/[ \t]*\n?/.exec(outCss);
  // A brand tokens.css passed back in as --style names its base style in its
  // own header; the directory it sits in is the profile, not a style.
  const styleSlug = (lead && /on the "([^"]+)" base style/.exec(lead[0])?.[1]) || basename(dirname(resolvePath(process.cwd(), args.style)));
  const header = brandHeader({ outPath, styleSlug });
  const rest = lead ? outCss.slice(lead[0].length) : outCss;
  outCss = `${header}\n\n${fonts?.css ? `${fonts.css}\n` : ''}${rest.replace(/^\n+/, '')}`;

  try {
    writeFileSync(outPath, outCss, 'utf8');
  } catch (e) {
    console.error(`cannot write --out file: ${e.message}`);
    process.exit(1);
  }

  // ---- verify: relay check-tokens.mjs ------------------------------------------------

  const checkRes = spawnSync(process.execPath, [CHECK_TOKENS_SCRIPT, outPath, '--json'], { encoding: 'utf8' });
  const findings = (checkRes.stdout || '')
    .split('\n')
    .filter(Boolean)
    .map((line) => {
      try {
        return JSON.parse(line);
      } catch {
        return null;
      }
    })
    .filter((f) => f && !f.summary);
  if (checkRes.stderr) process.stderr.write(checkRes.stderr);

  if (args.json) {
    const summary = {
      out: outPath,
      bytes: Buffer.byteLength(outCss, 'utf8'),
      derived: {
        primary: {
          light: formatOklch(primaryLight),
          dark: formatOklch(primaryDark),
          darkContrast: round3(contrastOklch(primaryDark, backgroundDarkForContrast)),
        },
        primaryInk: {
          light: round3(contrastOklch(primaryInkLight, backgroundLightForContrast)),
          dark: round3(contrastOklch(primaryInkDark, backgroundDarkForContrast)),
        },
        primaryInkValue: {
          light: formatOklch(primaryInkLight),
          dark: formatOklch(primaryInkDark),
        },
        primaryForeground: {
          light: formatOklch(primaryForegroundLight),
          dark: formatOklch(primaryForegroundDark),
        },
        accent: {
          source: accentArg ? 'arg' : 'derived',
          light: formatOklch(accentLight),
          dark: formatOklch(accentDark),
          foreground: {
            light: accentForegroundLight.raw,
            dark: accentForegroundDark.raw,
          },
          contrast: {
            light: accentForegroundLight.color ? round3(contrastOklch(accentForegroundLight.color, accentLight)) : null,
            dark: accentForegroundDark.color ? round3(contrastOklch(accentForegroundDark.color, accentDark)) : null,
          },
        },
        fontSans,
        fontDisplay,
      },
      logo: {
        embedded: !!logo,
        bytes: logo ? logo.bytes : null,
        on: logoOn,
        tint: logo?.tint || null,
        ratio: logoRatioValue,
        mask: logoDark?.mode === 'mask',
        color: logoColors,
        dark: logoDark
          ? {
              mode: logoDark.mode,
              tint: null,
              bytes: null,
              plate: logoDark.plate || null,
              reason: logoDark.reason || null,
            }
          : null,
      },
      fonts: fonts ? fonts.report : null,
      fontsBase64Bytes: fonts ? fonts.base64Bytes : null,
      check: {
        exit: checkRes.status,
        findings,
      },
      warnings,
    };
    process.stdout.write(JSON.stringify(summary, null, 2) + '\n');
  } else {
    process.stdout.write(`wrote ${outPath}\n`);
    if (fonts) {
      for (const f of fonts.report) {
        process.stdout.write(f.embedded
          ? `font: ${f.family} embedded (${f.source}, weights ${f.weights.join('/')}${f.subsets.length ? `, ${f.subsets.join('+')}` : ''}, ${Math.round(f.bytes / 1024)} KB)\n`
          : `font: ${f.family} NOT embedded (${f.reason})\n`);
      }
    }
    if (logoDark) process.stdout.write(`logo in dark mode: ${logoDark.mode === 'mask' ? 'mask (one copy, recolored per theme)' : logoDark.mode}${logoDark.reason ? ` (${logoDark.reason})` : ''}\n`);
    process.stdout.write(`check: exit ${checkRes.status}, ${findings.length} finding(s)\n`);
  }

  process.exit(typeof checkRes.status === 'number' ? checkRes.status : 1);
}

main().catch((e) => {
  console.error(e.stack || e.message);
  process.exit(1);
});
