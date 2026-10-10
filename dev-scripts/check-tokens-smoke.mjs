#!/usr/bin/env node
// Smoke test for letterhead/scripts/check-tokens.mjs.
//
// Every shipped style must pass. Then broken copies of one style (a block
// removed, a token removed, hex instead of OKLCH, low contrast, text on the
// accent under 4.5:1, a color outside sRGB) must fail with the right rule
// id, and warning-only problems must keep exit 0.
//
// Usage: node dev-scripts/check-tokens-smoke.mjs
// Exit codes: 0 all assertions passed, 1 an assertion failed.

import { spawnSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, readFileSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SCRIPT = join(ROOT, 'letterhead', 'scripts', 'check-tokens.mjs');
const STYLES = join(ROOT, 'letterhead', 'styles');
const TMP = mkdtempSync(join(tmpdir(), 'check-tokens-smoke-'));

function run(args) {
  const res = spawnSync(process.execPath, [SCRIPT, ...args], { encoding: 'utf8' });
  return { status: res.status, out: `${res.stdout}${res.stderr}` };
}

let failures = 0;
function check(label, cond, detail) {
  if (cond) console.log(`  ok - ${label}`);
  else {
    console.log(`  FAIL - ${label}`);
    if (detail) console.log(detail.split('\n').map((l) => `      ${l}`).join('\n'));
    failures++;
  }
}

console.log('shipped styles');
const styles = readdirSync(STYLES).filter((s) => !s.startsWith('.')).sort();
check('nine styles found', styles.length === 9, styles.join(', '));
for (const s of styles) {
  const r = run([join(STYLES, s, 'tokens.css')]);
  check(`${s} → exit 0, no findings`, r.status === 0 && /0 error, 0 warning/.test(r.out), r.out);
}

const BASE = readFileSync(join(STYLES, 'corporate', 'tokens.css'), 'utf8');

// Blocks of the base file, located by their selectors.
function cutBlock(css, opener) {
  const at = css.indexOf(opener);
  if (at === -1) throw new Error(`smoke base has no block: ${opener}`);
  let depth = 0;
  for (let i = css.indexOf('{', at); i < css.length; i++) {
    if (css[i] === '{') depth++;
    else if (css[i] === '}' && --depth === 0) return css.slice(0, at) + css.slice(i + 1);
  }
  throw new Error('unbalanced block');
}
function swapFirst(css, from, to) {
  if (!css.includes(from)) throw new Error(`smoke base does not contain: ${from}`);
  return css.replace(from, to);
}
const LIGHT_BG = '--background: oklch(0.9880 0.0020 248);';
const LIGHT_MUTED = '--muted-foreground: oklch(0.4600 0.0180 251);';
const LIGHT_PRIMARY = '--primary: oklch(0.4500 0.1300 252);';
const LIGHT_CHART5 = '--chart-5: oklch(0.5600 0.0250 250);';

const noLight = cutBlock(BASE, ':root {');
const noDark = cutBlock(cutBlock(BASE, '[data-theme="dark"] {'), '@media (prefers-color-scheme: dark) {');

const logoCss = (svg) => swapFirst(BASE, LIGHT_CHART5, `${LIGHT_CHART5}\n  --brand-logo: url("data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}");`);
const ERRORS = [
  ['a logo with two fill attributes on <svg>', 'tokens/broken-logo', logoCss('<svg xmlns="http://www.w3.org/2000/svg" fill="#111513" fill="none" viewBox="0 0 10 10"><path d="M0 0h10v10z"/></svg>')],
  ['a logo that <use>s an id it does not contain', 'tokens/broken-logo', logoCss('<svg xmlns="http://www.w3.org/2000/svg"><use href="#wordmark"/><path d="M0 0h1v1z"/></svg>')],
  ['a logo with no artwork', 'tokens/broken-logo', logoCss('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><g fill="#000"></g></svg>')],
  ['no :root block', 'tokens/no-light-block', noLight],
  ['no dark block at all', 'tokens/no-dark-block', noDark],
  ['--primary missing from :root', 'tokens/missing-token', swapFirst(BASE, LIGHT_PRIMARY, '')],
  ['--background missing from the dark block', 'tokens/missing-token', swapFirst(BASE, '[data-theme="dark"] {\n  color-scheme: dark;\n\n  --background: oklch(0.2050 0.0110 253);', '[data-theme="dark"] {\n  color-scheme: dark;\n')],
  ['hex instead of oklch on a core token', 'tokens/not-oklch', swapFirst(BASE, LIGHT_BG, '--background: #fcfcfd;')],
  ['low contrast muted text', 'tokens/low-contrast', swapFirst(BASE, LIGHT_MUTED, '--muted-foreground: oklch(0.7000 0.0180 251);')],
  ['low contrast body text', 'tokens/low-contrast', swapFirst(BASE, '--foreground: oklch(0.2300 0.0120 255);', '--foreground: oklch(0.5500 0.0120 255);')],
  ['text on the accent fill', 'tokens/low-contrast', swapFirst(BASE, '--accent: oklch(0.9350 0.0130 250);', '--accent: oklch(0.4000 0.0130 250);')],
  ['color outside sRGB', 'tokens/out-of-gamut', swapFirst(BASE, LIGHT_PRIMARY, '--primary: oklch(0.4500 0.3000 252);')],
];

console.log('one error at a time');
for (const [label, rule, css] of ERRORS) {
  const file = join(TMP, `${rule.replace('/', '-')}-${label.replace(/\W+/g, '-')}.css`);
  writeFileSync(file, css);
  const r = run([file]);
  check(`${label} → exit 2, ${rule}`, r.status === 2 && r.out.includes(` error ${rule} `), r.out);
}

console.log('warnings do not fail');
const WARNINGS = [
  ['only the explicit dark block', 'tokens/one-dark-path', cutBlock(BASE, '@media (prefers-color-scheme: dark) {')],
  ['only the system dark block', 'tokens/one-dark-path', cutBlock(BASE, '[data-theme="dark"] {')],
  ['hex on a non-core token', 'tokens/not-oklch', swapFirst(BASE, LIGHT_CHART5, '--chart-5: #7a808a;')],
  ['translucent color token', 'tokens/translucent', swapFirst(BASE, LIGHT_CHART5, '--chart-5: oklch(0.5600 0.0250 250 / 0.5);')],
];
for (const [label, rule, css] of WARNINGS) {
  const file = join(TMP, `warn-${label.replace(/\W+/g, '-')}.css`);
  writeFileSync(file, css);
  const r = run([file]);
  check(`${label} → exit 0, warning ${rule}`, r.status === 0 && r.out.includes(` warning ${rule} `), r.out);
}

console.log('--json and exit codes');
{
  const file = join(TMP, 'json.css');
  writeFileSync(file, swapFirst(BASE, LIGHT_MUTED, '--muted-foreground: oklch(0.7000 0.0180 251);'));
  const r = run([file, '--json']);
  const lines = r.out.trim().split('\n').map((l) => { try { return JSON.parse(l); } catch { return null; } });
  check('every line is JSON', lines.every(Boolean), r.out);
  check('a tokens/low-contrast finding with a line number', lines.some((l) => l?.rule === 'tokens/low-contrast' && Number.isInteger(l.line)), r.out);
  check('last line is the summary', !!lines[lines.length - 1]?.summary, r.out);
  check('--json keeps exit 2', r.status === 2);
  check('unreadable file → exit 1', run([join(TMP, 'nope.css')]).status === 1);
  check('no arguments → exit 1', run([]).status === 1);
}

if (failures) {
  console.log(`\n${failures} assertion(s) failed.`);
  process.exit(1);
}
console.log('\nall assertions passed.');
