#!/usr/bin/env node
// Smoke test for letterhead/scripts/apply-tokens.mjs: a brand profile in
// another style keeps its colors.
//
// Two profiles, each applied to a small document in every style with
// --style: one generated here by brand-tokens.mjs on the consulting base
// (it carries the state colors), and the Arkona example profile (taught
// before the state colors existed). For each theme block (light, explicit
// dark, system dark) the value the browser ends up with must be the
// profile's for every color token the profile defines, the state colors
// must exist and read at 4.5:1 on the brand's paper, the brand's fonts must
// win their slots, and structure (radii, measure) must be the chosen
// style's.
//
// Usage: node dev-scripts/apply-tokens-smoke.mjs
// Exit codes: 0 all assertions passed, 1 an assertion failed.

import { spawnSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, readFileSync, readdirSync, mkdirSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseCss, walkRules, selectorList, isDarkSchemeMedia, readColor, contrastRatio } from '../letterhead/scripts/lib/css.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SCRIPTS = join(ROOT, 'letterhead', 'scripts');
const STYLES = join(ROOT, 'letterhead', 'styles');
const TMP = mkdtempSync(join(tmpdir(), 'apply-tokens-smoke-'));
const STATUS = ['status-ok', 'status-warn', 'status-blocked', 'status-neutral'];
const COLOR_RE = /^(?:#[0-9a-f]{3,8}|(?:rgba?|hsla?|hwb|lab|lch|oklab|oklch|color)\(.*\))$/i;

let failures = 0;
function check(label, cond, detail) {
  if (cond) console.log(`  ok - ${label}`);
  else {
    console.log(`  FAIL - ${label}`);
    if (detail) console.log(String(detail).split('\n').map((l) => `      ${l}`).join('\n'));
    failures++;
  }
}

const norm = (v) => (v == null ? null : v.replace(/\s+/g, ' ').trim());

// Declared custom properties per theme, in cascade order: light is every
// :root rule; dark is light, then [data-theme="dark"]; system dark is
// light, then the guarded :root inside the dark media query.
function themes(css) {
  const light = new Map();
  const dark = new Map();
  const darkOs = new Map();
  for (const { rule, parents } of walkRules(parseCss(css))) {
    const sels = selectorList(rule.selector);
    let target = null;
    if (parents.some(isDarkSchemeMedia)) {
      if (sels.some((s) => s.startsWith(':root'))) target = darkOs;
    } else if (parents.length === 0 && sels.includes(':root')) target = light;
    else if (parents.length === 0 && sels.includes('[data-theme="dark"]')) target = dark;
    if (!target) continue;
    for (const d of rule.decls) if (d.prop.startsWith('--')) target.set(d.prop.slice(2), d.value);
  }
  return {
    light,
    dark: new Map([...light, ...dark]),
    darkOs: new Map([...light, ...darkOs]),
    ownDark: dark,
    ownDarkOs: darkOs,
  };
}

const firstFamily = (v) => (v || '').split(',')[0].trim().replace(/^["']|["']$/g, '').toLowerCase();

function docShell() {
  return '<!doctype html>\n<html lang="en">\n<head>\n<meta charset="utf-8">\n<title>Probe</title>\n</head>\n<body>\n<main class="doc">\n<header class="doc-head"><h1>Probe</h1></header>\n</main>\n</body>\n</html>\n';
}

function probe(profileDir, label) {
  console.log(`${label}`);
  const prof = themes(readFileSync(join(profileDir, 'tokens.css'), 'utf8'));
  const styles = readdirSync(STYLES).filter((s) => existsSync(join(STYLES, s, 'tokens.css'))).sort();
  for (const style of styles) {
    const doc = join(TMP, `${label.replace(/\W+/g, '-')}-${style}.html`);
    writeFileSync(doc, docShell());
    const res = spawnSync(process.execPath, [join(SCRIPTS, 'apply-tokens.mjs'), profileDir, doc, '--style', style], { encoding: 'utf8' });
    if (res.status !== 0) {
      check(`${style}: apply-tokens exits 0`, false, `${res.stdout}${res.stderr}`);
      continue;
    }
    const html = readFileSync(doc, 'utf8');
    const block = /<style data-letterhead-tokens[^>]*>([\s\S]*?)<\/style>/.exec(html)?.[1] || '';
    const got = themes(block);
    const styleTokens = themes(readFileSync(join(STYLES, style, 'tokens.css'), 'utf8'));

    const wrong = [];
    for (const [theme, own] of [['light', prof.light], ['dark', prof.ownDark], ['darkOs', prof.ownDarkOs]]) {
      for (const [k, v] of own) {
        if (!COLOR_RE.test(v.trim())) continue;
        if (norm(got[theme].get(k)) !== norm(v)) wrong.push(`${theme} --${k}: ${got[theme].get(k)} (profile ${v})`);
      }
    }
    check(`${style}: every profile color wins in light, dark and system dark`, wrong.length === 0, wrong.slice(0, 6).join('\n'));

    const weak = [];
    for (const theme of ['light', 'dark', 'darkOs']) {
      const paper = readColor(got[theme].get('background'));
      for (const k of STATUS) {
        const c = readColor(got[theme].get(k) || '');
        if (!c || !paper) weak.push(`${theme} --${k} missing`);
        else if (contrastRatio(c, paper) < 4.5) weak.push(`${theme} --${k} ${contrastRatio(c, paper).toFixed(2)}:1`);
      }
    }
    check(`${style}: state colors present, 4.5:1 on the brand's paper in every theme`, weak.length === 0, weak.join('\n'));

    check(`${style}: the brand's body and heading fonts win`,
      firstFamily(got.light.get('font-sans')) === firstFamily(prof.light.get('font-sans'))
      && firstFamily(got.light.get('font-display')) === firstFamily(prof.light.get('font-display')),
      `${got.light.get('font-sans')} / ${got.light.get('font-display')}`);

    const structure = ['radius-md', 'measure', 'text-base', 'leading-normal'].filter((k) => styleTokens.light.has(k))
      .filter((k) => norm(got.light.get(k)) !== norm(styleTokens.light.get(k)));
    check(`${style}: radii, measure and type scale are the style's`, structure.length === 0, structure.join(', '));
  }
}

// A profile generated on the consulting base: it carries state colors.
const gen = join(TMP, 'generated');
mkdirSync(gen, { recursive: true });
writeFileSync(join(gen, 'profile.meta.json'), JSON.stringify({ schema: 1, brand: 'generated', style: 'consulting', fields: {
  'typography.body': { value: 'Work Sans' }, 'typography.heading': { value: 'Fraunces' },
} }));
const tok = spawnSync(process.execPath, [join(SCRIPTS, 'brand-tokens.mjs'), '--style', join(STYLES, 'consulting', 'tokens.css'),
  '--primary', '#b4232a', '--foreground', '#1f2522', '--background', '#fbf8f2',
  '--font-body', 'Work Sans, sans-serif', '--font-heading', 'Fraunces, serif', '--out', join(gen, 'tokens.css')], { encoding: 'utf8' });
check('brand-tokens.mjs builds the generated profile', tok.status === 0, `${tok.stdout}${tok.stderr}`);
check('the generated profile carries the state colors', /--status-ok:/.test(readFileSync(join(gen, 'tokens.css'), 'utf8')));
probe(gen, 'generated profile (consulting base, red brand) in every style');

// The Arkona example profile, taught before the state colors existed.
probe(join(ROOT, 'examples', 'brands', 'arkona'), 'arkona example profile (no state colors) in every style');

if (failures) {
  console.log(`\n${failures} assertion(s) failed.`);
  process.exit(1);
}
console.log('\nall assertions passed.');
