#!/usr/bin/env node
// Puts a template's own layout into a document, for the templates that carry
// one (report): templates/<slug>/<slug>.css and, when present,
// templates/<slug>/<slug>.js.
//
//   <style data-letterhead-template="<slug>">    after the tokens block, in
//                                                place of the style's
//                                                style.css, ahead of the
//                                                document's own <style>
//   <script data-letterhead-template="<slug>">   last in <body>
//
// The style block ends with the CSS that draws the logo (.brand-mark) the
// way the document's tokens carry it. apply-tokens.mjs runs this script
// again after it changes the tokens, so the two never disagree.
//
// The template's CSS replaces the style's layout (a report lays out like a
// report in every style; the style and the brand still give it colors,
// fonts, radii and the type scale through the tokens), so the
// data-letterhead-style block is removed, and apply-tokens.mjs leaves it out
// while a template block is there. A second run replaces both blocks
// instead of adding more, so the command is safe to repeat after the
// skill's files change.
//
// Usage:
//   node apply-template.mjs <template-slug> <doc.html>
//
// Run apply-tokens.mjs first: the template reads only var(--*) tokens.
//
// Exit codes:
//   0 — written
//   1 — usage error, unknown template, unreadable input, or a document
//       without the tokens block, <head> or <body>
//
// No dependencies beyond Node's built-ins.

import { readFileSync, writeFileSync, existsSync, readdirSync } from 'node:fs';
import { join, resolve, dirname, basename } from 'node:path';
import { fileURLToPath } from 'node:url';

const SKILL = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const TEMPLATES = join(SKILL, 'templates');
const USAGE = 'usage: node apply-template.mjs <template-slug> <doc.html>';

function fail(msg) {
  console.error(msg);
  process.exit(1);
}

const args = process.argv.slice(2);
if (args.includes('-h') || args.includes('--help')) {
  console.log(USAGE);
  process.exit(0);
}
if (args.length !== 2 || args.some((a) => a.startsWith('--'))) fail(USAGE);
const [slug, docArg] = args;

const withLayout = () => readdirSync(TEMPLATES).filter((s) => existsSync(join(TEMPLATES, s, `${s}.css`))).sort();
if (!/^[a-z0-9-]+$/.test(slug) || !existsSync(join(TEMPLATES, slug, `${slug}.css`))) {
  fail(`template "${slug}" has no layout of its own; templates that do: ${withLayout().join(', ')}`);
}
const css = readFileSync(join(TEMPLATES, slug, `${slug}.css`), 'utf8').replace(/\s+$/, '');
const jsPath = join(TEMPLATES, slug, `${slug}.js`);
const js = existsSync(jsPath) ? readFileSync(jsPath, 'utf8').replace(/\s+$/, '') : null;
if (/<\/style/i.test(css)) fail(`${slug}.css contains "</style", which would end the style element early`);
if (js && /<\/script/i.test(js)) fail(`${slug}.js contains "</script", which would end the script element early`);

const docPath = resolve(docArg);
let html;
try {
  html = readFileSync(docPath, 'utf8');
} catch (e) {
  fail(`cannot read ${docArg}: ${e.code || e.message}`);
}

const TOKENS_RE = /<style\b[^>]*\bdata-letterhead-tokens\b[^>]*>[\s\S]*?<\/style>\n?/i;
const STYLE_RE = /<style\b[^>]*\bdata-letterhead-style\b[^>]*>[\s\S]*?<\/style>\n?/i;
const TPL_STYLE_RE = /<style\b[^>]*\bdata-letterhead-template\b[^>]*>[\s\S]*?<\/style>\n?/gi;
const TPL_SCRIPT_RE = /<script\b[^>]*\bdata-letterhead-template\b[^>]*>[\s\S]*?<\/script>\n?/gi;

if (!TOKENS_RE.test(html)) fail(`${basename(docPath)} has no <style data-letterhead-tokens> block; run apply-tokens.mjs first`);
if (js && !/<\/body>/i.test(html)) fail(`${basename(docPath)} has no </body>; write the document shell first`);

let out = html;
const hadStyle = STYLE_RE.test(out);
const hadTemplate = TPL_STYLE_RE.test(out);
TPL_STYLE_RE.lastIndex = 0;
out = out.replace(STYLE_RE, '').replace(TPL_STYLE_RE, '').replace(TPL_SCRIPT_RE, '');

// The logo, drawn the way the tokens carry it (reference/create.md, Logo):
// single-color artwork as a mask in --brand-logo-color, which each theme
// sets; anything else as the image on its plate. Read from the tokens in
// the document, so it follows the brand apply-tokens.mjs put there.
const tokensCss = TOKENS_RE.exec(out)?.[0] || '';
let logoCss = '';
if (/--brand-logo-mask\s*:/.test(tokensCss)) {
  logoCss = '.brand-mark { background-color: var(--brand-logo-color); -webkit-mask: var(--brand-logo-mask) left center / contain no-repeat; mask: var(--brand-logo-mask) left center / contain no-repeat; }';
} else if (/--brand-logo\s*:/.test(tokensCss)) {
  logoCss = '.brand-mark { box-sizing: content-box; padding: 6px 10px; border-radius: 3px; background: var(--brand-logo) left center / contain no-repeat; background-origin: content-box; background-color: var(--brand-logo-plate, transparent); }';
}
const styleBlock = `<style data-letterhead-template="${slug}">\n${css}${logoCss ? `\n\n/* logo (from the tokens) */\n${logoCss}` : ''}\n</style>\n`;
const tokens = TOKENS_RE.exec(out);
out = out.slice(0, tokens.index + tokens[0].length) + styleBlock + out.slice(tokens.index + tokens[0].length);
if (js) {
  const at = out.search(/<\/body>/i);
  out = `${out.slice(0, at)}<script data-letterhead-template="${slug}">\n${js}\n</script>\n${out.slice(at)}`;
}

try {
  writeFileSync(docPath, out, 'utf8');
} catch (e) {
  fail(`cannot write ${docPath}: ${e.code || e.message}`);
}
console.log(`${hadTemplate ? 'replaced' : 'inserted'} the "${slug}" template in ${basename(docPath)} (${Math.round(Buffer.byteLength(css, 'utf8') / 1024)} KB CSS${js ? `, ${Math.round(Buffer.byteLength(js, 'utf8') / 1024)} KB script` : ''})`);
if (hadStyle) console.log("style.css: removed (the template's layout replaces it; the style still gives the tokens)");
