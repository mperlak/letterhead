#!/usr/bin/env node
// Writes the character counters of a content kit (templates/content-kit/)
// from the texts themselves. Agents miscount by hand ("275 / 280" over a
// 291-character post), and the page's script never counts, so the counters
// are in the HTML and this script keeps them true.
//
// For every copy block, div.copy[id][data-limit][data-count]:
//   the text      its <pre>, entities decoded, the newline right after <pre>
//                 dropped (as the browser does) and trailing blank space cut:
//                 the same text the copy button copies
//   the counter   its .count element, rewritten as "<n> / <limit>"; with no
//                 data-limit only the leading number changes, so a unit word
//                 after it stays ("1912 characters"). Over the limit the
//                 counter gets the class "over", which the layout draws.
//   counting      a Unicode code point is one character. data-count="x"
//                 counts the way X does (twitter-text, weighted length):
//                 every link is 23 whatever its length (https:// links,
//                 www. links and bare domains on common endings such as
//                 .com or .io), an emoji is 2, a character outside Latin,
//                 Greek, Cyrillic, Hebrew, Arabic, Indic and the common
//                 punctuation (CJK, for one) is 2, the rest 1.
//
// Usage:
//   node count-copy.mjs <doc.html> [--check]
//
//   --check   write nothing; report counters that are out of date as well
//
// Prints one line per block: OK or OVER (STALE with --check), its id, the
// count and the limit.
//
// Exit codes:
//   0 — every block within its limit (and, with --check, every counter current)
//   1 — usage error or unreadable file
//   2 — a block over its limit, a block without an id, a <pre> or a .count,
//       or (with --check) a counter that does not match its text
//
// No dependencies beyond Node's built-ins and scripts/vendor/.

import { readFileSync, writeFileSync } from 'node:fs';
import { basename, resolve } from 'node:path';
import { parse } from './vendor/node-html-parser.mjs';

const USAGE = 'usage: node count-copy.mjs <doc.html> [--check]';

function fail(msg) {
  console.error(msg);
  process.exit(1);
}

const args = process.argv.slice(2);
if (args.includes('-h') || args.includes('--help')) {
  console.log(USAGE);
  process.exit(0);
}
const check = args.includes('--check');
const rest = args.filter((a) => a !== '--check');
if (rest.length !== 1 || rest[0].startsWith('--')) fail(USAGE);
const docPath = resolve(rest[0]);

let html;
try {
  html = readFileSync(docPath, 'utf8');
} catch (e) {
  fail(`cannot read ${rest[0]}: ${e.code || e.message}`);
}

// ---------------------------------------------------------------------------
// counting
// ---------------------------------------------------------------------------

