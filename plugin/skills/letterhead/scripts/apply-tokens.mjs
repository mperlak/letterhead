#!/usr/bin/env node
// Puts a document's whole look into its <head> in one call:
//
//   <style data-letterhead-tokens>   fonts, style tokens, brand tokens
//   <style data-letterhead-style>    the style's style.css (its signature
//                                    moves, written on the shared markup in
//                                    reference/markup.md)
//
// in that order, ahead of the document's own <style>. A second run replaces
// both blocks instead of adding more, so the command is safe to repeat after
// the tokens change or to move a document to another style. When the
// document has no <link rel="icon">, it adds one: a small SVG in the primary
// color.
//
// Usage:
//   node apply-tokens.mjs <profile-dir | tokens.css> <doc.html> [--style <slug>] [--tokens-only]
//
//   <skill>/styles/<slug>/tokens.css   a style on its own.
//   <profile-dir> (or its tokens.css)  a brand profile. The style underneath
//                                      is the profile's own base style
//                                      (profile.meta.json "style"), or the one
//                                      --style names: brand in another style.
//   --tokens-only                      no style.css: for documents that carry
//                                      their own layout CSS from before.
//
// How the layers combine:
//   1. Fonts. The brand's embedded fonts, when it has any, then the fonts this
//      skill ships in fonts/ for every font slot (--font-sans, -display,
//      -serif, -mono, -label) whose first family nothing embeds yet. A brand
//      font always wins its slot, so a style font is only added for a slot
//      the brand left to the style (mono, usually). Over the 350 KB budget,
//      faces marked "extra" in fonts/fonts.json go first.
//   2. The style's tokens.css.
//   3. The brand over it. Colors are the brand's in all three theme blocks
//      (light, explicit dark, system dark): every color token the profile
//      defines wins, paper and dark paper included, and a color the style
//      has and the profile lacks (the --status-* state colors, for a profile
//      taught before they existed) is derived from the brand's own paper and
//      inks, never inherited from the style. Font slots the brand chose win;
//      the style fills the slots the brand left alone. A brand that names its
//      own body font also takes the style's --font-label slot, so a document
//      never carries a third family the brand did not name. Tokens only the
//      profile has (heading weight, logo) go in as they are. Everything else
//      (radii, measure, spacing, type scale, leading, shadows, motion) is
//      the style's.
//   4. styles/<slug>/style.css.
//
// A profile with no recorded base style (an older or hand-made one) has its
// tokens.css inserted whole, as before, and gets no style.css; pass --style
// to give it one.
//
// Exit codes:
//   0 — head written
//   1 — usage error, unreadable input, or a document without <head>/<html>
//
// No dependencies beyond Node's built-ins and scripts/vendor/culori.mjs.

import { readFileSync, writeFileSync, statSync, existsSync, readdirSync } from 'node:fs';
import { join, resolve, dirname, basename } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse, formatHex, converter } from './vendor/culori.mjs';
import { parseCss, walkRules, isDarkSchemeMedia, selectorList } from './lib/css.mjs';
import {
  formatOklch, clampChromaToGamut, quantize, deriveStatus, STATUS_KEYS, accentSurface, contrastOklch, pickInkForFill,
} from './lib/color.mjs';

const SKILL = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const STYLES = join(SKILL, 'styles');
const FONTS = join(SKILL, 'fonts');
const FONT_BUDGET_BASE64_BYTES = 350 * 1024;
const FONT_SLOTS = ['font-sans', 'font-display', 'font-serif', 'font-mono', 'font-label'];
const USAGE = 'usage: node apply-tokens.mjs <profile-dir | tokens.css> <doc.html> [--style <slug>] [--tokens-only]';
const toOklch = converter('oklch');

function fail(msg) {
  console.error(msg);
  process.exit(1);
}

// ---------------------------------------------------------------------------
// arguments
// ---------------------------------------------------------------------------

