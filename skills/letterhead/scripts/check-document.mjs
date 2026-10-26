#!/usr/bin/env node
// Checks a finished letterhead document before it goes to a reader.
//
// Errors block delivery: they are things a reader would notice or that break
// commenting (a missing heading id, leftover template text, a draft marker,
// unreadable contrast, a dark mode that ignores the reader's explicit light
// choice). Warnings and info are prompts for judgment, not failures.
//
// Usage:
//   node check-document.mjs <file.html>... [--json] [--render]
//
// --render also opens each document in a headless Chromium (lib/render.mjs):
// words the script writes or a click changes, elements a click moves, the
// outline after the script, sideways scroll at 1280 and 390 px (an error),
// print with a dark system theme, console errors. Without a browser or on
// Node older than 22 it says so as info (render/unavailable) and the static
// checks still run; that is not a pass for the phone width.
//
// Output: one line per finding, `<file>:<line> <severity> <rule> <message>`,
// then one summary line per file. --json prints one JSON object per finding
// and a final {"summary": ...} object.
//
// Exit codes:
//   0 — no errors (warnings and info allowed)
//   1 — usage error or unreadable file
//   2 — at least one error
//
// No dependencies beyond Node's built-ins and scripts/vendor/.

import { readFileSync } from 'node:fs';
import { parse } from './vendor/node-html-parser.mjs';
import {
  parseCss, walkRules, selectorList, isDarkSchemeMedia, LIGHT_GUARD_RE, isExplicitDark,
  resolveVars, readColor, backgroundColor, alphaOf, contrastRatio, lineIndex, splitTopLevel,
} from './lib/css.mjs';
import { parseArgs, emit } from './lib/report.mjs';
import { renderChecks } from './lib/render.mjs';

const USAGE = 'usage: node check-document.mjs <file.html>... [--json] [--render]';

// Text inside these elements is not prose the reader sees as the document's
// own words (code samples, scripts, styles), so the text rules skip it.
const NON_PROSE = new Set(['script', 'style', 'noscript', 'template', 'head', 'pre', 'code', 'kbd', 'samp', 'textarea']);

// ---------------------------------------------------------------------------
// Visible text: segments with their source offsets, so a match can be traced
// back to a line.
// ---------------------------------------------------------------------------

function proseSegments(root) {
  const segments = [];
  const walk = (node) => {
    for (const child of node.childNodes) {
      if (child.nodeType === 3) {
        const text = child.text;
        if (text.trim()) segments.push({ text, start: child.range ? child.range[0] : 0 });
      } else if (child.nodeType === 1) {
        const tag = (child.rawTagName || '').toLowerCase();
        if (NON_PROSE.has(tag)) continue;
        if (child.hasAttribute && child.hasAttribute('hidden')) continue;
        walk(child);
      }
    }
  };
  walk(root);
  return segments;
}

function searchProse(segments, re) {
  let joined = '';
  const map = [];
  for (const s of segments) {
    map.push({ at: joined.length, start: s.start });
    joined += s.text + ' ';
  }
  const m = re.exec(joined);
  if (!m) return null;
  let start = 0;
  for (const entry of map) {
    if (entry.at <= m.index) start = entry.start;
    else break;
  }
  return { text: m[0].replace(/\s+/g, ' ').trim(), start };
}

// ---------------------------------------------------------------------------
// Rules on the text
// ---------------------------------------------------------------------------

const PLACEHOLDER_PATTERNS = [
  /\blorem\s+ipsum\b|\bdolor\s+sit\s+amet\b/i,
  /\[\s*(?:your|tw[oó]j\p{L}*|insert|wstaw\p{L}*|company name|nazwa firmy)(?:\s[^\]\n]{0,60})?\]/iu,
  /\{\{\s*[^{}\n]{1,60}?\s*\}\}/,
];

const DRAFT_PATTERNS = [
  /\b(?:TODO|FIXME|TKTK)\b/,
  /\[(?:WIP|DRAFT)\]/,
  /[[(]\s*TBD\s*[\])]/i,
];

const AI_PATTERNS = [
  /\b(?:generated|created|written|drafted|produced)\s+(?:by|with|using)\s+(?:ai|an\s+ai(?:\s+\w+)?|chatgpt|gpt[-\w.]*|claude|gemini|copilot|an?\s+llm|a\s+language\s+model)\b/i,
  /\bwygenerowan\p{L}*\s+(?:przez|z|za\s+pomocą)\s+(?:ai|sztuczn\p{L}*\s+inteligencj\p{L}*|chatgpt|claude|gemini)/iu,
  /【[^】\n]{0,80}】/,
  /\[\s*cite(?:_start|_end)?\s*(?::[^\]\n]{0,80})?\]/i,
  /:contentReference\b|\boaicite\b|\boai_citation\b|\bturn\d+(?:search|news|view|fetch)\d+\b/i,
];

