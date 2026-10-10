#!/usr/bin/env node
// Smoke test for letterhead/scripts/brand-sheet.mjs.
//
// Renders the pl and en synthetic fixtures under dev-scripts/fixtures/
// brand-sheet/, then asserts the handful of behaviors the spec calls out by
// name: the seven fixed section ids appear in order, question ids are
// present, no external http(s) resource reference leaked into the markup,
// the <title> is localized, the primary swatch shows the exact captured
// hex, and check-document.mjs finds no errors (warnings and info are
// printed, not asserted away). Logo: the data URI is in the page once (the
// tokens), every mark draws it through var(--brand-logo) at the artwork's
// own proportions, and the second panel is a dark-theme panel. A third run
// regenerates the en fixture's tokens with brand-tokens.mjs (single-color
// logo, --font-file fonts, no network) and checks the logo is one mask copy
// with a per-theme color and the embedded font faces reach the sheet. Last,
// apply-tokens.mjs puts that profile's tokens into a small document: one
// block, before the document's own style, a favicon, idempotent on a second
// run, and check-document passes. A profile without `preview` gets a
// neutral sample labeled as one, and prose in the wrong language is a
// warning. The sentence under Colors says the primary is darkened for text
// only when --primary-ink differs from --primary. The preview is a document
// laid out by the base style's style.css (a real preview's head, or a
// sample about the profile: status ledger from the confidences, swatches,
// questions, next steps), the sheet's element rules skip it, and a style
// without style.css falls back to the plain card.
//
// Usage: node dev-scripts/brand-sheet-smoke.mjs
// Exit codes: 0 all assertions passed, 1 a run or assertion failed.