const pos = [];
let styleArg = null;
let tokensOnly = false;
const argv = process.argv.slice(2);
for (let i = 0; i < argv.length; i++) {
  const a = argv[i];
  if (a === '-h' || a === '--help') {
    console.log(USAGE);
    process.exit(0);
  } else if (a === '--style') {
    styleArg = argv[++i];
    if (!styleArg) fail(`--style needs a style name\n${USAGE}`);
  } else if (a === '--tokens-only') tokensOnly = true;
  else if (a.startsWith('--')) fail(`unknown option ${a}\n${USAGE}`);
  else pos.push(a);
}
if (pos.length !== 2) fail(USAGE);
const [source, docArg] = pos;

const read = (p, label = p) => {
  try {
    return readFileSync(p, 'utf8');
  } catch (e) {
    fail(`cannot read ${label}: ${e.code || e.message}`);
  }
};

let tokensPath = resolve(source);
try {
  if (statSync(tokensPath).isDirectory()) tokensPath = join(tokensPath, 'tokens.css');
} catch (e) {
  fail(`cannot read ${source}: ${e.code || e.message}`);
}
const sourceCss = read(tokensPath);
const docPath = resolve(docArg);
const html = read(docPath);

const styleDir = (slug) => join(STYLES, slug);
const knownStyle = (slug) => !!slug && /^[a-z0-9-]+$/.test(slug) && existsSync(join(styleDir(slug), 'tokens.css'));
if (styleArg && !knownStyle(styleArg)) {
  const all = readdirSync(STYLES).filter((s) => knownStyle(s)).sort();
  fail(`unknown style "${styleArg}"; pick one of: ${all.join(', ')}`);
}

// A style's own tokens.css, or a brand profile's?
const sourceDir = dirname(tokensPath);
const isStyleFile = basename(dirname(sourceDir)) === 'styles' && existsSync(join(sourceDir, 'DESIGN.md')) && !existsSync(join(sourceDir, 'profile.meta.json'));
let mode;
let styleSlug;
let baseSlug = null;
let meta = null;
if (isStyleFile) {
  mode = 'style';
  styleSlug = basename(sourceDir);
  if (styleArg && styleArg !== styleSlug) {
    fail(`${tokensPath} is the "${styleSlug}" style itself; to use "${styleArg}", pass styles/${styleArg}/tokens.css (or a brand profile with --style ${styleArg})`);
  }
} else {
  mode = 'brand';
  const metaPath = join(sourceDir, 'profile.meta.json');
  if (existsSync(metaPath)) {
    try {
      meta = JSON.parse(readFileSync(metaPath, 'utf8'));
    } catch (e) {
      fail(`cannot parse ${metaPath}: ${e.message}`);
    }
  }
  const lead = /^\s*\/\*[\s\S]*?\*\//.exec(sourceCss)?.[0] || '';
  baseSlug = meta?.style || /on the "([^"]+)" base style/.exec(lead)?.[1] || null;
  if (baseSlug && !knownStyle(baseSlug)) {
    console.error(`warning: the profile's base style "${baseSlug}" is not one of this skill's styles; its tokens go in whole`);
    baseSlug = null;
  }
  styleSlug = styleArg || baseSlug;
}

// ---------------------------------------------------------------------------
// token blocks
// ---------------------------------------------------------------------------

const BLOCKS = ['light', 'dark', 'darkOs'];

// The three theme blocks as name -> value maps (later declarations win).
function themeBlocks(css) {
  const out = { light: new Map(), dark: new Map(), darkOs: new Map() };
  for (const { rule, parents } of walkRules(parseCss(css))) {
    const sels = selectorList(rule.selector);
    let which = null;
    if (parents.some(isDarkSchemeMedia)) {
      if (sels.some((s) => s.startsWith(':root'))) which = 'darkOs';
    } else if (parents.length === 0 && sels.includes(':root')) which = 'light';
    else if (parents.length === 0 && sels.includes('[data-theme="dark"]')) which = 'dark';
    if (!which) continue;
    for (const d of rule.decls) if (d.prop.startsWith('--')) out[which].set(d.prop.slice(2), d.value);
  }
  return out;
}

const norm = (v) => (v == null ? null : v.replace(/\s+/g, ' ').trim());
const FONTS_BEGIN = '/* letterhead:fonts */';
const FONTS_END = '/* /letterhead:fonts */';

