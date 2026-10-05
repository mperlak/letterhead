#!/usr/bin/env node
// Puts a profile's tokens.css into a document: the whole file (embedded
// fonts, logo, the three theme blocks) as one
//   <style data-letterhead-tokens>…</style>
// in <head>. A second run replaces that block instead of adding another, so
// the command is safe to repeat after the tokens change. When the document
// has no <link rel="icon">, it adds one: a small SVG in the primary color.
//
// Pasting a 100 KB tokens file by hand is where agents lose the dark blocks
// or the font section; this does it in one call.
//
// Usage:
//   node apply-tokens.mjs <profile-dir | tokens.css> <doc.html>
//
// The document is rewritten in place. The tokens block goes before the
// first <style> in <head> (the document's own styles come after it), or at
// the end of <head> when it has none.
//
// Exit codes:
//   0 — tokens written
//   1 — usage error, unreadable input, or a document without <head>/<html>
//
// No dependencies beyond Node's built-ins and scripts/vendor/culori.mjs.

import { readFileSync, writeFileSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { parse, formatHex } from './vendor/culori.mjs';

const USAGE = 'usage: node apply-tokens.mjs <profile-dir | tokens.css> <doc.html>';

function fail(msg) {
  console.error(msg);
  process.exit(1);
}

const [source, docArg, ...extra] = process.argv.slice(2);
if (source === '-h' || source === '--help') {
  console.log(USAGE);
  process.exit(0);
}
if (!source || !docArg || extra.length) fail(USAGE);

let tokensPath = resolve(source);
try {
  if (statSync(tokensPath).isDirectory()) tokensPath = join(tokensPath, 'tokens.css');
} catch (e) {
  fail(`cannot read ${source}: ${e.code || e.message}`);
}

let tokens;
let html;
try {
  tokens = readFileSync(tokensPath, 'utf8');
} catch (e) {
  fail(`cannot read ${tokensPath}: ${e.code || e.message}`);
}
const docPath = resolve(docArg);
try {
  html = readFileSync(docPath, 'utf8');
} catch (e) {
  fail(`cannot read ${docPath}: ${e.code || e.message}`);
}
if (/<\/style/i.test(tokens)) fail(`${tokensPath} contains "</style", which would end the style element early`);

const block = `<style data-letterhead-tokens>\n${tokens.replace(/\s+$/, '')}\n</style>`;
const EXISTING_RE = /<style\b[^>]*\bdata-letterhead-tokens\b[^>]*>[\s\S]*?<\/style>/i;

let action;
let out = html;
if (EXISTING_RE.test(out)) {
  action = 'replaced';
  out = out.replace(EXISTING_RE, () => block);
} else {
  if (!/<head\b[^>]*>/i.test(out)) {
    if (!/<html\b[^>]*>/i.test(out)) fail(`${docPath} has neither <head> nor <html>; write the document shell first`);
    out = out.replace(/<html\b[^>]*>/i, (m) => `${m}\n<head>\n</head>`);
  }
  const headStart = out.search(/<head\b[^>]*>/i);
  const headEnd = out.search(/<\/head>/i);
  const head = headEnd > headStart ? out.slice(headStart, headEnd) : out.slice(headStart);
  const firstStyle = head.search(/<style\b/i);
  if (firstStyle !== -1) {
    const at = headStart + firstStyle;
    out = `${out.slice(0, at)}${block}\n${out.slice(at)}`;
  } else if (headEnd !== -1) {
    out = `${out.slice(0, headEnd)}${block}\n${out.slice(headEnd)}`;
  } else {
    const openEnd = headStart + /<head\b[^>]*>/i.exec(out.slice(headStart))[0].length;
    out = `${out.slice(0, openEnd)}\n${block}\n${out.slice(openEnd)}`;
  }
  action = 'inserted';
}

// Favicon: only when the document has none. The primary comes from the
// first --primary declaration, which is the light theme's.
let favicon = 'kept';
const hasIcon = [...out.matchAll(/<link\b[^>]*>/gi)].some((m) => /\brel\s*=\s*["']?[^"'>]*\bicon\b/i.test(m[0]));
if (!hasIcon) {
  const primaryRaw = (/(?:^|[;{\s])--primary\s*:\s*([^;]+);/.exec(tokens) || [])[1];
  const color = primaryRaw ? parse(primaryRaw.trim()) : null;
  const hex = color ? formatHex(color) : '#888888';
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'><rect x='4' y='4' width='24' height='24' rx='4' fill='${hex}'/></svg>`;
  const link = `<link rel="icon" href="data:image/svg+xml,${encodeURIComponent(svg)}">`;
  const at = out.search(/<style\b[^>]*\bdata-letterhead-tokens\b/i);
  out = `${out.slice(0, at)}${link}\n${out.slice(at)}`;
  favicon = `added (${hex})`;
}

try {
  writeFileSync(docPath, out, 'utf8');
} catch (e) {
  fail(`cannot write ${docPath}: ${e.code || e.message}`);
}
console.log(`tokens: ${action} (${Math.round(Buffer.byteLength(tokens, 'utf8') / 1024)} KB from ${tokensPath})`);
console.log(`favicon: ${favicon}`);
