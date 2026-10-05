// Color helpers shared by brand-tokens.mjs and apply-tokens.mjs: OKLCH
// formatting, gamut clamping, WCAG contrast, and the derivations of the
// text-safe primary ink and the dark-theme primary. One copy, so the two
// scripts cannot derive the same token two different ways.

import { converter, wcagContrast } from '../vendor/culori.mjs';

const toRgb = converter('rgb');

export const round3 = (n) => Math.round(n * 1000) / 1000;
export const round1 = (n) => Math.round(n * 10) / 10;

export function formatOklch({ l, c, h }) {
  const hue = Number.isFinite(h) ? h : 0;
  return `oklch(${round3(l).toFixed(3)} ${round3(Math.max(0, c)).toFixed(3)} ${round1(hue).toFixed(1)})`;
}

// Binary-searches chroma down until the color round-trips into sRGB, keeping
// L and H fixed — browsers clip out-of-gamut oklch() silently, so this is
// the only way a derived color is guaranteed to render as composed.
export function inGamut(l, c, h) {
  const rgb = toRgb({ mode: 'oklch', l, c, h });
  const eps = 1e-4;
  return ['r', 'g', 'b'].every((k) => rgb[k] >= -eps && rgb[k] <= 1 + eps);
}

export function clampChromaToGamut(l, c, h) {
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

export function contrastOklch(a, b) {
  return wcagContrast({ mode: 'oklch', l: a.l, c: a.c, h: a.h }, { mode: 'oklch', l: b.l, c: b.c, h: b.h });
}

export const WHITE = { l: 1, c: 0, h: 0 };
export const NEAR_BLACK = { l: 0.145, c: 0, h: 0 };
export const BLACK = { l: 0, c: 0, h: 0 };

// White or near-black ink on a fill, whichever clears 4.5:1; if only one
// passes, that one wins; if both pass, the higher-contrast one. A fill in
// the narrow band where neither does gets pure black, which clears 4.5:1
// on everything white cannot.
export function pickInkForFill(fill) {
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
export function quantize({ l, c, h }) {
  return { l: round3(l), c: Math.floor(Math.max(0, c) * 1000 + 1e-9) / 1000, h: round1(Number.isFinite(h) ? h : 0) };
}

// Text-safe primary ink for one block: same hue as primary, chroma inherited
// from primary (gamut-clamped), lightness walked toward the floor that
// clears 4.5:1 against that block's own background (darker on a light block,
// lighter on a dark one). The contrast is measured on the value as it will
// be written (three decimals), so rounding cannot drop it below 4.5:1.
export function computeInk(primary, background, direction) {
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
export function computeDarkPrimary(primary, background) {
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
export function computeDarkInk(primary, background) {
  const h = Number.isFinite(primary.h) ? primary.h : 0;
  const cap = primary.c < 0.03 ? primary.c : 0.4;
  let last = null;
  for (let l = Math.max(0.02, background.l); l <= 0.99; l += 0.005) {
    last = quantize(clampChromaToGamut(l, cap, h));
    if (contrastOklch(last, background) >= 4.5) return last;
  }
  return last || primary;
}

// State colors: --status-ok, --status-warn, --status-blocked and
// --status-neutral, for one theme block. A state is always written as a word
// ("passed", "blocked"); the color only repeats it, so each one only has to
// read as text: 4.5:1 on the block's background. Each starts from a seed,
// the style's own value when it has one, and keeps the seed whenever it
// already clears 4.5:1; otherwise its lightness walks away from the paper,
// hue and chroma kept, as for the primary ink. Blocked starts from the
// block's --destructive and neutral from its --muted-foreground, so a brand
// keeps one red and one grey.
export const STATUS_KEYS = ['status-ok', 'status-warn', 'status-blocked', 'status-neutral'];
const STATUS_DEFAULTS = {
  light: {
    'status-ok': { l: 0.53, c: 0.12, h: 152 },
    'status-warn': { l: 0.56, c: 0.115, h: 78 },
    'status-blocked': { l: 0.5, c: 0.18, h: 26 },
    'status-neutral': { l: 0.47, c: 0.01, h: 250 },
  },
  dark: {
    'status-ok': { l: 0.74, c: 0.115, h: 155 },
    'status-warn': { l: 0.78, c: 0.115, h: 82 },
    'status-blocked': { l: 0.67, c: 0.155, h: 25 },
    'status-neutral': { l: 0.77, c: 0.01, h: 250 },
  },
};

// background: the block's paper; dark: true for the two dark blocks;
// seeds: { 'status-ok': oklch, ... } where known (the style's own values);
// destructive, mutedForeground: the block's tokens, when known.
// Returns { 'status-ok': oklch, ... }, quantized as formatOklch() writes it.
export function deriveStatus({ background, dark, seeds = {}, destructive = null, mutedForeground = null }) {
  const defaults = STATUS_DEFAULTS[dark ? 'dark' : 'light'];
  const pick = {
    'status-ok': seeds['status-ok'],
    'status-warn': seeds['status-warn'],
    'status-blocked': destructive || seeds['status-blocked'],
    'status-neutral': mutedForeground || seeds['status-neutral'],
  };
  const out = {};
  for (const k of STATUS_KEYS) {
    const seed = pick[k] || defaults[k];
    const s = { l: seed.l, c: seed.c || 0, h: Number.isFinite(seed.h) ? seed.h : defaults[k].h };
    let v = quantize(computeInk(s, background, dark ? 'lighter' : 'darker'));
    if (contrastOklch(v, background) < 4.5) v = quantize(computeInk({ ...v, l: v.l + (dark ? 0.01 : -0.01) }, background, dark ? 'lighter' : 'darker'));
    out[k] = v;
  }
  return out;
}