function fontSection(css) {
  const a = css.indexOf(FONTS_BEGIN);
  const b = a === -1 ? -1 : css.indexOf(FONTS_END, a);
  return a === -1 || b === -1 ? '' : css.slice(a, b + FONTS_END.length);
}

function stripHeader(css) {
  return css.replace(/^\s*\/\*[\s\S]*?\*\/\s*/, '');
}

function blockCss(selector, map, indent = '  ') {
  if (!map.size) return '';
  const lines = [...map].map(([k, v]) => `${indent}--${k}: ${v};`);
  return `${selector} {\n${lines.join('\n')}\n${indent.slice(2)}}`;
}

const color = (raw) => {
  const c = raw ? parse(raw) : null;
  return c ? toOklch(c) : null;
};

const COLOR_LITERAL_RE = /^(?:#[0-9a-f]{3,8}|(?:rgba?|hsla?|hwb|lab|lch|oklab|oklch|color)\(.*\))$/i;
const isColorValue = (v) => {
  const t = (v || '').trim();
  return COLOR_LITERAL_RE.test(t) || (/^[a-z]+$/i.test(t) && !!parse(t));
};

const unquote = (f) => f.trim().replace(/^["']|["']$/g, '').toLowerCase();

// The font slots that are the brand's own decision: a family the profile
// embeds or names in profile.meta.json, or one its base style does not have
// in the same slot. A slot the profile only copied from its base style (the
// mono stack, usually) is left to the chosen style.
function brandFontSlots(brandLight, embedded, meta, ref) {
  const named = new Set(['typography.body', 'typography.heading']
    .map((f) => meta?.fields?.[f]?.value).filter((v) => typeof v === 'string').map(unquote));
  const slots = new Set();
  for (const s of FONT_SLOTS) {
    const v = brandLight.get(s);
    if (!v || /^var\(/.test(v.trim())) continue;
    const fam = unquote(v.split(',')[0]);
    const refStack = (ref.light.get(s) || '').split(',').map(unquote);
    if (embedded.has(fam) || named.has(fam) || !refStack.includes(fam)) slots.add(s);
  }
  return slots;
}

// The brand over the chosen style, block by block. Colors are the brand's in
// all three theme blocks: every color token the profile defines wins, and a
// color the style has and the profile does not (the state colors, for a
// profile taught before they existed) is derived from the brand's own paper
// and inks, never taken from the style. Structure (radii, measure, spacing,
// type scale, leading, shadows, motion) is the style's. Fonts: the brand's
// own slots win; the style fills the rest. Tokens only the profile has
// (heading weight, logo) go in as they are.
function brandOverStyle(brand, style, ref, fontSlots) {
  const styleKeys = new Set(BLOCKS.flatMap((b) => [...style[b].keys()]));
  const refKeys = new Set(BLOCKS.flatMap((b) => [...ref[b].keys()]));
  const out = { light: new Map(), dark: new Map(), darkOs: new Map() };
  const primary = color(brand.light.get('primary'));
  for (const b of BLOCKS) {
    const own = b === 'darkOs' && !brand.darkOs.size ? brand.dark : brand[b];
    for (const [k, v] of own) {
      if (FONT_SLOTS.includes(k)) {
        if (b === 'light' && fontSlots.has(k)) out.light.set(k, v);
      } else if (isColorValue(v) || isColorValue(style[b].get(k)) || k.startsWith('brand-')) {
        out[b].set(k, v);
      } else if (!styleKeys.has(k) && !refKeys.has(k)) {
        out[b].set(k, v);
      }
    }
    if (!own.size) continue;
    const pick = (k) => color(own.get(k));
    // The accent as a large fill, for a profile taught before
    // --accent-surface existed: without it the styles fill summaries with
    // the raw accent, and a mustard or amber accent shouts.
    const accent = pick('accent');
    if (accent && !own.has('accent-surface')) {
      if (b === 'light') {
        const surface = accentSurface(accent);
        const fg = pick('foreground') || color(style[b].get('foreground'));
        const ink = fg && contrastOklch(fg, surface) >= 4.5 ? fg : pickInkForFill(surface);
        out[b].set('accent-surface', formatOklch(surface));
        out[b].set('accent-surface-foreground', formatOklch(ink));
      } else {
        out[b].set('accent-surface', own.get('accent'));
        if (own.has('accent-foreground')) out[b].set('accent-surface-foreground', own.get('accent-foreground'));
      }
    }
    const paper = pick('background') || color(style[b].get('background'));
    const missing = [...style[b]].filter(([k, v]) => isColorValue(v) && !own.has(k));
    if (!missing.length || !paper) continue;
    const seeds = Object.fromEntries(STATUS_KEYS.map((k) => [k, color(style[b].get(k))]).filter(([, c]) => c));
    const status = deriveStatus({
      background: paper, dark: b !== 'light', seeds,
      destructive: pick('destructive'), mutedForeground: pick('muted-foreground'),
    });
    for (const [k, v] of missing) {
      if (status[k]) {
        out[b].set(k, formatOklch(status[k]));
        continue;
      }
      // Any other color the brand lacks: the style's lightness at the
      // brand's hue, with a whisper of chroma.
      const c = color(v);
      if (!c || !primary) continue;
      const chroma = primary.c >= 0.02 ? Math.min(c.c, 0.012, primary.c * 0.06) : 0;
      out[b].set(k, formatOklch(quantize(clampChromaToGamut(c.l, chroma, primary.h))));
    }
  }
  return out;
}

// ---------------------------------------------------------------------------
// fonts
// ---------------------------------------------------------------------------

const firstFamily = (stack) => (stack || '').split(',')[0].trim().replace(/^["']|["']$/g, '');

function embeddedFamilies(css) {
  const fams = new Set();
  for (const node of parseCss(css)) {
    if (node.type !== 'at' || node.name !== 'font-face') continue;
    const d = node.decls.find((x) => x.prop === 'font-family');
    if (d) fams.add(firstFamily(d.value).toLowerCase());
  }
  return fams;
}

function vendoredFonts(stacks, alreadyEmbedded, budgetUsed, warnings) {
  let manifest;
  try {
    manifest = JSON.parse(readFileSync(join(FONTS, 'fonts.json'), 'utf8'));
  } catch {
    return { css: '', families: [], bytes: 0 };
  }
  const byName = new Map(Object.entries(manifest.families).map(([k, v]) => [k.toLowerCase(), [k, v]]));
  const faces = [];
  const seen = new Set();
  for (const slot of FONT_SLOTS) {
    const fam = firstFamily(stacks[slot]).toLowerCase();
    if (!fam || seen.has(fam) || alreadyEmbedded.has(fam) || !byName.has(fam)) continue;
    seen.add(fam);
    const [name, entry] = byName.get(fam);
    for (const face of entry.faces) {
      let data;
      try {
        data = readFileSync(join(FONTS, face.file));
      } catch (e) {
        warnings.push(`font file ${face.file} is missing (${e.code}); ${name} not embedded`);
        continue;
      }
      faces.push({ name, face, base64: data.toString('base64') });
    }
  }
  let total = budgetUsed + faces.reduce((n, f) => n + f.base64.length, 0);
  let kept = faces;
  if (total > FONT_BUDGET_BASE64_BYTES) {
    kept = faces.filter((f) => f.face.priority !== 'extra');
    if (kept.length < faces.length) warnings.push(`fonts over ${FONT_BUDGET_BASE64_BYTES / 1024} KB; left out ${faces.length - kept.length} extra face(s) (italics, code)`);
    total = budgetUsed + kept.reduce((n, f) => n + f.base64.length, 0);
    if (total > FONT_BUDGET_BASE64_BYTES) warnings.push(`embedded fonts come to ${Math.round(total / 1024)} KB, over the ${FONT_BUDGET_BASE64_BYTES / 1024} KB budget`);
  }
  const css = kept.map(({ name, face, base64 }) => [
    `/* ${name} ${face.weight}${face.style === 'italic' ? ' italic' : ''}, ${manifest.families[name].license} */`,
    '@font-face {',
    `  font-family: "${name}";`,
    `  font-style: ${face.style};`,
    `  font-weight: ${face.weight};`,
    '  font-display: swap;',
    `  src: url("data:font/woff2;base64,${base64}") format("woff2");`,
    '}',
  ].join('\n')).join('\n');
  return {
    css: css ? `/* letterhead:style-fonts (files in the skill's fonts/, licenses in fonts/<family>/OFL.txt) */\n${css}\n/* /letterhead:style-fonts */` : '',
    families: [...new Set(kept.map((f) => f.name))],
    bytes: kept.reduce((n, f) => n + f.base64.length, 0),
  };
}

// ---------------------------------------------------------------------------
// compose
// ---------------------------------------------------------------------------

const warnings = [];
let tokenCss;
let finalLight;
let summary;

if (mode === 'brand' && !styleSlug) {
  // A profile with no known base style: its tokens.css whole, as before.
  tokenCss = sourceCss.replace(/\s+$/, '');
  finalLight = themeBlocks(sourceCss).light;
  summary = `tokens: ${basename(sourceDir)} (no base style recorded; whole tokens.css, no style.css)`;
} else {
  const styleCss = read(join(styleDir(styleSlug), 'tokens.css'));
  const style = themeBlocks(styleCss);
  let deltaCss = '';
  let brandFonts = '';
  finalLight = new Map(style.light);
  if (mode === 'brand') {
    const brand = themeBlocks(sourceCss);
    const ref = baseSlug ? themeBlocks(read(join(styleDir(baseSlug), 'tokens.css'))) : style;
    brandFonts = fontSection(sourceCss);
    const over = brandOverStyle(brand, style, ref, brandFontSlots(brand.light, embeddedFamilies(brandFonts), meta, ref));
    if (over.light.has('font-sans') && style.light.has('font-label')) over.light.set('font-label', 'var(--font-sans)');
    for (const [k, v] of over.light) finalLight.set(k, v);
    deltaCss = [
      `/* ---- brand profile "${basename(sourceDir)}" over the "${styleSlug}" style${styleSlug !== baseSlug ? ` (its base style is "${baseSlug || 'not recorded'}")` : ''}: the brand's colors in every theme, its fonts and logo ---- */`,
      blockCss(':root', over.light),
      blockCss('[data-theme="dark"]', over.dark),
      over.darkOs.size ? `@media (prefers-color-scheme: dark) {\n${blockCss(':root:not([data-theme="light"]):not([data-theme="dark"])', over.darkOs, '    ')}\n}` : '',
    ].filter(Boolean).join('\n\n');
  }
  const stacks = Object.fromEntries(FONT_SLOTS.map((s) => [s, finalLight.get(s)]));
  const resolveStack = (v) => (v && /^var\(--(font-[a-z]+)\)$/.test(v) ? stacks[v.slice(6, -1)] : v);
  for (const s of FONT_SLOTS) stacks[s] = resolveStack(stacks[s]);
  const brandBytes = (brandFonts.match(/base64,[A-Za-z0-9+/=]+/g) || []).reduce((n, m) => n + m.length - 7, 0);
  const vendored = vendoredFonts(stacks, embeddedFamilies(brandFonts), brandBytes, warnings);
  tokenCss = [
    brandFonts,
    vendored.css,
    `/* ---- style "${styleSlug}" ---- */\n${stripHeader(styleCss).replace(/\s+$/, '')}`,
    deltaCss,
  ].filter(Boolean).join('\n\n');
  summary = [
    mode === 'brand' ? `tokens: style ${styleSlug} + brand ${basename(sourceDir)}${styleSlug !== baseSlug ? ` (base style ${baseSlug || 'not recorded'}; brand colors, style layout)` : ''}` : `tokens: style ${styleSlug}`,
    `fonts: ${[...embeddedFamilies(brandFonts)].length ? `brand (${[...new Set(brandFonts.match(/font-family:\s*"?[^";]+/g)?.map((m) => m.replace(/font-family:\s*"?/, '')) || [])].join(', ')})` : 'no brand fonts'}; style ${vendored.families.length ? vendored.families.join(', ') : 'none needed'} (${Math.round((brandBytes + vendored.bytes) / 1024)} KB embedded)`,
  ].join('\n');
}

let styleBlockCss = null;
if (!tokensOnly && styleSlug) {
  const p = join(styleDir(styleSlug), 'style.css');
  if (existsSync(p)) styleBlockCss = read(p).replace(/\s+$/, '');
  else warnings.push(`styles/${styleSlug} has no style.css; tokens only`);
}

for (const [label, css] of [['tokens', tokenCss], ['style.css', styleBlockCss || '']]) {
  if (/<\/style/i.test(css)) fail(`${label} contains "</style", which would end the style element early`);
}

// ---------------------------------------------------------------------------
// write into the document
// ---------------------------------------------------------------------------

const TOKENS_RE = /<style\b[^>]*\bdata-letterhead-tokens\b[^>]*>[\s\S]*?<\/style>\n?/i;
const STYLE_RE = /<style\b[^>]*\bdata-letterhead-style\b[^>]*>[\s\S]*?<\/style>\n?/i;
const tokensBlock = `<style data-letterhead-tokens${styleSlug ? ` data-style="${styleSlug}"` : ''}>\n${tokenCss}\n</style>\n`;
const styleBlock = styleBlockCss ? `<style data-letterhead-style="${styleSlug}">\n${styleBlockCss}\n</style>\n` : '';

let out = html;
const hadTokens = TOKENS_RE.test(out);
out = out.replace(STYLE_RE, '');
if (hadTokens) {
  out = out.replace(TOKENS_RE, () => tokensBlock + styleBlock);
} else {
  if (!/<head\b[^>]*>/i.test(out)) {
    if (!/<html\b[^>]*>/i.test(out)) fail(`${docPath} has neither <head> nor <html>; write the document shell first`);
    out = out.replace(/<html\b[^>]*>/i, (m) => `${m}\n<head>\n</head>`);
  }
  const headStart = out.search(/<head\b[^>]*>/i);
  const headEnd = out.search(/<\/head>/i);
  const head = headEnd > headStart ? out.slice(headStart, headEnd) : out.slice(headStart);
  const firstStyle = head.search(/<style\b/i);
  const both = tokensBlock + styleBlock;
  if (firstStyle !== -1) {
    const at = headStart + firstStyle;
    out = `${out.slice(0, at)}${both}${out.slice(at)}`;
  } else if (headEnd !== -1) {
    out = `${out.slice(0, headEnd)}${both}${out.slice(headEnd)}`;
  } else {
    const openEnd = headStart + /<head\b[^>]*>/i.exec(out.slice(headStart))[0].length;
    out = `${out.slice(0, openEnd)}\n${both}${out.slice(openEnd)}`;
  }
}

// Favicon: only when the document has none, in the light theme's primary.
let favicon = 'kept';
const hasIcon = [...out.matchAll(/<link\b[^>]*>/gi)].some((m) => /\brel\s*=\s*["']?[^"'>]*\bicon\b/i.test(m[0]));
if (!hasIcon) {
  const c = finalLight.get('primary') ? parse(finalLight.get('primary')) : null;
  const hex = c ? formatHex(c) : '#888888';
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'><rect x='4' y='4' width='24' height='24' rx='4' fill='${hex}'/></svg>`;
  const link = `<link rel="icon" href="data:image/svg+xml,${encodeURIComponent(svg)}">\n`;
  const at = out.search(/<style\b[^>]*\bdata-letterhead-tokens\b/i);
  out = `${out.slice(0, at)}${link}${out.slice(at)}`;
  favicon = `added (${hex})`;
}

try {
  writeFileSync(docPath, out, 'utf8');
} catch (e) {
  fail(`cannot write ${docPath}: ${e.code || e.message}`);
}
for (const w of warnings) console.error(`warning: ${w}`);
console.log(`${hadTokens ? 'replaced' : 'inserted'} in ${basename(docPath)} (${Math.round(Buffer.byteLength(tokenCss, 'utf8') / 1024)} KB tokens)`);
console.log(summary);
console.log(`style.css: ${styleBlock ? styleSlug : tokensOnly ? 'left out (--tokens-only)' : 'none'}`);
console.log(`favicon: ${favicon}`);