import { spawnSync } from 'node:child_process';
import { readFileSync, writeFileSync, mkdtempSync, cpSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SCRIPT = join(ROOT, 'letterhead', 'scripts', 'brand-sheet.mjs');
const CHECK_SCRIPT = join(ROOT, 'letterhead', 'scripts', 'check-document.mjs');
const FIXTURES = join(ROOT, 'dev-scripts', 'fixtures', 'brand-sheet');
const TOKENS_SCRIPT = join(ROOT, 'letterhead', 'scripts', 'brand-tokens.mjs');
const APPLY_SCRIPT = join(ROOT, 'letterhead', 'scripts', 'apply-tokens.mjs');
const CORPORATE = join(ROOT, 'letterhead', 'styles', 'corporate', 'tokens.css');
const FONT_FIXTURE = join(ROOT, 'dev-scripts', 'fixtures', 'brand-tokens', 'roboto-variable-subset.woff2');

const SECTION_IDS = ['logo-and-name', 'colors', 'typography', 'tone', 'composition', 'questions', 'preview'];

let failures = 0;
function check(label, cond) {
  if (cond) {
    console.log(`  ok - ${label}`);
  } else {
    console.log(`  FAIL - ${label}`);
    failures++;
  }
}

// A blind substring scan for "http(s)://" would false-positive on the SVG
// xmlns namespace URI that necessarily rides along inside any inline data:
// URI logo/favicon — those never leave the sandboxed document. This checks
// the thing the contract actually cares about: no attribute or url()
// resolves to an external http(s) resource.
function hasExternalHttpRef(html) {
  return /(?:src|href)\s*=\s*["']https?:\/\//i.test(html) || /url\(\s*["']?https?:\/\//i.test(html);
}

// Width over height of a mark's content box, from its inline style.
function markRatio(tag) {
  const w = Number((/width:([\d.]+)px/.exec(tag) || [])[1]);
  const h = Number((/height:([\d.]+)px/.exec(tag) || [])[1]);
  return w && h ? Math.round((w / h) * 100) / 100 : null;
}

function runBrandSheet(fixtureDir, outPath) {
  const res = spawnSync(process.execPath, [SCRIPT, fixtureDir, '--out', outPath], { encoding: 'utf8' });
  return res;
}

const tmp = mkdtempSync(join(tmpdir(), 'brand-sheet-smoke-'));

for (const lang of ['pl', 'en']) {
  console.log(`fixture: ${lang}`);
  const fixtureDir = join(FIXTURES, lang);
  const outPath = join(tmp, `${lang}.html`);
  const res = runBrandSheet(fixtureDir, outPath);

  check('brand-sheet.mjs exits 0 (no check-document errors)', res.status === 0);
  if (res.status !== 0) {
    console.log(res.stdout);
    console.log(res.stderr);
    failures += 8;
    continue;
  }

  let html;
  try {
    html = readFileSync(outPath, 'utf8');
  } catch (e) {
    check('output file readable', false);
    console.log(`    ${e.message}`);
    failures += 7;
    continue;
  }

  const idPositions = SECTION_IDS.map((id) => html.indexOf(`id="${id}"`));
  check('all seven fixed section ids present', idPositions.every((p) => p >= 0));
  const inOrder = idPositions.every((p, i) => i === 0 || p > idPositions[i - 1]);
  check('seven fixed section ids appear in order', inOrder);

  check('question ids present', html.includes('id="q-name-form"') && html.includes('id="q-second-color"'));

  check('no http(s):// external resource reference', !hasExternalHttpRef(html));

  const expectedTitle = lang === 'pl' ? '<title>Arkusz marki: Nimbus Freight</title>' : '<title>Brand sheet: Nimbus Freight</title>';
  check('title is localized', html.includes(expectedTitle));
  check('one <h1> on the page (the preview title is a paragraph)', (html.match(/<h1\b/g) || []).length === 1);

  const previewHtml = html.slice(html.indexOf('id="preview"'));
  const realTitle = lang === 'pl' ? 'Specyfikacja: portal zgłoszeń transportowych' : 'Specification: transport booking portal';
  check('the preview is a document laid out by the base style (corporate)', previewHtml.includes('<div class="preview-frame">') && previewHtml.includes('<div class="doc">') && /\/\* ---- the base style \(corporate\)/.test(html) && html.includes(':where(.doc)'));
  check('a real preview opens with its own title and next step', previewHtml.includes(`<p class="pv-title">${realTitle}</p>`) && previewHtml.includes(lang === 'pl' ? 'recenzja specyfikacji przez Nimbus Freight' : 'review of the specification by Nimbus Freight'));
  check('the style\'s h1 rules reach the preview title', /:is\(h1, \.pv-title\)/.test(html));
  check('the sheet\'s element rules skip the preview document', /h2:where\(:not\(\.doc \*\)\) \{/.test(html) && /dl\.meta:where\(:not\(\.doc \*\)\) \{/.test(html));
  check('the style\'s page-level rules stay out (no second body rule)', (html.match(/^body \{/gm) || []).length === 1);

  check('primary swatch shows the exact captured hex', html.includes('#3B6FE0'));

  const fixtureTokens = readFileSync(join(fixtureDir, 'tokens.css'), 'utf8');
  const payload = /--brand-logo:\s*url\("([^"]+)"\)/.exec(fixtureTokens)[1];
  check('logo payload appears once (in the tokens only)', html.split(payload).length === 2);
  check('no <img> copies of the logo', !/<img\b/i.test(html));
  const marks = html.match(/<span class="(?:brand-mark )?mark-img[^>]*>/g) || [];
  check('every mark keeps the artwork proportions (120 / 40)', marks.length === 4 && marks.every((m) => Math.abs(markRatio(m) - 3) < 0.02));
  check('marks draw var(--brand-logo)', /\.mark-img\s*\{[^}]*background-image: var\(--brand-logo\)/.test(html));
  if (/--brand-logo-on:\s*dark/.test(fixtureTokens)) {
    check('artwork on a dark band: second panel is bare paper', /<div class="logopanel logopanel--light">\s*<span class="mark-img mark--panel mark-img--bare"/.test(html));
  } else {
    check('artwork on paper: second panel is a dark-theme panel', /<div class="logopanel logopanel--themed" data-theme="dark">\s*<span class="mark-img/.test(html));
  }
  check('title block keeps its side padding', !/titleblock \{ padding: 34px 0/.test(html));

  const checkRes = spawnSync(process.execPath, [CHECK_SCRIPT, outPath], { encoding: 'utf8' });
  check('check-document.mjs exits 0', checkRes.status === 0);
  const findingLines = (checkRes.stdout || '').trim().split('\n').filter((l) => l && !/^[✓✗] /.test(l));
  if (checkRes.status !== 0 || findingLines.length) {
    console.log('    check-document.mjs output:');
    for (const line of (checkRes.stdout || '').trim().split('\n')) console.log(`    ${line}`);
  }
}

console.log('no preview in the meta file: a neutral, labeled sample');
for (const lang of ['pl', 'en']) {
  const dir = join(tmp, `sample-${lang}`);
  cpSync(join(FIXTURES, lang), dir, { recursive: true });
  const metaPath = join(dir, 'profile.meta.json');
  const meta = JSON.parse(readFileSync(metaPath, 'utf8'));
  delete meta.preview;
  delete meta.notes.preview;
  writeFileSync(metaPath, JSON.stringify(meta, null, 2));
  const outPath = join(tmp, `sample-${lang}.html`);
  const res = runBrandSheet(dir, outPath);
  check(`${lang}: brand-sheet.mjs exits 0`, res.status === 0);
  let html = '';
  try { html = readFileSync(outPath, 'utf8'); } catch {}
  const preview = html.slice(html.indexOf('id="preview"'));
  const title = lang === 'pl' ? 'Nimbus Freight: przykładowy dokument' : 'Nimbus Freight: sample document';
  const pvTitle = lang === 'pl' ? 'Nimbus Freight: profil marki do sprawdzenia' : 'Nimbus Freight: brand profile for review';
  check(`${lang}: the sample is a document about the profile itself`, preview.includes(`<p class="pv-title">${pvTitle}</p>`));
  check(`${lang}: the sample is labeled`, preview.includes(`<span class="tag">${lang === 'pl' ? 'przykład' : 'sample'}</span>`));
  check(`${lang}: no invented next step in the sample metadata`, !preview.includes(`<dt>${lang === 'pl' ? 'Następny krok' : 'Next step'}</dt>`));
  check(`${lang}: the sample uses the document markup`, ['class="summary"', 'class="status"', 'class="table-wrap"', 'class="callout"', 'class="steps"'].every((c) => preview.includes(c)));
  const ledger = (lang === 'pl' ? ['potwierdzone', 'do sprawdzenia', 'odczytane'] : ['confirmed', 'please check', 'read from source']);
  check(`${lang}: the status ledger follows each field's confidence`, /<span class="state ok">/.test(preview) && ledger.every((w) => preview.includes(`>${w}</span>`)));
  check(`${lang}: each color value in the table has its swatch`, preview.includes('style="background:#3B6FE0"') && preview.includes('#3B6FE0</td>'));
  const n = meta.questions.length;
  check(`${lang}: the questions are counted in the callout`, n === 3 && preview.includes(lang === 'pl' ? '3 pytania czekają' : '3 questions wait'));
  check(`${lang}: the composition section speaks plainly`, !/Kompozycję przyjmujemy|We take composition from/.test(html));
  check(`${lang}: the composition fields are not listed as settings`, !/Gęstość:|Zdjęcia:|Rytm:|Density:|Imagery:|Rhythm:/.test(html) && Boolean(meta.fields['composition.density']));
  check(`${lang}: the typography sample uses the same title`, html.includes(`<p class="t-display">${title}</p>`));
  check(`${lang}: no preview fallback warnings`, !/preview/.test(res.stderr || ''));

  // The first screen: the open items under the title, the metadata in the footer.
  const header = html.slice(html.indexOf('<header>'), html.indexOf('</header>'));
  const footer = html.slice(html.indexOf('<footer>'));
  check(`${lang}: the open items under the title link to every question`, meta.questions.every((q) => header.includes(`<a href="#${q.id}">`)) && html.includes(`<h3 id="${meta.questions[0].id}">`));
  check(`${lang}: by the title only status and date, on one line; the rest in the footer`, (header.match(/<dt>/g) || []).length === 2 && /<dl class="meta meta--inline">/.test(header) && /<dl class="meta">/.test(footer) && footer.includes(`<dt>${lang === 'pl' ? 'Źródła' : 'Sources'}</dt>`));
  check(`${lang}: the tone section shows the sample from PRODUCT.md once`, (html.match(/class="voice-label"/g) || []).length === 1);
  const none = join(tmp, `none-${lang}`);
  cpSync(dir, none, { recursive: true });
  const noneMeta = JSON.parse(readFileSync(join(none, 'profile.meta.json'), 'utf8'));
  noneMeta.questions = [];
  writeFileSync(join(none, 'profile.meta.json'), JSON.stringify(noneMeta, null, 2));
  const noneOut = join(tmp, `none-${lang}.html`);
  runBrandSheet(none, noneOut);
  const noneHtml = readFileSync(noneOut, 'utf8');
  check(`${lang}: with no questions the sheet says so under the title`, noneHtml.includes(lang === 'pl' ? 'Nie mamy pytań.' : 'We have no questions.') && !/sekcji „Pytania”\.|in “Questions\.”/.test(noneHtml.slice(0, noneHtml.indexOf('</header>'))));
}

console.log('Polish speaks to the owner directly');
{
  const dir = join(tmp, 'direct-pl');
  cpSync(join(FIXTURES, 'pl'), dir, { recursive: true });
  const metaPath = join(dir, 'profile.meta.json');
  const meta = JSON.parse(readFileSync(metaPath, 'utf8'));
  meta.questions[0].text = 'Której formy nazwy używają Państwo w dokumentach?';
  writeFileSync(metaPath, JSON.stringify(meta, null, 2));
  const outPath = join(tmp, 'direct-pl.html');
  const res = runBrandSheet(dir, outPath);
  const html = readFileSync(outPath, 'utf8');
  const fixed = html.replaceAll('Której formy nazwy używają Państwo w dokumentach?', '');
  check('the sheet\'s own Polish labels never say "Państwo"', !/Państw/.test(fixed) && html.includes('Tak odczytaliśmy Twoją markę.'));
  check('a "Państwo" in the agent\'s questions or notes is warned about', /questions\[0\]\.text addresses the owner as "Państwo"/.test(res.stderr || ''));
}

console.log('hex codes in notes, the title color, the light logo panel in dark mode');
{
  const dir = join(tmp, 'chips');
  cpSync(join(FIXTURES, 'en'), dir, { recursive: true });
  const metaPath = join(dir, 'profile.meta.json');
  const meta = JSON.parse(readFileSync(metaPath, 'utf8'));
  meta.fields['colors.primary'].note = 'Links and buttons; the yellow #ffce00 of the booking buttons stays out of documents.';
  writeFileSync(metaPath, JSON.stringify(meta, null, 2));
  const outPath = join(tmp, 'chips.html');
  runBrandSheet(dir, outPath);
  const html = readFileSync(outPath, 'utf8');
  check('a hex code in a note carries a chip of its color', html.includes('<span class="hexchip" style="background:#ffce00"></span>#ffce00'));
  check('an HTML entity is not read as a color', !/class="hexchip" style="background:#0?39/.test(html));
  check('the light logo panel carries the light theme\'s paper and ink', /\.logopanel--light \{ --background: [^;]+; --foreground: [^;]+;/.test(html));
  check('the title\'s brand color is the primary when it reads as large text (#3B6FE0 on paper)', /h1 \.accent \{ color: var\(--primary\); \}/.test(html));
}

console.log('a style without style.css: the plain preview card, with a warning');
{
  const dir = join(tmp, 'no-style');
  cpSync(join(FIXTURES, 'en'), dir, { recursive: true });
  const metaPath = join(dir, 'profile.meta.json');
  const meta = JSON.parse(readFileSync(metaPath, 'utf8'));
  meta.style = 'no-such-style';
  writeFileSync(metaPath, JSON.stringify(meta, null, 2));
  const res = runBrandSheet(dir, join(tmp, 'no-style.html'));
  let html = '';
  try { html = readFileSync(join(tmp, 'no-style.html'), 'utf8'); } catch {}
  check('exits 0 and warns', res.status === 0 && /no style\.css for style "no-such-style"/.test(res.stderr || ''));
  check('falls back to the plain card', html.includes('<div class="preview">') && !html.includes('<div class="preview-frame">'));
}

console.log('prose in the wrong language: a warning, not an error');
{
  check('the fixtures raise no language warning', ['pl', 'en'].every((lang) => !/reads? as/.test(runBrandSheet(join(FIXTURES, lang), join(tmp, `lang-${lang}.html`)).stderr || '')));
  const dir = join(tmp, 'wrong-lang');
  cpSync(join(FIXTURES, 'pl'), dir, { recursive: true });
  const metaPath = join(dir, 'profile.meta.json');
  const meta = JSON.parse(readFileSync(metaPath, 'utf8'));
  meta.notes.logo = 'We took the logo from the header and recolored it to the text color.';
  writeFileSync(metaPath, JSON.stringify(meta, null, 2));
  const res = runBrandSheet(dir, join(tmp, 'wrong-lang.html'));
  check('an English note in a Polish sheet still exits 0', res.status === 0);
  check('and names the note in a warning', /lang is "pl" but notes\.logo reads as English/.test(res.stderr || ''));
}

console.log('generated tokens: dark-mode logo copy and embedded fonts');
{
  const dir = join(tmp, 'generated');
  cpSync(join(FIXTURES, 'en'), dir, { recursive: true });
  const logo = join(tmp, 'white.svg');
  writeFileSync(logo, '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 180 40"><path fill="#ffffff" d="M0 0h180v40H0z"/></svg>');
  const tok = spawnSync(process.execPath, [TOKENS_SCRIPT, '--style', CORPORATE, '--primary', '#3b6fe0', '--foreground', '#1c1f26',
    '--font-body', 'Roboto, sans-serif', '--embed-fonts', '--lang', 'en', '--font-file', `Roboto=${FONT_FIXTURE}`,
    '--logo', logo, '--logo-tint', '#1c1f26', '--out', join(dir, 'tokens.css')], { encoding: 'utf8' });
  check('brand-tokens.mjs exits 0', tok.status === 0);
  const outPath = join(tmp, 'generated.html');
  const res = runBrandSheet(dir, outPath);
  check('brand-sheet.mjs exits 0', res.status === 0);
  let html = '';
  try { html = readFileSync(outPath, 'utf8'); } catch {}
  check('one logo copy (the mask)', (html.match(/data:image\/svg\+xml;base64,/g) || []).length === 1);
  check('marks are masks filled with --brand-logo-color', /\.mark-img--mask \{[^}]*mask: var\(--brand-logo-mask\)/.test(html) && /class="mark-img mark--panel mark-img--mask"/.test(html));
  check('the dark-theme panel gets the dark logo color', /\[data-theme="dark"\]\s*\{[\s\S]*?--brand-logo-color:/.test(html) && /data-theme="dark"/.test(html));
  check('marks keep the 180 / 40 proportions from --brand-logo-ratio', (html.match(/<span class="mark-img[^>]*>/g) || []).every((m) => Math.abs(markRatio(m) - 4.5) < 0.02));
  check('embedded @font-face reaches the sheet', /@font-face\s*\{\s*font-family: "Roboto";[^}]*data:font\/woff2;base64,/.test(html));
  check('no http(s):// external resource reference', !hasExternalHttpRef(html));
}

console.log('the ink sentence under Colors follows the tokens');
{
  const DARKER = { pl: 'używamy jego przyciemnionej wersji', en: 'uses its darkened ink variant' };
  const SAME = { pl: 'używa go bez zmian', en: 'uses it unchanged' };
  for (const lang of ['pl', 'en']) {
    const fixtureHtml = readFileSync(join(tmp, `${lang}.html`), 'utf8');
    check(`${lang}: a separate --primary-ink gets the darkened-ink sentence`, fixtureHtml.includes(DARKER[lang]) && !fixtureHtml.includes(SAME[lang]));
    const dir = join(tmp, `same-ink-${lang}`);
    cpSync(join(FIXTURES, lang), dir, { recursive: true });
    const tokensPath = join(dir, 'tokens.css');
    const css = readFileSync(tokensPath, 'utf8');
    const primary = /--primary:\s*([^;]+);/.exec(css)[1];
    writeFileSync(tokensPath, css.replace(/--primary-ink:\s*[^;]+;/, `--primary-ink: ${primary};`));
    const outPath = join(tmp, `same-ink-${lang}.html`);
    const res = runBrandSheet(dir, outPath);
    let html = '';
    try { html = readFileSync(outPath, 'utf8'); } catch {}
    check(`${lang}: --primary-ink equal to --primary says the color is used unchanged`, res.status === 0 && html.includes(SAME[lang]) && !html.includes(DARKER[lang]));
  }
  // End to end: a dark green that reaches 4.5:1 on paper gets no darker ink.
  const dir = join(tmp, 'dark-green');
  cpSync(join(FIXTURES, 'en'), dir, { recursive: true });
  const tok = spawnSync(process.execPath, [TOKENS_SCRIPT, '--style', CORPORATE, '--primary', '#016337', '--foreground', '#1c1f26',
    '--font-body', 'Roboto, sans-serif', '--embed-fonts', '--lang', 'en', '--font-file', `Roboto=${FONT_FIXTURE}`, '--out', join(dir, 'tokens.css')], { encoding: 'utf8' });
  const res = runBrandSheet(dir, join(tmp, 'dark-green.html'));
  let html = '';
  try { html = readFileSync(join(tmp, 'dark-green.html'), 'utf8'); } catch {}
  check('brand-tokens.mjs on #016337, then the sheet says the color is used unchanged', tok.status === 0 && res.status === 0 && html.includes(SAME.en));
}

console.log('apply-tokens.mjs: tokens into a document');
{
  const doc = join(tmp, 'doc.html');
  writeFileSync(doc, '<!doctype html>\n<html lang="en">\n<head>\n<meta charset="utf-8">\n<title>Rollout plan</title>\n<meta property="og:title" content="Rollout plan">\n<meta property="og:description" content="What ships when.">\n<style>\nbody { margin: 0; background: var(--background); color: var(--foreground); font-family: var(--font-sans); }\n.wrap { max-width: 44rem; margin: 0 auto; padding: 0 16px; }\n</style>\n</head>\n<body>\n<main class="wrap">\n<h1 id="rollout-plan">Rollout plan</h1>\n<p>Price: $1 and $& stay as written.</p>\n<h2 id="first-step">First step</h2>\n<p>We ship the importer first.</p>\n</main>\n</body>\n</html>\n');
  const profile = join(tmp, 'generated');
  const first = spawnSync(process.execPath, [APPLY_SCRIPT, profile, doc], { encoding: 'utf8' });
  check('exits 0', first.status === 0);
  const once = readFileSync(doc, 'utf8');
  const tokens = readFileSync(join(profile, 'tokens.css'), 'utf8').replace(/\s+$/, '');
  const block = /<style data-letterhead-tokens data-style="corporate">([\s\S]*?)<\/style>/.exec(once)?.[1] || '';
  const brandPart = block.slice(block.indexOf('brand profile "generated" over the "corporate" style'));
  const primary = /--primary:\s*([^;]+);/.exec(tokens)?.[1];
  check('the profile goes in over its base style, its colors last', block.length > 0 && brandPart.length < block.length && !!primary && brandPart.includes(`--primary: ${primary};`));
  check('before the document\'s own style', once.indexOf('data-letterhead-tokens') < once.indexOf('<style>\nbody'));
  check('a favicon in the primary color was added', /<link rel="icon" href="data:image\/svg\+xml,[^"]*%233b6fe0/i.test(once));
  check('"$" in the document survives', once.includes('$1 and $& stay'));
  const second = spawnSync(process.execPath, [APPLY_SCRIPT, join(profile, 'tokens.css'), doc], { encoding: 'utf8' });
  check('second run exits 0 and changes nothing', second.status === 0 && readFileSync(doc, 'utf8') === once && /replaced/.test(second.stdout));
  const checkRes = spawnSync(process.execPath, [CHECK_SCRIPT, doc], { encoding: 'utf8' });
  check('check-document.mjs passes on the result', checkRes.status === 0);
  if (checkRes.status !== 0) console.log(checkRes.stdout);
  const noHead = join(tmp, 'fragment.html');
  writeFileSync(noHead, '<p>just a fragment</p>');
  check('a file without <head> or <html> is refused', spawnSync(process.execPath, [APPLY_SCRIPT, profile, noHead], { encoding: 'utf8' }).status === 1);
}

if (failures > 0) {
  console.log(`\n${failures} assertion(s) failed.`);
  process.exit(1);
}
console.log('\nall assertions passed.');
process.exit(0);