// twitter-text v3 (the configuration X uses): code points in these ranges
// weigh 1, every other code point 2; a link 23; an emoji 2.
const X_LIGHT = [[0x0000, 0x10ff], [0x2000, 0x200d], [0x2010, 0x201f], [0x2032, 0x2037]];
const X_URL_LENGTH = 23;
const TLDS = 'com|org|net|io|ai|dev|app|co|me|so|sh|gg|tv|fm|xyz|info|biz|tech|page|site|blog|news|pl|de|uk|eu|us|ca|au|nl|fr|es|it|ch|at|se|no|dk|fi|be|cz|ie|pt|jp';
const URL_RE = new RegExp(
  String.raw`(?<![@\w.-])(?:https?:\/\/[^\s<>"]+|www\.[^\s<>"]+|(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+(?:${TLDS})\b(?:\/[^\s<>"]*)?)`,
  'giu',
);
const TRAILING_PUNCT_RE = /[.,;:!?'")\]}’”]$/u;

// Punctuation after a link is not part of it, except a closing parenthesis
// the link opened itself: "…/Function_(mathematics)" keeps its ")".
function trimUrl(url) {
  let u = url;
  while (TRAILING_PUNCT_RE.test(u)) {
    if (u.endsWith(')') && (u.match(/\(/g) || []).length >= (u.match(/\)/g) || []).length) break;
    u = u.slice(0, -1);
  }
  return u;
}
// An emoji as X counts it: drawn as a picture by default, or asked to be one
// with the variation selector U+FE0F; a flag is a pair of regional indicators.
const EMOJI_RE = /\p{Emoji_Presentation}|️|\p{Regional_Indicator}/u;
const segmenter = typeof Intl.Segmenter === 'function' ? new Intl.Segmenter('en', { granularity: 'grapheme' }) : null;

const codePoints = (s) => [...s].length;

function xWeight(s) {
  let n = 0;
  const graphemes = segmenter ? [...segmenter.segment(s)].map((g) => g.segment) : [...s];
  for (const g of graphemes) {
    if (EMOJI_RE.test(g)) { n += 2; continue; }
    for (const ch of g) {
      const cp = ch.codePointAt(0);
      n += X_LIGHT.some(([a, b]) => cp >= a && cp <= b) ? 1 : 2;
    }
  }
  return n;
}

function xLength(text) {
  const s = text.normalize('NFC');
  let n = 0;
  let last = 0;
  for (const m of s.matchAll(URL_RE)) {
    const url = trimUrl(m[0]);
    n += xWeight(s.slice(last, m.index)) + X_URL_LENGTH;
    last = m.index + url.length;
  }
  return n + xWeight(s.slice(last));
}

// ---------------------------------------------------------------------------
// the blocks
// ---------------------------------------------------------------------------

const root = parse(html);
const lineOf = (offset) => html.slice(0, offset).split('\n').length;
const blocks = root.querySelectorAll('.copy');
if (!blocks.length) {
  console.log(`${basename(docPath)}: no copy blocks (div.copy) found`);
  process.exit(0);
}

const edits = [];
const lines = [];
let problems = 0;
const pad = Math.min(36, Math.max(...blocks.map((b) => (b.getAttribute('id') || '').length), 8));

for (const block of blocks) {
  const id = block.getAttribute('id');
  const where = id || `line ${lineOf(block.range[0])}`;
  const pre = block.querySelector('pre');
  const counter = block.querySelector('.count');
  const missing = [!id && 'an id', !pre && 'a <pre>', !counter && 'a .count'].filter(Boolean);
  if (missing.length) {
    problems++;
    lines.push(`ERROR  ${where.padEnd(pad)}  lacks ${missing.join(', ')}`);
    continue;
  }
  const limitAttr = block.getAttribute('data-limit');
  const limit = limitAttr == null || limitAttr === '' ? null : Number(limitAttr);
  if (limit != null && !(Number.isInteger(limit) && limit > 0)) {
    problems++;
    lines.push(`ERROR  ${where.padEnd(pad)}  data-limit="${limitAttr}" is not a whole number`);
    continue;
  }
  const mode = (block.getAttribute('data-count') || '').trim().toLowerCase();
  if (mode && mode !== 'x') {
    problems++;
    lines.push(`ERROR  ${where.padEnd(pad)}  data-count="${mode}" is unknown (use "x" or leave it out)`);
    continue;
  }
  if (/<[a-z/!]/i.test(pre.innerHTML)) {
    lines.push(`note   ${where.padEnd(pad)}  markup inside <pre> is not part of the text; write the text only`);
  }
  // Drop tags from the markup first, then decode: decoding first would turn
  // an escaped "&lt;name&gt;" into "<name>" and drop it as a tag.
  const text = parse(`<p>${pre.innerHTML.replace(/<[^>]*>/g, '')}</p>`).text.replace(/\r\n?/g, '\n').replace(/^\n/, '').replace(/\s+$/, '');
  const n = mode === 'x' ? xLength(text) : codePoints(text);
  const over = limit != null && n > limit;

  // The counter's new content and class.
  const inner = counter.innerHTML;
  const LEADING_NUMBER = /^\s*\d+(?:[\s  .,]\d{3})*/;
  const content = limit != null
    ? `${n} / ${limit}`
    : LEADING_NUMBER.test(inner) ? inner.replace(LEADING_NUMBER, String(n)) : `${n}${inner.trim() ? ` ${inner.trim()}` : ''}`;
  const classes = (counter.getAttribute('class') || '').split(/\s+/).filter((c) => c && c !== 'over');
  if (over) classes.push('over');
  const attrs = counter.rawAttrs.replace(/\bclass\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/i, `class="${classes.join(' ')}"`);
  const tag = counter.rawTagName;
  const next = `<${tag}${attrs ? ` ${attrs}` : ''}>${content}</${tag}>`;
  const current = html.slice(counter.range[0], counter.range[1]);
  const stale = current !== next;
  if (stale) edits.push({ start: counter.range[0], end: counter.range[1], text: next });

  const shown = limit != null ? `${n} / ${limit}` : `${n}`;
  let label = over ? 'OVER ' : 'OK   ';
  if (check && stale) label = 'STALE';
  if (over || (check && stale)) problems++;
  const note = [mode === 'x' && 'X count', over && `${n - limit} over`, check && stale && `the counter says "${counter.text.trim()}"`].filter(Boolean).join(', ');
  lines.push(`${label}  ${where.padEnd(pad)}  ${shown}${note ? `  (${note})` : ''}`);
}

for (const l of lines) console.log(l);

if (!check && edits.length) {
  let out = html;
  for (const e of edits.sort((a, b) => b.start - a.start)) out = out.slice(0, e.start) + e.text + out.slice(e.end);
  try {
    writeFileSync(docPath, out, 'utf8');
  } catch (e) {
    fail(`cannot write ${docPath}: ${e.code || e.message}`);
  }
}
const summary = check
  ? `${basename(docPath)}: ${blocks.length} copy blocks checked, nothing written`
  : `${basename(docPath)}: ${blocks.length} copy blocks, ${edits.length} counter(s) rewritten`;
console.log(problems ? `${summary}; ${problems} problem(s)` : summary);
process.exit(problems ? 2 : 0);