function textRules(root, add) {
  const segments = proseSegments(root);
  for (const re of PLACEHOLDER_PATTERNS) {
    const hit = searchProse(segments, re);
    if (hit) add('error', 'doc/template-leftover', hit.start, `Template text left in the document: "${hit.text}". Replace it with the real content or ask for it.`);
  }
  for (const re of DRAFT_PATTERNS) {
    const hit = searchProse(segments, re);
    if (hit) add('error', 'doc/draft-marker', hit.start, `Draft marker in the visible text: "${hit.text}". Resolve it, or turn it into an open question the reader can answer.`);
  }
  for (const re of AI_PATTERNS) {
    const hit = searchProse(segments, re);
    if (hit) add('error', 'doc/ai-residue', hit.start, `Assistant residue in the visible text: "${hit.text}". A document carries the sender's name, not the tool's.`);
  }
}

// ---------------------------------------------------------------------------
// Rules on the markup
// ---------------------------------------------------------------------------

function markupRules(root, add) {
  const at = (el) => (el && el.range ? el.range[0] : null);

  // Language: screen readers and hyphenation depend on it.
  const html = root.querySelector('html');
  const lang = html ? (html.getAttribute('lang') || '').trim() : '';
  if (!lang) add('error', 'doc/missing-lang', html ? at(html) : 'html', '<html> has no lang attribute. Set the document language, for example lang="en" or lang="pl".');

  // Title: review tools show the document by its <title>.
  const title = root.querySelector('title');
  if (!title || !title.text.trim()) {
    const h1 = root.querySelector('h1');
    const hint = h1 && h1.text.trim() ? ` The first <h1> ("${h1.text.trim().slice(0, 48)}") is a good source.` : '';
    add('error', 'doc/title-missing', title ? at(title) : 'head', `No <title>, or an empty one. Tools list the document by its title.${hint}`);
  }

  for (const img of root.querySelectorAll('img')) {
    if (img.getAttribute('alt') === undefined) {
      add('error', 'doc/img-no-alt', at(img), 'Image without an alt attribute. Describe what it shows, or use alt="" if it is decoration.');
    }
    if (!(img.getAttribute('width') && img.getAttribute('height'))) {
      const style = img.getAttribute('style') || '';
      if (!(/(?:^|;)\s*width\s*:/.test(style) && /(?:^|;)\s*height\s*:/.test(style))) {
        add('warning', 'doc/img-no-size', at(img), 'Image without width and height; the text below it jumps when it loads.');
      }
    }
  }

  for (const a of root.querySelectorAll('a[href]')) {
    if (a.text.trim()) continue;
    if ((a.getAttribute('aria-label') || '').trim() || a.getAttribute('aria-labelledby') || (a.getAttribute('title') || '').trim()) continue;
    if (a.querySelectorAll('img').some((img) => (img.getAttribute('alt') || '').trim())) continue;
    if (a.querySelectorAll('svg').some((svg) => (svg.getAttribute('aria-label') || '').trim() || (svg.querySelector('title')?.text || '').trim())) continue;
    add('error', 'doc/link-no-name', at(a), 'Link with nothing to read out: no text, no aria-label, no image with alt text.');
  }

  // Heading ids: comment anchors hang off them, so they must exist, be
  // unique, and come from the heading text rather than its position.
  const sectionHeadings = root.querySelectorAll('h2, h3');
  const seen = new Map();
  for (const h of sectionHeadings) {
    const text = h.text.trim().replace(/\s+/g, ' ');
    const label = `<${h.rawTagName.toLowerCase()}> "${text.slice(0, 48)}"`;
    const id = h.getAttribute('id');
    if (!id) {
      add('error', 'doc/heading-no-id', at(h), `${label} has no id. Every h2 and h3 needs a stable id derived from its text, or comments on it get lost in the next version.`);
      continue;
    }
    if (seen.has(id)) {
      add('error', 'doc/duplicate-id', at(h), `${label} reuses id "${id}" (already on ${seen.get(id)}). A link or comment anchor finds only the first one.`);
    } else {
      seen.set(id, label);
    }
    if (/^(section|sec|heading|h|part|s)[-_]?\d+$/i.test(id)) {
      add('warning', 'doc/positional-id', at(h), `${label} has id "${id}", which looks like a position. Adding a section renumbers it and detaches the comments; derive it from the heading text.`);
    }
  }
  if (sectionHeadings.length === 0) {
    add('warning', 'doc/no-sections', 'body', 'No h2 or h3 headings, so readers have no sections to comment on.');
  }

  // Self-contained: a sandboxed viewer or an offline reader cannot fetch.
  const external = /^(?:https?:)?\/\//i;
  for (const el of root.querySelectorAll('script[src], link[href], img[src], iframe[src], source[src], video[src], audio[src], embed[src], object[data]')) {
    const tag = el.rawTagName.toLowerCase();
    const url = el.getAttribute('src') || el.getAttribute('href') || el.getAttribute('data') || '';
    if (tag === 'link') {
      const rel = (el.getAttribute('rel') || '').toLowerCase();
      if (/\b(?:canonical|alternate|author|license|me)\b/.test(rel) && !/\b(?:stylesheet|icon|preload|modulepreload)\b/.test(rel)) continue;
    }
    if (external.test(url)) {
      const what = tag === 'script' ? 'External script' : `External <${tag}>`;
      add('error', 'doc/external-resource', at(el), `${what} (${url.slice(0, 80)}). The document must work as one file with no network: inline it or drop it.`);
    }
  }
  for (const style of root.querySelectorAll('style')) {
    const css = style.rawText || '';
    const m = /@import\s+(?:url\(\s*)?["']?(?:https?:)?\/\/[^"')\s;]*|url\(\s*["']?(?:https?:)?\/\/[^"')\s]*/i.exec(css);
    if (m) {
      add('error', 'doc/external-resource', at(style), `Stylesheet loads ${m[0].slice(0, 80)} from the network. Inline the asset or drop it.`);
    }
  }

  // Labeled metadata near the title.
  const header = root.querySelector('header') || root;
  const hasMeta = header.querySelector('dl') !== null || /class="[^"]*meta[^"]*"/.test(header.outerHTML || '');
  if (!hasMeta) {
    add('info', 'doc/no-metadata-block', 'header', 'No labeled metadata (status, owner, date) near the title. Readers decide what to do with a document from those fields.');
  }

  // Heading outline.
  const outline = root.querySelectorAll('h1, h2, h3, h4, h5, h6').map((el) => ({ el, level: Number(el.rawTagName[1]) }));
  const h1s = outline.filter((h) => h.level === 1);
  if (h1s.length === 0) add('warning', 'doc/heading-outline', 'body', 'No <h1>. The document title should also be its one top-level heading.');
  if (h1s.length > 1) add('warning', 'doc/heading-outline', at(h1s[1].el), `${h1s.length} <h1> elements. Keep one; the rest are sections (h2).`);
  for (let i = 1; i < outline.length; i++) {
    if (outline[i].level > outline[i - 1].level + 1) {
      add('warning', 'doc/heading-outline', at(outline[i].el), `Heading jumps from h${outline[i - 1].level} to h${outline[i].level}. Screen-reader navigation expects no skipped levels.`);
      break;
    }
  }

  // Sharing previews.
  const icon = root.querySelectorAll('link[rel]').some((l) => {
    const rel = (l.getAttribute('rel') || '').toLowerCase().split(/\s+/);
    return rel.includes('icon') || rel.includes('apple-touch-icon');
  });
  if (!icon) add('warning', 'doc/no-favicon', 'head', 'No <link rel="icon">. The browser tab shows a blank page icon.');
  const og = (prop) => root.querySelectorAll('meta').some((m) =>
    ((m.getAttribute('property') || m.getAttribute('name') || '').toLowerCase() === prop) && (m.getAttribute('content') || '').trim());
  const missingOg = ['og:title', 'og:description'].filter((p) => !og(p));
  if (missingOg.length) {
    add('warning', 'doc/no-link-preview', 'head', `Missing ${missingOg.join(' and ')}. A link pasted into chat or email shows no proper preview.`);
  }

  // Emoji and section numbers in front of headings.
  for (const h of root.querySelectorAll('h1, h2, h3')) {
    if (/^\s*[\p{Extended_Pictographic}\p{Regional_Indicator}]/u.test(h.text)) {
      add('info', 'doc/emoji-heading', at(h), `<${h.rawTagName.toLowerCase()}> starts with an emoji. In a business document it reads as chat, not as a heading.`);
    }
  }
  const numbered = [];
  for (const h of root.querySelectorAll('h1, h2, h3')) {
    const own = /^\s*(?:0\d|\d{1,2}\s*\/\s*\d{1,2})(?!\d)/.test(h.text);
    const prev = h.previousElementSibling;
    const before = prev && /^\s*0\d(?:\s*\/\s*\d{1,2})?\s*$/.test(prev.text);
    if (own || before) numbered.push(h);
  }
  if (numbered.length) {
    add('info', 'doc/section-numbers', at(numbered[0]), `${numbered.length} heading(s) carry "01 / 02" style numbers. Keep them only if the reader refers to sections by number.`);
  }
}

// ---------------------------------------------------------------------------
// Rules on the CSS
// ---------------------------------------------------------------------------

function styleSheets(root) {
  const sheets = [];
  for (const style of root.querySelectorAll('style')) {
    const text = style.rawText || '';
    const child = style.childNodes[0];
    const offset = child && child.range ? child.range[0] : (style.range ? style.range[0] : 0);
    sheets.push(parseCss(text, offset));
  }
  return sheets;
}

function isColorSchemeOrPrint(node) {
  return node.name === 'media' && /prefers-color-scheme|\bprint\b/i.test(node.prelude);
}

const LAYOUT_PROPS_RE = /(?<![\w-])(?:width|height|top|left)(?![\w-])/i;

function cssRules(sheets, add) {
  const all = sheets.flatMap((nodes) => [...walkRules(nodes)]);

  // Light tokens: every :root rule outside a dark-scheme query.
  const rootVars = new Map();
  for (const { rule, parents } of all) {
    if (parents.some(isDarkSchemeMedia)) continue;
    if (!selectorList(rule.selector).includes(':root')) continue;
    for (const d of rule.decls) if (d.prop.startsWith('--')) rootVars.set(d.prop, d.value);
  }
  const resolveIn = (rule, value) => {
    const local = new Map(rule.decls.filter((d) => d.prop.startsWith('--')).map((d) => [d.prop, d.value]));
    return resolveVars(value, (name) => (local.has(name) ? local.get(name) : rootVars.get(name)));
  };
  const lastDecl = (rule, props) => {
    let found = null;
    for (const d of rule.decls) if (props.includes(d.prop)) found = d;
    return found;
  };

  // Theme contract: the reader's explicit light choice must win over the
  // system dark preference.
  for (const { rule, parents } of all) {
    if (!parents.some(isDarkSchemeMedia)) continue;
    if (parents.some((p) => p.name === 'keyframes' || p.name === '-webkit-keyframes')) continue;
    const loose = selectorList(rule.selector).filter((s) => !LIGHT_GUARD_RE.test(s) && !isExplicitDark(s));
    if (loose.length) {
      add('error', 'doc/dark-overrides-light', rule.start, `"${loose[0].slice(0, 60)}" inside @media (prefers-color-scheme: dark) also applies when the reader picked light. Scope it under :root:not([data-theme="light"]).`);
    }
  }

  // Contrast, light theme, with var() resolved against :root.
  const contrastTargets = all.filter(({ rule, parents }) =>
    !parents.some(isColorSchemeOrPrint) &&
    !parents.some((p) => p.name === 'keyframes' || p.name === '-webkit-keyframes') &&
    !isExplicitDark(rule.selector));

  const isPageSelector = (s) => s === 'body' || s === 'html';
  const bodyState = { color: null, bg: null, htmlBg: null, start: null };
  for (const { rule } of contrastTargets) {
    const sels = selectorList(rule.selector);
    if (!sels.length) continue;
    if (sels.every(isPageSelector)) {
      const color = lastDecl(rule, ['color']);
      const bg = lastDecl(rule, ['background', 'background-color']);
      if (sels.includes('body')) {
        if (color) { bodyState.color = resolveIn(rule, color.value); bodyState.start = rule.start; }
        if (bg) { bodyState.bg = resolveIn(rule, bg.value); bodyState.start ??= rule.start; }
      } else if (bg) {
        bodyState.htmlBg = resolveIn(rule, bg.value);
      }
      continue;
    }
    const color = lastDecl(rule, ['color']);
    const bg = lastDecl(rule, ['background', 'background-color']);
    if (!color || !bg) continue;
    checkPair(rule.start, sels, resolveIn(rule, color.value), resolveIn(rule, bg.value), add);
  }
  if (bodyState.color) {
    checkPair(bodyState.start, ['body'], bodyState.color, bodyState.bg ?? bodyState.htmlBg, add);
  }

  // Motion that forces layout on every frame.
  for (const { rule, parents } of all) {
    const inKeyframes = parents.find((p) => p.name === 'keyframes' || p.name === '-webkit-keyframes');
    if (inKeyframes) continue;
    for (const d of rule.decls) {
      if (d.prop !== 'transition' && d.prop !== 'transition-property') continue;
      if (/(?<![\w-])all(?![\w-])/i.test(d.value)) {
        add('warning', 'doc/layout-animation', d.start, `"${rule.selector.slice(0, 40)}" uses transition: all, which also animates layout properties. Name the properties.`);
      } else if (LAYOUT_PROPS_RE.test(d.value)) {
        add('warning', 'doc/layout-animation', d.start, `"${rule.selector.slice(0, 40)}" animates width, height, top or left, which re-lays out the page each frame. Use transform or opacity.`);
      }
    }
  }
  for (const nodes of sheets) {
    const stack = [...nodes];
    while (stack.length) {
      const node = stack.pop();
      if (node.type !== 'at' || !node.children) continue;
      if (node.name === 'keyframes' || node.name === '-webkit-keyframes') {
        const moves = node.children.some((f) => f.decls.some((d) => LAYOUT_PROPS_RE.test(d.prop) && !d.prop.includes('-')));
        if (moves) add('warning', 'doc/layout-animation', node.start, `@keyframes ${node.prelude} animates width, height, top or left, which re-lays out the page each frame. Use transform or opacity.`);
      } else {
        stack.push(...node.children);
      }
    }
  }

  // Decorative effects worth a second look.
  for (const { rule } of all) {
    const clip = rule.decls.some((d) => /^(?:-webkit-)?background-clip$/.test(d.prop) && /\btext\b/.test(d.value));
    const gradient = rule.decls.some((d) => (d.prop === 'background' || d.prop === 'background-image') && /gradient\(/i.test(resolveIn(rule, d.value) || d.value));
    if (clip && gradient) {
      add('info', 'doc/gradient-text', rule.start, `"${rule.selector.slice(0, 40)}" fills text with a gradient. A solid color and weight read as more deliberate.`);
    }
    const blur = rule.decls.some((d) => /^(?:-webkit-)?backdrop-filter$/.test(d.prop) && /blur\(/i.test(d.value));
    if (blur) {
      const bg = lastDecl(rule, ['background', 'background-color']);
      const c = bg ? backgroundColor(resolveIn(rule, bg.value)) : null;
      if (c && alphaOf(c) < 1) {
        add('info', 'doc/frosted-glass', rule.start, `"${rule.selector.slice(0, 40)}" blurs what is behind a see-through background. In a document it mostly lowers contrast.`);
      }
    }
  }
}

function checkPair(start, selectors, fgValue, bgValue, add) {
  const fg = readColor(fgValue);
  const bg = backgroundColor(bgValue);
  if (!fg || !bg) return;
  if (alphaOf(bg) < 1 || alphaOf(fg) === 0) return;
  let ratio;
  try { ratio = contrastRatio(fg, bg); } catch { return; }
  if (!Number.isFinite(ratio)) return;
  const large = selectors.every((s) => {
    const last = s.split(/[\s>+~]+/).filter(Boolean).pop() || '';
    return /^h[12](?![\w-])/i.test(last);
  });
  const floor = large ? 3 : 4.5;
  if (ratio < floor) {
    add('error', 'doc/low-contrast', start, `"${selectors.join(', ').slice(0, 60)}" has text contrast ${ratio.toFixed(2)}:1, below ${floor}:1${large ? ' for large headings' : ''}.`);
  }
}

// ---------------------------------------------------------------------------
// Rules on the structure: what keeps comment anchors, links and the outline
// whole (reference/markup.md, templates/report/template.md)
// ---------------------------------------------------------------------------

// Labels that name the document's date in its metadata, in the languages the
// skill writes.
const DATE_LABEL_RE = /(?:^|\s)(?:date|dated|updated|written|released|issued|published|when|as of|period|data|datum|fecha|dato|dátum|stand|dnia|zaktualizowano|aktualizacja|wydano|napisano|okres|kiedy|termin)(?:$|\s|:)/i;
// A value that reads as a date: "18 October 2026", "Oct 18, 2026", "Sat 3 Oct",
// 2026-10-18, 18.10.2026.
const DATE_VALUE_RE = /\b\d{1,2}\s+\p{L}{3,}\.?(?:\s+(?:19|20)\d{2})?\b|\b\p{L}{3,}\.?\s+\d{1,2},?\s+(?:19|20)\d{2}\b|\b(?:19|20)\d{2}-\d{2}-\d{2}\b|\b\d{1,2}[./]\d{1,2}[./](?:19|20)?\d{2}\b/u;
const FLAT_LIMIT = 12;

// A state is a word or a short phrase ("passed", "waiting on client"). The
// styles keep a .state on one line, so a long one cannot wrap and, on a
// phone, pushes the page sideways. 24 characters is the longest honest
// phrase ("waiting for legal review" is 24) and still fits a 390 px screen
// beside its marker; a source, date or file name is longer than that.
const STATE_LIMIT = 24;

function structureRules(root, add) {
  const at = (el) => (el && el.range ? el.range[0] : null);
  const ids = new Set(root.querySelectorAll('[id]').map((el) => el.getAttribute('id')));
  for (const el of root.querySelectorAll('a[name]')) ids.add(el.getAttribute('name'));

  // The date is a labeled field, not a word in the kicker.
  const meta = root.querySelector('dl.meta') || (root.querySelector('header') || root).querySelector('dl');
  if (meta) {
    const labels = meta.querySelectorAll('dt').map((dt) => dt.text.trim());
    const values = meta.querySelectorAll('dd').map((dd) => dd.text.trim());
    if (labels.length && !labels.some((t) => DATE_LABEL_RE.test(t)) && !values.some((v) => DATE_VALUE_RE.test(v))) {
      add('warning', 'doc/meta-no-date', at(meta), `The metadata has no date field (${labels.slice(0, 5).join(', ')}). A reader places the document by its date; give it its own labeled field, not a word in the kicker.`);
    }
  }

  // Links inside the document land somewhere.
  const reported = new Set();
  for (const a of root.querySelectorAll('a[href^="#"]')) {
    const raw = a.getAttribute('href').slice(1);
    if (!raw || raw === 'top') continue;
    let id = raw;
    try { id = decodeURIComponent(raw); } catch {}
    if (ids.has(id) || reported.has(id)) continue;
    reported.add(id);
    add('error', 'doc/dead-anchor', at(a), `Link to "#${id}", and nothing in the document has that id. Point it at the heading's id, or the reader lands nowhere.`);
  }

  // Contents lists: two lists of the same sections drift apart; one list
  // that skips a section hides it.
  const lists = [];
  for (const el of root.querySelectorAll('nav, details')) {
    const links = el.querySelectorAll('a[href^="#"]').map((a) => a.getAttribute('href'));
    if (links.length < 3) continue;
    if (lists.some((l) => l.el === el || l.el.querySelectorAll('*').includes(el) || el.querySelectorAll('*').includes(l.el))) continue;
    lists.push({ el, hrefs: new Set(links) });
  }
  if (lists.length > 1) {
    const [first, ...rest] = lists;
    for (const other of rest) {
      const missing = [...first.hrefs].filter((h) => !other.hrefs.has(h));
      const extra = [...other.hrefs].filter((h) => !first.hrefs.has(h));
      if (missing.length || extra.length) {
        add('warning', 'doc/contents-mismatch', at(other.el), `Two contents lists name different sections (${[...missing, ...extra].slice(0, 4).join(', ')}). Keep one list: the next version updates one and forgets the other.`);
      }
    }
  }
  const contents = lists.find((l) => /\b(?:contents|toc)\b/.test(l.el.getAttribute('class') || '')) || (lists.length === 1 && lists[0].el.rawTagName.toLowerCase() === 'nav' ? lists[0] : null);
  if (contents) {
    // The contents' own heading is not a section it needs to list.
    const own = (h) => contents.el.querySelectorAll('h2').includes(h);
    const missing = root.querySelectorAll('h2[id]').filter((h) => !own(h)).map((h) => `#${h.getAttribute('id')}`).filter((h) => !contents.hrefs.has(h));
    if (missing.length) {
      add('warning', 'doc/contents-incomplete', at(contents.el), `The contents skip ${missing.length} section(s): ${missing.slice(0, 4).join(', ')}.`);
    }
  }

  // A flat page: one nth-of-type counter for every paragraph.
  for (const el of root.querySelectorAll('main, body, article, .doc')) {
    const ps = el.childNodes.filter((c) => c.nodeType === 1 && (c.rawTagName || '').toLowerCase() === 'p').length;
    if (ps > FLAT_LIMIT) {
      add('warning', 'doc/flat-main', at(el), `<${el.rawTagName.toLowerCase()}> holds ${ps} paragraphs directly. Wrap each part in its section: a comment anchored by position counts paragraphs across the whole page, so one new paragraph near the top moves every anchor below it.`);
      break;
    }
  }

  // A .state is one short word; the styles do not wrap it.
  for (const el of root.querySelectorAll('.state')) {
    // In the status ledger (.status) the styles render the state as wrapping prose.
    let inLedger = false;
    for (let p = el.parentNode; p && p.getAttribute; p = p.parentNode) {
      if ((p.getAttribute('class') || '').split(/\s+/).includes('status')) { inLedger = true; break; }
    }
    if (inLedger) continue;
    const text = el.text.replace(/\s+/g, ' ').trim();
    if (text.length > STATE_LIMIT) {
      add('warning', 'doc/state-long', at(el), `State chip of ${text.length} characters ("${text.slice(0, 40)}..."). A .state does not wrap, so on a phone it pushes the page sideways. A state is one word; put its source or detail beside it as plain text.`);
    }
  }

  // An SVG announced as one picture hides its buttons.
  for (const svg of root.querySelectorAll('svg[role="img"]')) {
    const control = svg.querySelector('[tabindex], [role="button"], a[href], button, [onclick]');
    if (control) {
      add('error', 'doc/svg-img-controls', at(control), 'Clickable or focusable parts inside an <svg role="img">: a screen reader treats the picture as one image and never reaches them. Use role="group" with a name, and buttons with their own labels.');
    }
  }

  // Lists hold list items.
  for (const list of root.querySelectorAll('ol, ul')) {
    const odd = list.childNodes.find((c) => c.nodeType === 1 && !['li', 'script', 'template'].includes((c.rawTagName || '').toLowerCase()));
    if (odd) {
      add('error', 'doc/list-children', at(odd), `<${list.rawTagName.toLowerCase()}> has a <${odd.rawTagName.toLowerCase()}> among its items. Only <li> belongs there; a screen reader announces the list with a stranger in it. Put the element inside an <li>.`);
    }
  }
}

// ---------------------------------------------------------------------------
// Rules on the tokens: pairs drawn on a lifted surface, in every theme, and
// embedded fonts that cost more than they show
// ---------------------------------------------------------------------------

// Pairs the report template draws: always checked when the tokens exist.
const SURFACE_PAIRS = [['tint-ink', 'tint'], ['foreground', 'tint'], ['surface-inverse-foreground', 'surface-inverse']];

function themeTokens(all) {
  const maps = { light: new Map(), dark: new Map(), system: new Map() };
  for (const { rule, parents } of all) {
    if (parents.some((p) => p.name === 'media' && /\bprint\b/i.test(p.prelude))) continue;
    const sels = selectorList(rule.selector);
    let which = null;
    if (parents.some(isDarkSchemeMedia)) {
      if (sels.some((x) => x.startsWith(':root'))) which = 'system';
    } else if (sels.includes(':root')) which = 'light';
    else if (sels.some((x) => isExplicitDark(x) && !/\s/.test(x.trim()))) which = 'dark';
    if (!which) continue;
    for (const d of rule.decls) if (d.prop.startsWith('--')) maps[which].set(d.prop, d.value);
  }
  return maps;
}

const tokenOf = (value) => /^var\(\s*(--[\w-]+)\s*(?:,[^)]*)?\)$/.exec((value || '').trim())?.[1] || null;

// A selector as compounds, left to right, with :where() scopes dropped and
// each compound as its simple selectors (tag, .class, [attr], #id).
function compounds(selector) {
  const bare = selector.replace(/:where\((?:[^()]|\([^()]*\))*\)/g, ' ');
  return splitTopLevel(bare.replace(/\s*[>+~]\s*/g, ' '), ' ').map((p) => p.part.trim()).filter(Boolean);
}
const simple = (compound) => compound.match(/^[a-z][\w-]*|\.[\w-]+|\[[^\]]+\]|#[\w-]+/gi) || [];
const PSEUDO_STATE_RE = /:(?:hover|focus|focus-visible|focus-within|active|visited)|::/;

function tokenRules(sheets, add) {
  const all = sheets.flatMap((nodes) => [...walkRules(nodes)]);
  const maps = themeTokens(all);
  if (!maps.light.size) return;
  const lookupIn = (theme) => (name) => (maps[theme].has(name) ? maps[theme].get(name) : maps.light.get(name));
  const color = (theme, token, bg) => {
    const v = resolveVars(`var(${token})`, lookupIn(theme));
    return bg ? backgroundColor(v) : readColor(v);
  };
  const done = new Set();
  const check = (text, surface, severity, start, why) => {
    for (const theme of ['light', 'dark', 'system']) {
      if (theme !== 'light' && !maps[theme].size) continue;
      const key = `${text}|${surface}|${theme}`;
      if (done.has(key)) continue;
      done.add(key);
      const fg = color(theme, text, false);
      const bg = color(theme, surface, true);
      if (!fg || !bg || alphaOf(bg) < 1 || alphaOf(fg) === 0) continue;
      let ratio;
      try { ratio = contrastRatio(fg, bg); } catch { continue; }
      if (Number.isFinite(ratio) && ratio < 4.5) {
        add(severity, 'doc/theme-contrast', start, `${text} on ${surface} in the ${theme === 'system' ? 'system dark' : theme} theme is ${ratio.toFixed(2)}:1, below 4.5:1${why}.`);
      }
    }
  };
  for (const [t, sfc] of SURFACE_PAIRS) {
    if (maps.light.has(`--${t}`) && maps.light.has(`--${sfc}`)) check(`--${t}`, `--${sfc}`, 'error', 'tokens', '');
  }
  // Text colored by token on a surface filled by token, in every theme. The
  // surface is the nearest fill the selector names: the element's own
  // compound first, then its ancestors, right to left. `.todo { background:
  // var(--tint) }` with `.todo .label { color: var(--primary-ink) }` is the
  // pair; hover and focus fills are not the resting surface.
  const fills = [];
  const inks = [];
  for (const { rule, parents } of all) {
    if (parents.some(isColorSchemeOrPrint)) continue;
    const bgDecl = rule.decls.filter((d) => d.prop === 'background' || d.prop === 'background-color').pop();
    const colorDecl = rule.decls.filter((d) => d.prop === 'color').pop();
    const bgToken = bgDecl && tokenOf(bgDecl.value);
    const colorToken = colorDecl && tokenOf(colorDecl.value);
    for (const sel of selectorList(rule.selector)) {
      const parts = compounds(sel);
      if (!parts.length) continue;
      const last = parts[parts.length - 1];
      if (bgToken && bgToken !== '--background' && !PSEUDO_STATE_RE.test(last)) {
        const ownColor = !!colorDecl;
        const alternatives = /^:is\((.*)\)$/.exec(last)?.[1];
        for (const alt of alternatives ? splitTopLevel(alternatives, ',').map((x) => x.part.trim()) : [last]) {
          const keys = simple(alt);
          if (keys.length) fills.push({ token: bgToken, keys, ownColor });
        }
      }
      if (colorToken && !bgToken && !PSEUDO_STATE_RE.test(last)) inks.push({ token: colorToken, parts, selector: sel, start: colorDecl.start });
    }
  }
  const alternativesOf = (compound) => {
    const m = /:is\((.*)\)/.exec(compound);
    if (!m) return [compound];
    const rest = compound.replace(m[0], '');
    return splitTopLevel(m[1], ',').map((x) => `${rest}${x.part.trim()}`);
  };
  for (const inkAll of inks) {
    // An ink compound written as :is(a, b) is several selectors.
    const lastAlts = alternativesOf(inkAll.parts[inkAll.parts.length - 1]);
    for (const lastAlt of lastAlts) {
    const ink = { ...inkAll, parts: [...inkAll.parts.slice(0, -1), lastAlt] };
    for (let i = ink.parts.length - 1; i >= 0; i--) {
      const own = i === ink.parts.length - 1;
      const sets = alternativesOf(ink.parts[i]).map((c) => new Set(simple(c).map((k) => k.toLowerCase())));
      // On the element itself, a fill rule that sets its own text color
      // wins over this one there; only ancestors' fills count then.
      const hits = fills.filter((f) => !(own && f.ownColor) && sets.some((have) => f.keys.every((k) => have.has(k.toLowerCase()))));
      if (!hits.length) continue;
      const best = hits.reduce((a, b) => (b.keys.length >= a.keys.length ? b : a));
      check(ink.token, best.token, 'warning', ink.start, ` ("${ink.selector.slice(0, 50)}" on a ${best.token} fill)`);
      break;
    }
    }
  }

  // Embedded fonts: a face no font token names (an accent for a few words)
  // costs every reader its full size.
  const named = new Set(['--font-sans', '--font-display', '--font-serif', '--font-mono', '--font-label', '--font-accent']
    .map((k) => resolveVars(maps.light.get(k) || '', lookupIn('light')) || '')
    .map((v) => v.split(',')[0].trim().replace(/^["']|["']$/g, '').toLowerCase()).filter(Boolean));
  const accentFamily = (resolveVars(maps.light.get('--font-accent') || '', lookupIn('light')) || '').split(',')[0].trim().replace(/^["']|["']$/g, '').toLowerCase();
  const sizes = new Map();
  for (const nodes of sheets) {
    for (const node of nodes) {
      if (node.type !== 'at' || node.name !== 'font-face') continue;
      const fam = (node.decls.find((d) => d.prop === 'font-family')?.value || '').trim().replace(/^["']|["']$/g, '').toLowerCase();
      const src = node.decls.find((d) => d.prop === 'src')?.value || '';
      const b64 = /base64,([A-Za-z0-9+/=]+)/.exec(src)?.[1];
      if (!fam || !b64) continue;
      const cur = sizes.get(fam) || { bytes: 0, start: node.start };
      cur.bytes += b64.length;
      sizes.set(fam, cur);
    }
  }
  for (const [fam, { bytes, start }] of sizes) {
    const minor = !named.has(fam) || fam === accentFamily;
    if (minor && bytes > 60 * 1024) {
      add('warning', 'doc/large-font', start, `"${fam}" is embedded at ${Math.round(bytes / 1024)} KB for a face no body or heading uses. Cut it down to the letters it sets (brand-tokens.mjs --font-accent does), or drop it.`);
    }
  }
}

// ---------------------------------------------------------------------------

// The words of <body> as the HTML has them: scripts and styles left out, and
// short live regions ("Step 2 of 10"), which the render check leaves out too.
function staticText(root) {
  const body = root.querySelector('body');
  if (!body) return null;
  const parts = [];
  const walk = (node) => {
    for (const child of node.childNodes) {
      if (child.nodeType === 3) parts.push(child.text);
      else if (child.nodeType === 1) {
        const tag = (child.rawTagName || '').toLowerCase();
        if (['script', 'style', 'template', 'noscript'].includes(tag)) continue;
        // The parser keeps a <pre>'s inner markup as text.
        if (tag === 'pre') { parts.push(child.text.replace(/<[^>]*>/g, '')); continue; }
        if ((child.hasAttribute('aria-live') || ['status', 'timer'].includes(child.getAttribute('role'))) && child.text.trim().length <= 80) continue;
        walk(child);
      }
    }
  };
  walk(body);
  return parts.join('');
}

function checkFile(file) {
  let html;
  try {
    html = readFileSync(file, 'utf8');
  } catch (e) {
    return { file, fatal: e.message, findings: [] };
  }
  const toLine = lineIndex(html);
  const findings = [];
  const add = (severity, rule, where, message) => {
    const line = typeof where === 'number' ? toLine(where) : null;
    findings.push({ severity, rule, line, locator: typeof where === 'number' ? `line ${line}` : where, message });
  };
  const root = parse(html);
  textRules(root.querySelector('body') || root, add);
  markupRules(root, add);
  structureRules(root, add);
  const sheets = styleSheets(root);
  cssRules(sheets, add);
  tokenRules(sheets, add);
  return { file, findings, staticText: staticText(root) };
}

const argv = process.argv.slice(2);
const render = argv.includes('--render');
const { files, json } = parseArgs(argv.filter((a) => a !== '--render'), USAGE);
const results = files.map(checkFile);
if (render) {
  for (const r of results) {
    if (r.fatal) continue;
    r.findings.push(...await renderChecks(r.file, r.staticText));
  }
}
process.exit(emit(results, json));
