#!/usr/bin/env node
// Checks a letterhead tokens.css: the three theme blocks, the tokens every
// template reads, OKLCH color literals inside the sRGB gamut, and WCAG
// contrast for the text pairs a document actually draws.
//
// The three blocks:
//   :root { ... }                                   light theme
//   [data-theme="dark"] { ... }                     dark, chosen explicitly
//   @media (prefers-color-scheme: dark) {
//     :root:not([data-theme="light"]):not([data-theme="dark"]) { ... }
//   }                                               dark, from the system
//
// Only readability is checked here. Whether a palette looks good is the
// brand owner's call, not a script's.
//
// Usage:
//   node check-tokens.mjs <tokens.css>... [--json]
//
// Output: one line per finding, `<file>:<line> <severity> <rule> <message>`,
// then one summary line per file. --json prints one JSON object per finding
// and a final {"summary": ...} object.
//
// Exit codes:
//   0 — no errors (warnings allowed)
//   1 — usage error or unreadable file
//   2 — at least one error
//
// No dependencies beyond Node's built-ins and scripts/vendor/.

import { readFileSync } from 'node:fs';
import {
  parseCss, walkRules, selectorList, isDarkSchemeMedia, LIGHT_GUARD_RE, isExplicitDark,
  resolveVars, readColor, alphaOf, contrastRatio, lineIndex, toRgb,
} from './lib/css.mjs';
import { parseArgs, emit } from './lib/report.mjs';

const USAGE = 'usage: node check-tokens.mjs <tokens.css>... [--json]';

const REQUIRED = ['background', 'foreground', 'primary'];

// Tokens templates use for text and surfaces. A non-OKLCH value here would
// dodge the gamut check and make the palette harder to derive from.
const CORE = new Set([
  'background', 'foreground', 'primary', 'primary-foreground', 'muted-foreground',
  'card', 'card-foreground', 'border', 'accent', 'accent-foreground', 'primary-ink',
]);

// [text, surface, minimum ratio, severity]
const PAIRS = [
  ['foreground', 'background', 7, 'error'],
  ['muted-foreground', 'background', 4.5, 'error'],
  ['primary-foreground', 'primary', 4.5, 'error'],
  ['primary-ink', 'background', 4.5, 'error'],
  // Tags, callouts and highlighted rows set text on the accent fill.
  ['accent-foreground', 'accent', 4.5, 'error'],
  ['card-foreground', 'card', 7, 'warning'],
  // State words (passed, blocked) are set in these colors.
  ['status-ok', 'background', 4.5, 'error'],
  ['status-warn', 'background', 4.5, 'error'],
  ['status-blocked', 'background', 4.5, 'error'],
  ['status-neutral', 'background', 4.5, 'error'],
];

const COLOR_LITERAL_RE = /^(?:#[0-9a-f]{3,8}|(?:rgba?|hsla?|hwb|lab|lch|oklab|oklch|color)\(.*\))$/i;

function isColorValue(value) {
  if (!value) return false;
  const v = value.trim();
  if (COLOR_LITERAL_RE.test(v)) return true;
  return /^[a-z]+$/i.test(v) && !!readColor(v) && !/^(?:transparent|currentcolor)$/i.test(v);
}

// Largest in-gamut chroma for a lightness and hue, by bisection.
function maxChroma(L, H) {
  if (L <= 0 || L >= 1) return 0;
  const inside = (C) => {
    const c = toRgb({ mode: 'oklch', l: L, c: C, h: H });
    return [c.r, c.g, c.b].every((v) => v >= -1e-6 && v <= 1 + 1e-6);
  };
  let lo = 0;
  let hi = 0.5;
  for (let i = 0; i < 32; i++) {
    const mid = (lo + hi) / 2;
    if (inside(mid)) lo = mid;
    else hi = mid;
  }
  return lo;
}

// Values are written with three decimals, so a color sitting on the gamut
// edge can land a rounding step outside it. Accept anything within half a
// step of an in-gamut color.
function outOfGamut(color) {
  const L = color.l;
  const C = color.c || 0;
  const H = color.h || 0;
  if (L < -0.0005 || L > 1.0005) return true;
  if (C <= 0.0005) return false;
  const budget = Math.max(maxChroma(L - 0.0005, H), maxChroma(L, H), maxChroma(L + 0.0005, H));
  return C - 0.0005 > budget + 1e-4;
}

function fmt(n) {
  return Math.round(n * 100) / 100;
}

function checkFile(file) {
  let css;
  try {
    css = readFileSync(file, 'utf8');
  } catch (e) {
    return { file, fatal: e.message, findings: [] };
  }
  const toLine = lineIndex(css);
  const findings = [];
  const add = (severity, rule, where, message) => {
    const line = typeof where === 'number' ? toLine(where) : null;
    findings.push({ severity, rule, line, locator: typeof where === 'number' ? `line ${line}` : where, message });
  };

  let nodes;
  try {
    nodes = parseCss(css, 0);
  } catch (e) {
    return { file, fatal: `cannot read as CSS: ${e.message}`, findings: [] };
  }

  const blocks = {
    light: { label: ':root', tokens: new Map(), start: null },
    dark: { label: '[data-theme="dark"]', tokens: new Map(), start: null },
    system: { label: '@media (prefers-color-scheme: dark)', tokens: new Map(), start: null },
  };
  let unguardedSystem = null;
  for (const { rule, parents } of walkRules(nodes)) {
    const sels = selectorList(rule.selector);
    const inDarkMedia = parents.some(isDarkSchemeMedia);
    const otherMedia = parents.some((p) => !isDarkSchemeMedia(p));
    if (otherMedia) continue;
    let block = null;
    if (inDarkMedia) {
      if (sels.some((s) => s.startsWith(':root') && LIGHT_GUARD_RE.test(s))) block = blocks.system;
      else if (sels.some((s) => s.startsWith(':root'))) unguardedSystem ??= rule.start;
    } else if (sels.some((s) => isExplicitDark(s))) {
      block = blocks.dark;
    } else if (sels.includes(':root')) {
      block = blocks.light;
    }
    if (!block) continue;
    block.start ??= rule.start;
    for (const d of rule.decls) {
      if (d.prop.startsWith('--')) block.tokens.set(d.prop.slice(2), { value: d.value, start: d.start });
    }
  }

  const hasLight = blocks.light.tokens.size > 0;
  const hasDark = blocks.dark.tokens.size > 0;
  const hasSystem = blocks.system.tokens.size > 0;
  if (!hasLight) add('error', 'tokens/no-light-block', 1, 'No :root block with tokens. The light theme is the base every other block builds on.');
  if (!hasDark && !hasSystem) {
    add('error', 'tokens/no-dark-block', 1, 'No dark theme at all: neither [data-theme="dark"] nor a guarded :root inside @media (prefers-color-scheme: dark).');
  } else if (!hasDark) {
    add('warning', 'tokens/one-dark-path', blocks.system.start ?? 1, 'Only the system dark block exists. Add [data-theme="dark"] so a reader or viewer can switch to dark explicitly.');
  } else if (!hasSystem) {
    const hint = unguardedSystem != null ? ' The :root inside the dark media query is not guarded with :not([data-theme="light"]), so it would override an explicit light choice.' : '';
    add('warning', 'tokens/one-dark-path', unguardedSystem ?? blocks.dark.start ?? 1, `Only [data-theme="dark"] exists. Add a :root:not([data-theme="light"]):not([data-theme="dark"]) block inside @media (prefers-color-scheme: dark) so system dark mode works.${hint}`);
  }

  for (const key of ['light', 'dark', 'system']) {
    const block = blocks[key];
    if (block.tokens.size === 0) continue;
    const where = block.start;

    for (const name of REQUIRED) {
      if (!block.tokens.has(name)) add('error', 'tokens/missing-token', where, `${block.label} has no --${name}. Templates read it directly.`);
    }

    // What the browser sees in this theme: light values, then this block.
    const effective = new Map(blocks.light.tokens);
    if (key !== 'light') for (const [k, v] of block.tokens) effective.set(k, v);
    const lookup = (name) => effective.get(name.replace(/^--/, ''))?.value;

    const colors = new Map();
    for (const [name, entry] of block.tokens) {
      const resolved = resolveVars(entry.value, lookup);
      if (!isColorValue(resolved)) continue;
      const color = readColor(resolved);
      if (!color) continue;
      if (!/^oklch\(/i.test(resolved)) {
        const core = CORE.has(name);
        add(core ? 'error' : 'warning', 'tokens/not-oklch', entry.start,
          `${block.label} --${name} is "${resolved.slice(0, 40)}", not an oklch() value.${core ? ' Core text and surface tokens must be OKLCH.' : ''}`);
      }
      if (alphaOf(color) < 1) {
        add('warning', 'tokens/translucent', entry.start, `${block.label} --${name} has alpha ${fmt(alphaOf(color))}; its contrast depends on what is behind it.`);
      }
      const ok = /^oklch\(/i.test(resolved) ? color : null;
      if (ok && outOfGamut(ok)) {
        add('error', 'tokens/out-of-gamut', entry.start, `${block.label} --${name} (${resolved}) is outside sRGB; browsers clip it to a different color. Lower the chroma.`);
      }
    }
    for (const [name, entry] of effective) {
      const resolved = resolveVars(entry.value, lookup);
      if (!isColorValue(resolved)) continue;
      const color = readColor(resolved);
      if (color) colors.set(name, color);
    }

    for (const [text, surface, min, severity] of PAIRS) {
      const fg = colors.get(text);
      const bg = colors.get(surface);
      if (!fg || !bg) continue;
      let ratio;
      try { ratio = contrastRatio(fg, bg); } catch { continue; }
      if (ratio < min) {
        const at = block.tokens.get(text)?.start ?? block.tokens.get(surface)?.start ?? where;
        add(severity, 'tokens/low-contrast', at, `${block.label} --${text} on --${surface} is ${fmt(ratio)}:1, below ${min}:1.`);
      }
    }
  }

  return { file, findings };
}

const { files, json } = parseArgs(process.argv.slice(2), USAGE);
process.exit(emit(files.map(checkFile), json));
