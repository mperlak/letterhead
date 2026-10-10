#!/usr/bin/env node
// Brand sheet generator.
//
// Takes a taught brand profile directory (DESIGN.md + PRODUCT.md +
// tokens.css + profile.meta.json, per reference/create.md) and renders it as a single self-contained review
// document: logo, colors, typography, tone, composition and open questions,
// closing with a preview of what a first real document will look like: a
// short document about the profile itself, laid out by the base style's own
// style.css, so the owner sees the composition, not a description of it.
// The generated file is meant to go straight into a review loop, so it is
// built to the same review-ready contract as any other letterhead output
// (stable heading ids, no external resources, labeled metadata) and this
// script runs check-document.mjs on it before returning.
//
// Usage:
//   node brand-sheet.mjs <profile-dir> [--out <path>] [--check-script <path>]
//
// Defaults:
//   --out           <profile-dir>/brand-sheet.html
//   --check-script  check-document.mjs next to this script
//
// Exit codes:
//   0 — generated and check-document found no errors
//   1 — unreadable/malformed input (missing file, missing required key)
//   2 — generated, but check-document found errors

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const __dirname = dirname(fileURLToPath(import.meta.url));

class FatalError extends Error {}

// ============================================================
// CLI
// ============================================================

function parseArgs(argv) {
  const out = { profileDir: null, outPath: null, checkScript: null };
  const rest = [];
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--out') out.outPath = argv[++i];
    else if (a === '--check-script') out.checkScript = argv[++i];
    else rest.push(a);
  }
  out.profileDir = rest[0] || null;
  return out;
}

// ============================================================
// Small utilities
// ============================================================

function escapeHtml(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));
}

function dataUriSvg(svgMarkup) {
  return 'data:image/svg+xml,' + encodeURIComponent(svgMarkup);
}

// Provenance text (fields[*].note, notes.*, questions[].text/why) is
// authored during teach against the RAW evidence — it can carry a
// technical token verbatim (a meta property name, a CSS at-rule, an HTML
// attribute, a bare CSS custom-property name) that means nothing to the
// person who owns the brand. sanitizeProvenance() rewrites the known
// ones into plain language before the string ever reaches the page. Hex
// color values are left alone — those ARE meaningful to the reader.
const PROVENANCE_REPLACEMENTS = {
  pl: [
    [/og:site_name/gi, 'metadane strony'],
    [/@font-face/gi, 'ładowany krój'],
    [/\bbody\s+rule\b/gi, 'reguła tekstu strony'],
    [/\breg[uó][łl][aeęy]?\s+body\b/gi, 'reguła tekstu strony'],
    [/\balt\b/gi, 'opis logo'],
  ],
  en: [
    [/og:site_name/gi, 'page metadata'],
    [/@font-face/gi, 'loaded typeface'],
    [/\bbody\s+rule\b/gi, "the page's text rule"],
    [/\balt\b/gi, 'logo description'],
  ],
};

function sanitizeProvenance(text, lang) {
  if (!text) return text;
  let out = String(text);
  for (const [re, replacement] of PROVENANCE_REPLACEMENTS[lang] || PROVENANCE_REPLACEMENTS.en) {
    out = out.replace(re, replacement);
  }
  // A bare CSS custom-property name (--foo-bar) is dropped outright — there
  // is no plain-language substitute that reads naturally mid-sentence, and
  // naming the token itself doesn't help the reader either.
  out = out.replace(/--[\w-]+/g, '');
  // Collapse whitespace left behind by the drop above, and tidy stray
  // spaces before punctuation.
  out = out.replace(/\s+([,.;:])/g, '$1').replace(/\s{2,}/g, ' ').trim();
  return out;
}

function normalizeColorValue(v) {
  if (typeof v !== 'string') return v;
  const trimmed = v.trim();
  if (/^#[0-9a-f]{3,8}$/i.test(trimmed)) return trimmed.toUpperCase();
  // The sheet is read by the brand owner, who knows hex, not OKLCH; tokens
  // keep OKLCH, the swatch label shows the same color as hex.
  return oklchToHex(trimmed) || trimmed;
}

// oklch(L C h) → #RRGGBB, gamut-clipped. L as 0–1 or percent; alpha ignored.
function oklchToHex(value) {
  const m = /^oklch\(\s*([\d.]+)(%?)\s+([\d.]+)\s+([\d.]+)(?:deg)?\s*(?:\/[^)]*)?\)$/i.exec(value);
  if (!m) return null;
  const L = m[2] ? Number(m[1]) / 100 : Number(m[1]);
  const C = Number(m[3]);
  const h = (Number(m[4]) * Math.PI) / 180;
  const a = C * Math.cos(h);
  const b = C * Math.sin(h);
  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const mm = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3;
  const linear = [
    4.0767416621 * l - 3.3077115913 * mm + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * mm - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * mm + 1.707614701 * s,
  ];
  const hex = linear.map((x) => {
    const c = Math.min(1, Math.max(0, x));
    const srgb = c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055;
    return Math.round(srgb * 255).toString(16).padStart(2, '0');
  });
  return `#${hex.join('')}`.toUpperCase();
}

function readRequiredFile(path, label) {
  if (!existsSync(path)) {
    throw new FatalError(`missing required file: ${label} (${path})`);
  }
  try {
    return readFileSync(path, 'utf8');
  } catch (e) {
    throw new FatalError(`unreadable file: ${label} (${path}) — ${e.message}`);
  }
}

// ============================================================
// Minimal YAML-ish frontmatter parser (DESIGN.md only needs scalars and
// 1-3 levels of nested maps — no lists appear in the taught profile
// frontmatter, so a full YAML implementation would be dead weight here).
// ============================================================

function parseFrontmatter(markdown) {
  const m = /^---\r?\n([\s\S]*?)\r?\n---/.exec(markdown);
  if (!m) return {};
  const lines = m[1].split(/\r?\n/);
  const root = {};
  const stack = [{ indent: -1, obj: root }];
  for (const raw of lines) {
    if (!raw.trim() || raw.trim().startsWith('#')) continue;
    const indent = /^(\s*)/.exec(raw)[1].length;
    const line = raw.trim();
    const colonIdx = line.indexOf(':');
    if (colonIdx === -1) continue;
    const key = line.slice(0, colonIdx).trim();
    let value = line.slice(colonIdx + 1).trim();
    while (stack.length > 1 && indent <= stack[stack.length - 1].indent) stack.pop();
    const parent = stack[stack.length - 1].obj;
    if (value === '') {
      const child = {};
      parent[key] = child;
      stack.push({ indent, obj: child });
      continue;
    }
    const quoted = /^"([^"]*)"$/.exec(value) || /^'([^']*)'$/.exec(value);
    let v;
    if (quoted) {
      v = quoted[1];
    } else {
      const hashIdx = value.indexOf(' #');
      v = hashIdx !== -1 ? value.slice(0, hashIdx).trim() : value;
    }
    parent[key] = /^-?\d+(\.\d+)?$/.test(v) ? Number(v) : v;
  }
  return root;
}

function getPath(obj, path) {
  return path.split('.').reduce((acc, k) => (acc && typeof acc === 'object' ? acc[k] : undefined), obj);
}

// ============================================================
// PRODUCT.md prose extraction
// ============================================================

function splitMdSections(markdown) {
  const lines = markdown.split(/\r?\n/);
  const sections = [];
  let current = { heading: null, lines: [] };
  for (const line of lines) {
    const m = /^##\s+(.*)$/.exec(line);
    if (m) {
      sections.push(current);
      current = { heading: m[1].trim(), lines: [] };
    } else {
      current.lines.push(line);
    }
  }
  sections.push(current);
  return sections.map((s) => ({ heading: s.heading, body: s.lines.join('\n').trim() }));
}

function findSection(sections, re) {
  return sections.find((s) => s.heading && re.test(s.heading));
}

function firstParagraph(body) {
  if (!body) return null;
  const block = body.split(/\n\s*\n/)[0].trim();
  return block || null;
}

// "Three words we will not use" — accepted PRODUCT.md line prefixes (case-
// insensitive, optional leading "-"/"*" bullet marker, ":" or "-" after):
// "Unikamy:", "Nie używamy:", "Anti-references:", "Avoid:" (and the Polish
// synonym "Anty-referencje:"). Deliberately NOT a fallback onto "the last
// bullet list in the document" — that heuristic previously grabbed
// whichever bullet block happened to come last (e.g. a Vocabulary section
// listing words the brand DOES use), which is the opposite of this field.
// Absent one of the recognized prefixes, buildModel() falls through to
// meta.notes.avoid or omits the section — see the call site.
function extractAntiReferenceWords(productMd) {
  const lineRe = /^[-*]?\s*(Anti-references|Anty-referencje|Avoid|Nie u[żz]ywamy|Unikamy)\s*[:\-]\s*(.+)$/im;
  const m = lineRe.exec(productMd);
  if (!m) return [];
  return m[2].split(',').map((s) => s.replace(/[.\s]+$/, '').trim()).filter(Boolean);
}

// ============================================================
// tokens.css extraction
// ============================================================

function extractCssVar(tokensCss, name) {
  const re = new RegExp(`${name}\\s*:\\s*([^;]+);`, 'i');
  const m = re.exec(tokensCss);
  return m ? m[1].trim() : null;
}

// Whether the light theme's text ink is a darker copy of the primary, or
// the primary itself. brand-tokens.mjs writes --primary-ink equal to
// --primary when the brand color already reaches 4.5:1 on the paper (a
// dark green, a navy); then the sheet must not tell the owner their color
// is swapped for a darker one in text. No --primary-ink at all (a hand-made
// file) counts as a separate ink: documents then set that text in the
// foreground, not in the brand color.
function primaryInkIsPrimary(tokensCss) {
  const primary = extractCssVar(tokensCss, '--primary');
  const ink = extractCssVar(tokensCss, '--primary-ink');
  if (!primary || !ink) return false;
  const oklch = (v) => {
    const m = /^oklch\(\s*([\d.]+)(%?)\s+([\d.]+)\s+([\d.]+)/i.exec(v);
    return m ? { l: Number(m[1]) / (m[2] ? 100 : 1), c: Number(m[3]), h: Number(m[4]) } : null;
  };
  const a = oklch(primary);
  const b = oklch(ink);
  if (!a || !b) return primary.replace(/\s+/g, '').toLowerCase() === ink.replace(/\s+/g, '').toLowerCase();
  const dh = Math.abs(((a.h - b.h + 540) % 360) - 180);
  return Math.abs(a.l - b.l) < 0.005 && Math.abs(a.c - b.c) < 0.005 && (dh < 1 || Math.max(a.c, b.c) < 0.01);
}

// Intrinsic width/height of the logo artwork, so the sheet draws it at its
// own proportions instead of a fixed box (a 3.6:1 wordmark squeezed into
// 3:1 reads as a different logo). PNG IHDR, SVG viewBox/width/height, JPEG
// SOF. Null when the payload cannot be read.
function logoDimensions(dataUri) {
  if (!dataUri) return null;
  const m = /^data:([^;,]+)(;base64)?,(.*)$/s.exec(dataUri);
  if (!m) return null;
  let buf;
  try {
    buf = m[2] ? Buffer.from(m[3], 'base64') : Buffer.from(decodeURIComponent(m[3]), 'utf8');
  } catch {
    return null;
  }
  const mime = m[1].toLowerCase();
  if (mime === 'image/png' && buf.length >= 24) {
    return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) };
  }
  if (mime === 'image/svg+xml') {
    const head = buf.toString('utf8', 0, Math.min(buf.length, 4096));
    const svg = /<svg\b[^>]*>/i.exec(head)?.[0] || '';
    const vb = /viewBox\s*=\s*["']\s*[-\d.]+[\s,]+[-\d.]+[\s,]+([\d.]+)[\s,]+([\d.]+)/i.exec(svg);
    if (vb && Number(vb[1]) > 0 && Number(vb[2]) > 0) return { width: Number(vb[1]), height: Number(vb[2]) };
    const w = /\bwidth\s*=\s*["']([\d.]+)(?:px)?["']/i.exec(svg);
    const h = /\bheight\s*=\s*["']([\d.]+)(?:px)?["']/i.exec(svg);
    if (w && h && Number(w[1]) > 0 && Number(h[1]) > 0) return { width: Number(w[1]), height: Number(h[1]) };
    return null;
  }
  if (mime === 'image/jpeg') {
    let o = 2;
    while (o + 9 < buf.length) {
      if (buf[o] !== 0xff) return null;
      const marker = buf[o + 1];
      const len = buf.readUInt16BE(o + 2);
      if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) {
        return { width: buf.readUInt16BE(o + 7), height: buf.readUInt16BE(o + 5) };
      }
      o += 2 + len;
    }
  }
  return null;
}

function extractLogoDataUri(tokensCss) {
  // data: payloads from encodeURIComponent leave "'", "(", ")" unescaped, so
  // only "\"" is a safe terminator — prefer the double-quoted url() form and
  // fall back to a looser match for hand-written unquoted tokens.css files.
  // Single-color artwork lives in --brand-logo-mask, and --brand-logo only
  // points at it.
  for (const name of ['brand-logo', 'brand-logo-mask']) {
    const quoted = new RegExp(`--${name}\\s*:\\s*url\\(\\s*"(data:[^"]+)"\\s*\\)`, 'i').exec(tokensCss);
    if (quoted) return quoted[1];
    const unquoted = new RegExp(`--${name}\\s*:\\s*url\\(\\s*(data:[^)]+)\\)`, 'i').exec(tokensCss);
    if (unquoted) return unquoted[1];
  }
  return null;
}

// ============================================================
// preview document CSS
// ============================================================

// The preview is a real document slice, laid out by the base style's own
// style.css (scoped `:where(.doc)`), so the owner sees the style's
// composition and signature moves instead of a sentence naming the style.
// The style's page-level rules (box-sizing, html, body) are the sheet's
// business and are dropped. The page has one <h1>, the sheet's title, so the
// preview's title is a paragraph that takes the style's h1 rules.
function previewStyleCss(style, warn) {
  if (!/^[a-z0-9-]+$/.test(style || '')) return null;
  const path = join(__dirname, '..', 'styles', style, 'style.css');
  if (!existsSync(path)) {
    warn(`no style.css for style "${style}" — the preview falls back to a plain card`);
    return null;
  }
  return readFileSync(path, 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^(?:\*, \*::before, \*::after|html|body)\s*\{[^}]*\}\s*$/gm, '')
    .replace(/([^{}]+)\{/g, (m, sel) => (sel.trim().startsWith('@') ? m : `${sel.replace(/(^|[^\w-])h1(?![\w-])/g, '$1:is(h1, .pv-title)')}{`))
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

const HEX_RE = /^#[0-9a-f]{3}(?:[0-9a-f]{3})?$/i;
// Appended to the sheet's element selectors so they skip the preview
// document; :where() keeps their specificity unchanged.
const NOT_DOC = ':where(:not(.doc *))';

// ASCII slug for the preview's own h2 ids (Polish letters folded).
function slugify(text) {
  return String(text).toLowerCase().replace(/ł/g, 'l').normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

// ============================================================
// i18n
// ============================================================

const STRINGS = {
  pl: {
    titlePrefix: 'Arkusz marki',
    ogDescription: (name) => `Marka ${name}: arkusz do komentarzy przed pierwszym dokumentem.`,
    lede: 'Tak odczytaliśmy Państwa markę. Jeśli coś odczytaliśmy źle, prosimy o komentarz w tym miejscu. Otwarte kwestie są w sekcji „Pytania”.',
    metaClient: 'Marka',
    metaSources: 'Źródła',
    metaDate: 'Data',
    metaStatus: 'Status',
    metaStatusValue: 'do komentarzy',
    metaAnswers: 'Odpowiada',
    metaAnswersValue: 'ktokolwiek jest właścicielem marki, komentarzem w odpowiednim miejscu',
    sections: {
      'logo-and-name': 'Logo i nazwa',
      colors: 'Kolory',
      typography: 'Typografia',
      tone: 'Ton',
      composition: 'Kompozycja',
      questions: 'Pytania',
      preview: 'Podgląd dokumentu',
    },
    panelHeaderCaption: (onDark) => `Na ${onDark ? 'ciemnym' : 'jasnym'} tle — tak wygląda nagłówek dokumentu.`,
    panelOppositeCaption: 'Ten sam znak na przeciwnym tle.',
    panelDarkModeCaption: 'Ten sam znak, gdy czytelnik ma włączony tryb ciemny.',
    noLogoSentence: 'Nie mamy pliku logo — dokumenty otwiera nazwa złożona w kroju wyróżniającym.',
    nameInDocs: (name) => `Nazwa używana w dokumentach: <strong>${escapeHtml(name)}</strong>.`,
    colorPrimary: 'Kolor główny',
    colorForeground: 'Kolor tekstu',
    colorBackground: 'Tło dokumentu',
    colorSecondary: 'Kolor uzupełniający',
    backgroundNote: 'Nasz wybór: papier.',
    backgroundFromSite: 'Ze strony.',
    fromStyle: 'Ze stylu.',
    confirmPill: 'do sprawdzenia',
    colorClosing: 'Kolor główny służy do wypełnień i linii; do tekstu w tym kolorze używamy jego przyciemnionej wersji.',
    colorClosingSameInk: 'Kolor główny jest czytelny na jasnej kartce, więc tekst w kolorze marki używa go bez zmian, tak jak wypełnienia i linie.',
    bodyFace: 'Krój tekstu',
    headingFace: 'Krój nagłówków',
    headingWeight: 'Waga nagłówków',
    fontLoading: 'Skąd',
    fontLoadingBody: 'Skąd krój tekstu',
    fontLoadingHeading: 'Skąd krój nagłówków',
    noWeightNote: null,
    nowordsLabel: 'Trzy słowa, których nie użyjemy',
    nowordsEmpty: 'Nie mamy jeszcze listy słów do wykluczenia.',
    compositionFallback: 'Układ dokumentów (odstępy, ramki, listy, podział na sekcje) pokazujemy w podglądzie na końcu arkusza. Jeśli Państwa dokumenty wyglądają inaczej, prosimy o przykład albo komentarz.',
    density: {
      compact: 'Gęstość: ciasna — mało powietrza wokół elementów, dużo treści na ekranie.',
      regular: 'Gęstość: zwykła — powietrze i treść są w równowadze.',
      airy: 'Gęstość: przewiewna — dużo powietrza wokół elementów.',
    },
    imagery: {
      none: 'Zdjęcia: brak — marka nie korzysta z fotografii.',
      spot: 'Zdjęcia: punktowe — pojedyncze, celowo wybrane obrazy.',
      'full-bleed': 'Zdjęcia: na całą szerokość — obrazy sięgają od krawędzi do krawędzi.',
    },
    rhythm: {
      continuous: 'Rytm: ciągły — sekcje płynnie przechodzą jedna w drugą.',
      sectioned: 'Rytm: dzielony — każda sekcja zaczyna się widoczną przerwą.',
    },
    questionsClosing: 'Jeśli coś tutaj nie jest Państwa, prosimy o komentarz w tym miejscu.',
    previewIntro: 'Tak zacznie się pierwszy dokument złożony w Państwa barwach.',
    previewIntroSample: 'Tak będą wyglądać Państwa dokumenty. Ten przykład opisuje pracę nad Państwa marką, więc nic w nim nie jest zmyślone.',
    pv: {
      kicker: 'Profil marki',
      title: (name) => `${name}: profil marki do sprawdzenia`,
      lede: (src) => `${src ? `Odczytaliśmy markę z: ${src}. ` : ''}Zanim powstanie pierwszy dokument, prosimy o sprawdzenie kolorów, krojów pisma i logo.`,
      status: 'do sprawdzenia',
      summary: ({ heading, body, colors }) => [
        heading && body && `Nagłówki: ${heading}, tekst: ${body}.`,
        colors && 'Kolory marki z ich wartościami są w tabeli poniżej.',
      ].filter(Boolean).join(' '),
      readHeading: 'Co odczytaliśmy',
      rows: { name: 'Nazwa', logo: 'Logo', primary: 'Kolor główny', secondary: 'Kolor uzupełniający', foreground: 'Kolor tekstu', background: 'Tło dokumentu', body: 'Krój tekstu', heading: 'Krój nagłówków', tone: 'Ton' },
      states: { confirmed: 'potwierdzone', inferred: 'odczytane', guessed: 'do sprawdzenia', missing: 'brak' },
      colorHead: ['Rola', 'Wartość'],
      calloutLabel: 'Do Państwa decyzji',
      calloutQuestions: (n) => (n === 1 ? 'Jedno pytanie czeka na odpowiedź w sekcji „Pytania”.'
        : `${n} ${n % 10 >= 2 && n % 10 <= 4 && (n % 100 < 10 || n % 100 >= 20) ? 'pytania czekają' : 'pytań czeka'} na odpowiedź w sekcji „Pytania”.`),
      calloutNone: 'Jeśli coś w tym arkuszu nie jest Państwa, prosimy o komentarz w tym miejscu.',
      nextHeading: 'Co dalej',
      steps: [['Teraz', 'Państwo komentują arkusz marki.'], ['Potem', 'Poprawiamy profil według komentarzy.'], ['Na koniec', 'Powstaje pierwszy dokument w Państwa barwach.']],
    },
    previewStatus: 'szkic do komentarzy',
    previewNextStep: 'Następny krok',
    previewTldrLabel: 'W skrócie',
    previewTitleFallback: 'Dokument',
    previewNextStepFallback: 'komentarze do tego arkusza',
    previewTldrFallback: 'Treść tego dokumentu powstanie po komentarzach do arkusza marki.',
    sampleTitle: (name) => `${name}: przykładowy dokument`,
    sampleTag: 'przykład',
    sampleTldr: 'Prawdziwy dokument otworzy się tak samo: logo, tytuł, opisane metadane i krótkie streszczenie.',
    footerStatus: (name, date) => `${name}, arkusz marki, ${date}. Status: do komentarzy.`,
  },
  en: {
    titlePrefix: 'Brand sheet',
    ogDescription: (name) => `Brand ${name}: open for comments before the first document.`,
    lede: 'This is how we read your brand. If we read anything wrong, please comment right on that place. The open items are in “Questions.”',
    metaClient: 'Brand',
    metaSources: 'Sources',
    metaDate: 'Date',
    metaStatus: 'Status',
    metaStatusValue: 'open for comments',
    metaAnswers: 'Who answers',
    metaAnswersValue: 'whoever owns the brand, by commenting on the relevant place',
    sections: {
      'logo-and-name': 'Logo and name',
      colors: 'Colors',
      typography: 'Typography',
      tone: 'Tone',
      composition: 'Composition',
      questions: 'Questions',
      preview: 'Preview',
    },
    panelHeaderCaption: (onDark) => `On a ${onDark ? 'dark' : 'light'} background — how the document header shows it.`,
    panelOppositeCaption: 'The same mark on the opposite background.',
    panelDarkModeCaption: 'The same mark for a reader in dark mode.',
    noLogoSentence: 'No logo file was captured — documents open with the name set in the display face instead.',
    nameInDocs: (name) => `The name used in documents: <strong>${escapeHtml(name)}</strong>.`,
    colorPrimary: 'Primary color',
    colorForeground: 'Text color',
    colorBackground: 'Document background',
    colorSecondary: 'Secondary color',
    backgroundNote: 'Our choice: paper.',
    backgroundFromSite: 'From the site.',
    fromStyle: 'From the style.',
    confirmPill: 'please check',
    colorClosing: 'The primary color is used for fills and rules; text set in that color uses its darkened ink variant instead.',
    colorClosingSameInk: 'The primary color reads on the light page as it is, so text in the brand color uses it unchanged, like fills and rules.',
    bodyFace: 'Body face',
    headingFace: 'Heading face',
    headingWeight: 'Heading weight',
    fontLoading: 'Where from',
    fontLoadingBody: 'Where the body face comes from',
    fontLoadingHeading: 'Where the heading face comes from',
    noWeightNote: null,
    nowordsLabel: 'Three words we will not use',
    nowordsEmpty: 'No words are excluded yet.',
    compositionFallback: 'The layout of your documents (spacing, boxes, lists, how sections break) is shown in the preview at the end of this sheet. If your documents look different, please send an example or a comment.',
    density: {
      compact: 'Density: compact — little air around elements, more content per screen.',
      regular: 'Density: regular — air and content are balanced.',
      airy: 'Density: airy — generous space around elements.',
    },
    imagery: {
      none: 'Imagery: none — the brand does not use photography.',
      spot: 'Imagery: spot — single, deliberately chosen images.',
      'full-bleed': 'Imagery: full-bleed — images run edge to edge.',
    },
    rhythm: {
      continuous: 'Rhythm: continuous — sections flow into one another.',
      sectioned: 'Rhythm: sectioned — each section opens with a visible break.',
    },
    questionsClosing: 'If anything here is not yours, say so in a comment on that place.',
    previewIntro: 'This is how the first document set in your colors will open.',
    previewIntroSample: 'This is how your documents will look. The example describes the work on your brand, so nothing in it is made up.',
    pv: {
      kicker: 'Brand profile',
      title: (name) => `${name}: brand profile for review`,
      lede: (src) => `${src ? `We read your brand from ${src}. ` : ''}Before the first document, please check the colors, typefaces and logo.`,
      status: 'for review',
      summary: ({ heading, body, colors }) => [
        heading && body && `Headings in ${heading}, text in ${body}.`,
        colors && 'The brand colors and their values are in the table below.',
      ].filter(Boolean).join(' '),
      readHeading: 'What we read',
      rows: { name: 'Name', logo: 'Logo', primary: 'Primary color', secondary: 'Secondary color', foreground: 'Text color', background: 'Document background', body: 'Body typeface', heading: 'Heading typeface', tone: 'Tone' },
      states: { confirmed: 'confirmed', inferred: 'read from source', guessed: 'please check', missing: 'missing' },
      colorHead: ['Role', 'Value'],
      calloutLabel: 'For your decision',
      calloutQuestions: (n) => `${n === 1 ? 'One question waits' : `${n} questions wait`} for your answer in “Questions.”`,
      calloutNone: 'If anything on this sheet is not yours, please comment right on it.',
      nextHeading: 'Next steps',
      steps: [['Now', 'You comment on the brand sheet.'], ['Then', 'We correct the profile from your comments.'], ['Finally', 'The first document is set in your colors.']],
    },
    previewStatus: 'draft for comments',
    previewNextStep: 'Next step',
    previewTldrLabel: 'In short',
    previewTitleFallback: 'Document',
    previewNextStepFallback: 'comments on this sheet',
    previewTldrFallback: "This document's content will be written after the comments on the brand sheet.",
    sampleTitle: (name) => `${name}: sample document`,
    sampleTag: 'sample',
    sampleTldr: 'A real document opens the same way: the logo, a title, labeled details and a short summary.',
    footerStatus: (name, date) => `${name}, brand sheet, ${date}. Status: open for comments.`,
  },
};

const PL_MONTHS_GENITIVE = ['stycznia', 'lutego', 'marca', 'kwietnia', 'maja', 'czerwca', 'lipca', 'sierpnia', 'września', 'października', 'listopada', 'grudnia'];
const EN_MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

function formatDateLocal(date, lang) {
  const d = date.getDate();
  const mo = date.getMonth();
  const y = date.getFullYear();
  return lang === 'pl' ? `${d} ${PL_MONTHS_GENITIVE[mo]} ${y}` : `${EN_MONTHS[mo]} ${d}, ${y}`;
}

// Prose in the wrong language: an English note in a Polish sheet reads as a
// slip to the brand owner. A cheap per-sentence test, warnings only: a
// Polish sentence has diacritics or Polish function words; an English one
// has neither and at least two English function words. Words both
// languages share ("a", "to", "on", "i", "do") count for neither.
const EN_FUNCTION_WORDS = new Set(['the', 'and', 'of', 'is', 'are', 'was', 'were', 'we', 'our', 'you', 'your', 'from', 'with', 'for', 'this', 'that', 'which', 'it', 'its', 'by', 'be', 'has', 'have', 'in', 'at', 'not', 'uses', 'used']);
const PL_FUNCTION_WORDS = new Set(['się', 'jest', 'są', 'że', 'oraz', 'dla', 'przez', 'jako', 'który', 'która', 'które', 'nie', 'na', 'od', 'ze', 'czy', 'jak', 'też', 'tylko', 'lub', 'albo', 'bez']);
const PL_DIACRITIC_RE = /[ąćęłńóśźżĄĆĘŁŃÓŚŹŻ]/g;

function sentenceLooksLike(sentence) {
  const words = sentence.toLowerCase().match(/[\p{L}]+/gu) || [];
  if (words.length < 4) return null;
  const diacritics = (sentence.match(PL_DIACRITIC_RE) || []).length;
  const pl = words.filter((w) => PL_FUNCTION_WORDS.has(w)).length;
  const en = words.filter((w) => EN_FUNCTION_WORDS.has(w)).length;
  if (diacritics >= 2 || pl >= 2) return 'pl';
  if (diacritics === 0 && pl === 0 && en >= 2) return 'en';
  return null;
}

function proseLanguageWarnings(meta, lang, warn) {
  const other = lang === 'pl' ? 'en' : 'pl';
  const texts = [];
  for (const [k, v] of Object.entries(meta.notes || {})) if (typeof v === 'string') texts.push([`notes.${k}`, v]);
  (Array.isArray(meta.questions) ? meta.questions : []).forEach((q, i) => {
    if (q?.text) texts.push([`questions[${i}].text`, q.text]);
    if (q?.why) texts.push([`questions[${i}].why`, q.why]);
  });
  for (const [k, f] of Object.entries(meta.fields || {})) if (typeof f?.note === 'string') texts.push([`fields["${k}"].note`, f.note]);
  const off = texts.filter(([, text]) => text.split(/(?<=[.!?])\s+/).some((sentence) => sentenceLooksLike(sentence) === other));
  if (off.length) {
    const langName = lang === 'pl' ? 'Polish' : 'English';
    warn(`lang is "${lang}" but ${off.map(([k]) => k).join(', ')} ${off.length === 1 ? 'reads' : 'read'} as ${lang === 'pl' ? 'English' : 'Polish'} — write the sheet's prose in ${langName}`);
  }
}

function detectLang(...texts) {
  const joined = texts.filter(Boolean).join(' ');
  const polishHits = (joined.match(/[ąćęłńóśźżĄĆĘŁŃÓŚŹŻ]/g) || []).length;
  return polishHits >= 8 ? 'pl' : 'en';
}

// ============================================================
// Profile loading + field extraction
// ============================================================

function loadProfile(dir) {
  const designMd = readRequiredFile(join(dir, 'DESIGN.md'), 'DESIGN.md');
  const productMd = readRequiredFile(join(dir, 'PRODUCT.md'), 'PRODUCT.md');
  const tokensCss = readRequiredFile(join(dir, 'tokens.css'), 'tokens.css');
  const metaRaw = readRequiredFile(join(dir, 'profile.meta.json'), 'profile.meta.json');
  let meta;
  try {
    meta = JSON.parse(metaRaw);
  } catch (e) {
    throw new FatalError(`malformed profile.meta.json — ${e.message}`);
  }
  const frontmatter = parseFrontmatter(designMd);
  return { designMd, productMd, tokensCss, meta, frontmatter };
}

function field(meta, key) {
  return meta.fields && meta.fields[key] ? meta.fields[key] : null;
}

function fieldValue(meta, key) {
  const f = field(meta, key);
  return f && f.value != null ? f.value : null;
}

function buildModel(profile, warn) {
  const { designMd, productMd, tokensCss, meta, frontmatter } = profile;

  // meta.client (older schema) names the profile's slug, not a display
  // name — prefer the proper name field/frontmatter over it, and only fall
  // back to the raw client/slug string as a last resort.
  const name = meta.name || fieldValue(meta, 'name') || frontmatter.name || meta.brand || meta.client;
  if (!name) throw new FatalError('missing key: name (not found in profile.meta.json or DESIGN.md frontmatter)');
  if (!meta.name && !fieldValue(meta, 'name') && !frontmatter.name && (meta.brand || meta.client)) {
    warn(`name missing — used the profile slug ("${meta.brand || meta.client}") verbatim as a last resort`);
  }

  const slug = meta.slug || meta.brand || meta.client || String(name).toLowerCase().replace(/[^a-z0-9]+/g, '-');
  const style = meta.style || 'brand';

  let lang = meta.lang === 'pl' || meta.lang === 'en' ? meta.lang : null;
  if (!lang) {
    lang = detectLang(designMd, productMd);
    warn(`lang missing in profile.meta.json — detected "${lang}" from DESIGN.md/PRODUCT.md text`);
  }
  proseLanguageWarnings(meta, lang, warn);

  const sources = Array.isArray(meta.sources) ? meta.sources : [];

  // Colors -----------------------------------------------------------
  const primary = field(meta, 'colors.primary');
  const foreground = field(meta, 'colors.foreground');
  const secondary = field(meta, 'colors.secondary');
  const backgroundTokenValue = extractCssVar(tokensCss, '--background');
  const foregroundTokenValue = extractCssVar(tokensCss, '--foreground');
  // DESIGN.md carries colors.background only when the brand's own page set
  // it; otherwise the paper is the style's.
  const backgroundFromBrand = getPath(frontmatter, 'colors.background') != null;
  if (!primary) warn('fields["colors.primary"] missing — swatch will be incomplete');
  if (!foreground?.value) warn('fields["colors.foreground"] has no value — the swatch shows the style\'s text color');

  // Typography ---------------------------------------------------------
  const bodyFace = field(meta, 'typography.body');
  const headingFace = field(meta, 'typography.heading');
  let headingWeight = fieldValue(meta, 'typography.headingWeight');
  if (headingWeight == null) {
    headingWeight = getPath(frontmatter, 'typography.heading.fontWeight') ?? null;
    if (headingWeight != null) {
      warn('fields["typography.headingWeight"] missing — used DESIGN.md frontmatter typography.heading.fontWeight instead');
    } else {
      warn('typography.headingWeight not found in profile.meta.json fields or DESIGN.md frontmatter — omitted from the sample facts');
    }
  }

  // Logo ---------------------------------------------------------------
  const logoNote = field(meta, 'logo');
  const logoDataUri = extractLogoDataUri(tokensCss);
  const logoOn = extractCssVar(tokensCss, '--brand-logo-on');
  const logoMask = /--brand-logo-mask\s*:\s*url\(/.test(tokensCss);
  const ratioToken = Number(extractCssVar(tokensCss, '--brand-logo-ratio'));
  const logoDims = ratioToken > 0 ? { width: ratioToken, height: 1 } : logoDimensions(logoDataUri);
  const logoPlate = /--brand-logo-plate\s*:/.test(tokensCss);
  const inkIsPrimary = primaryInkIsPrimary(tokensCss);
  const previewCss = previewStyleCss(style, warn);
  // Confidence per field, for the preview's status ledger.
  const confidenceOf = (key) => {
    const f = field(meta, key);
    if (!f || f.value == null) return 'missing';
    return ['confirmed', 'inferred', 'guessed'].includes(f.confidence) ? f.confidence : 'inferred';
  };
  const fieldStates = {
    name: confidenceOf('name'),
    logo: logoDataUri ? confidenceOf('logo') === 'missing' ? 'inferred' : confidenceOf('logo') : 'missing',
    primary: confidenceOf('colors.primary'),
    secondary: secondary ? confidenceOf('colors.secondary') : null,
    body: confidenceOf('typography.body'),
    heading: confidenceOf('typography.heading'),
    tone: confidenceOf('voice.register'),
  };
  if (!logoDataUri) warn('no --brand-logo data URI found in tokens.css — falling back to a text mark');
  else if (!logoDims) warn('could not read the logo\'s own proportions — drawing it at 3:1');

  // PRODUCT.md sections --------------------------------------------------
  const sections = splitMdSections(productMd);
  const sampleSection = findSection(sections, /sample|przyk[łl]ad/i);
  // "## Register", "## Rejestr", "## Odbiorca i rejestr", "## Voice", "## Ton".
  const voiceSection = findSection(sections, /voice|ton|register|rejestr|g[łl]os/i);
  const sampleParagraph = firstParagraph(sampleSection?.body) || firstParagraph(voiceSection?.body);

  // Notes (with graceful fallback when meta.notes is absent) --------------
  const metaNotes = meta.notes || {};
  let notesName = metaNotes.name;
  if (!notesName) {
    notesName = field(meta, 'name')?.note || null;
    if (notesName) warn('notes.name missing — used fields["name"].note instead');
  }
  let notesLogo = metaNotes.logo;
  if (!notesLogo) {
    notesLogo = logoNote?.note || null;
    if (notesLogo) warn('notes.logo missing — used fields["logo"].note instead');
  }
  let notesTone = metaNotes.tone;
  if (!notesTone) {
    notesTone = sampleParagraph || null;
    if (notesTone) warn('notes.tone missing — used the sample paragraph from PRODUCT.md instead');
  }
  const voiceSample = fieldValue(meta, 'voice.sample');

  // Anti-reference words --------------------------------------------------
  // Source order: meta.notes.avoid (explicit, structured) first, then a
  // recognized-prefix line in PRODUCT.md, then omit — see
  // extractAntiReferenceWords() for the accepted prefixes.
  let nowords = [];
  if (Array.isArray(meta.notes?.avoid) && meta.notes.avoid.length > 0) {
    nowords = meta.notes.avoid;
  } else {
    nowords = extractAntiReferenceWords(productMd);
    if (nowords.length === 0) warn('no anti-reference words found in PRODUCT.md and no notes.avoid — "words we will not use" list omitted');
  }

  // Composition ------------------------------------------------------------
  let composition = meta.composition && typeof meta.composition === 'object' ? { ...meta.composition } : null;
  if (!composition) {
    const density = fieldValue(meta, 'composition.density');
    const imagery = fieldValue(meta, 'composition.imagery');
    const rhythm = fieldValue(meta, 'composition.rhythm');
    if (density || imagery || rhythm) {
      composition = { density, imagery, rhythm };
      warn('meta.composition object missing — assembled from fields["composition.*"] instead');
    }
  }

  // Questions ----------------------------------------------------------
  let questions = Array.isArray(meta.questions) ? meta.questions : [];
  if (questions.length === 0 && !Array.isArray(meta.questions)) {
    warn('questions missing from profile.meta.json — rendering the empty-questions closing sentence only');
  }

  // Preview ---------------------------------------------------------------
  // No `preview` in the meta file is the normal case at teach time: there
  // is no document yet, so the sheet shows a sample about the profile
  // itself (renderPreviewDoc), labeled as a sample, with no invented title,
  // date or next step. A profile that carries `preview` renders its head.
  const previewSample = !meta.preview || (!meta.preview.title && !meta.preview.nextStep);
  let previewTitle;
  let previewNextStep = null;
  let notesPreview;
  if (previewSample) {
    previewTitle = STRINGS[lang].sampleTitle(name);
    notesPreview = STRINGS[lang].sampleTldr;
  } else {
    previewTitle = meta.preview.title;
    if (!previewTitle) {
      previewTitle = STRINGS[lang].previewTitleFallback;
      warn(`preview.title missing — used fallback "${previewTitle}"`);
    }
    previewNextStep = meta.preview.nextStep;
    if (!previewNextStep) {
      previewNextStep = STRINGS[lang].previewNextStepFallback;
      warn(`preview.nextStep missing — used fallback "${previewNextStep}"`);
    }
    notesPreview = metaNotes.preview;
    if (!notesPreview) {
      notesPreview = STRINGS[lang].previewTldrFallback;
      warn('notes.preview missing — used a generic fallback sentence');
    }
  }

  return {
    name, slug, style, lang, sources,
    primary, foreground, secondary, backgroundTokenValue, foregroundTokenValue, backgroundFromBrand,
    bodyFace, headingFace, headingWeight,
    logoNote, logoDataUri, logoOn, logoDims, logoPlate, logoMask, inkIsPrimary, previewCss, fieldStates,
    notesName, notesLogo, notesTone, voiceSample, nowords,
    composition, questions, previewSample, previewTitle, previewNextStep, notesPreview,
  };
}

// ============================================================
// HTML rendering
// ============================================================

function renderSourcesLine(sources) {
  if (sources.length === 0) return null;
  return sources
    .map((s) => (s.ref || '').replace(/^https?:\/\//i, '').replace(/\/$/, ''))
    .filter(Boolean)
    .join('; ');
}

const MARK_SIZES = {
  'mark--head': { maxW: 220, maxH: 56 },
  'mark--panel': { maxW: 160, maxH: 48 },
};

// The logo is drawn from the tokens, never from its own <img>: the tokens
// already carry the data URI once, a second copy per mark tripled the
// sheet's size, and only the variables switch to the dark color inside a
// dark panel. The box takes the artwork's own proportions. Width and
// height are set on the content box, so a plate's padding sits outside the
// artwork: the plate hugs the logo with no empty band beside it. Single-color artwork is a mask filled with
// --brand-logo-color, which each theme sets.
function renderMark({ model, sizeClass = 'mark--panel', bare = false }) {
  if (model.logoDataUri) {
    const { width, height } = model.logoDims || { width: 3, height: 1 };
    const ratio = width / height;
    const { maxW, maxH } = MARK_SIZES[sizeClass] || MARK_SIZES['mark--panel'];
    const w = Math.min(maxW, maxH * ratio);
    const h = w / ratio;
    const style = `width:${Math.round(w * 10) / 10}px;height:${Math.round(h * 10) / 10}px`;
    const kind = model.logoMask ? ' mark-img--mask' : '';
    return `<span class="mark-img ${sizeClass}${kind}${bare ? ' mark-img--bare' : ''}" role="img" aria-label="${escapeHtml(model.name)}" style="${style}"></span>`;
  }
  return `<span class="mark-text ${sizeClass}">${escapeHtml(model.name)}</span>`;
}

// The preview document. Without a real `preview` in the meta file it is a
// short document about this profile: what was read, how sure we are, what
// happens next. Every line is true of the profile, so nothing is invented,
// and it exercises the markup a document uses (head, summary, status
// ledger, table, callout, steps). With a real `preview` it is that
// document's head.
function renderPreviewDoc(model, t, { sourcesLine, metaRows, date }) {
  const pv = t.pv;
  const hex = (f) => (f && typeof f.value === 'string' && HEX_RE.test(f.value) ? f.value.toUpperCase() : null);
  const chip = (h) => `<span class="pv-chip" style="background:${h}" aria-hidden="true"></span>`;
  const mark = renderMark({ model, sizeClass: 'mark--panel' }).replace('class="', 'class="brand-mark ');
  const primary = hex(model.primary);
  const secondary = hex(model.secondary);
  const head = (title, kicker, lede, rows) => `<header class="doc-head">
      ${mark}
      ${kicker ? `<p class="kicker">${escapeHtml(kicker)}</p>
      ` : ''}<p class="pv-title">${escapeHtml(title)}</p>
      ${lede ? `<p class="lede">${escapeHtml(lede)}</p>
      ` : ''}${renderMetaDl(rows)}
    </header>`;
  if (!model.previewSample) {
    return `<div class="doc">
    ${head(model.previewTitle, null, null, metaRows)}
    <div class="summary">
      <p class="label">${escapeHtml(t.previewTldrLabel)}</p>
      <p>${escapeHtml(model.notesPreview)}</p>
    </div>
  </div>`;
  }
  const rows = [
    [t.metaClient, escapeHtml(model.name)],
    ...(sourcesLine ? [[t.metaSources, escapeHtml(sourcesLine)]] : []),
    [t.metaDate, escapeHtml(date)],
    [t.metaStatus, escapeHtml(pv.status)],
  ];
  const summary = pv.summary({ heading: model.headingFace?.value, body: model.bodyFace?.value, colors: Boolean(primary) });
  const STATE_CLASS = { confirmed: 'ok', inferred: 'neutral', guessed: 'warn', missing: 'neutral' };
  const ledger = Object.entries(model.fieldStates)
    .filter(([, state]) => state)
    .map(([key, state]) => `        <div><dt>${escapeHtml(pv.rows[key])}</dt><dd><span class="state ${STATE_CLASS[state]}">${escapeHtml(pv.states[state])}</span></dd></div>`)
    .join('\n');
  const colorRows = [
    ['primary', primary],
    ['secondary', secondary],
    ['foreground', hex(model.foreground)],
    ['background', model.backgroundFromBrand && HEX_RE.test(model.backgroundTokenValue || '') ? model.backgroundTokenValue.toUpperCase() : null],
  ].filter(([, h]) => h)
    .map(([key, h]) => `          <tr><td>${escapeHtml(pv.rows[key])}</td><td>${chip(h)}${h}</td></tr>`)
    .join('\n');
  const n = model.questions.length;
  return `<div class="doc">
    ${head(pv.title(model.name), pv.kicker, pv.lede(sourcesLine), rows)}
    ${summary ? `<div class="summary">
      <p class="label">${escapeHtml(t.previewTldrLabel)}</p>
      <p>${escapeHtml(summary)}</p>
    </div>` : ''}
    <section>
      <h2 id="${slugify(pv.readHeading)}">${escapeHtml(pv.readHeading)}</h2>
      <dl class="status">
${ledger}
      </dl>
      ${colorRows ? `<div class="table-wrap"><table>
        <thead><tr><th>${escapeHtml(pv.colorHead[0])}</th><th>${escapeHtml(pv.colorHead[1])}</th></tr></thead>
        <tbody>
${colorRows}
        </tbody>
      </table></div>` : ''}
      <div class="callout">
        <p class="label">${escapeHtml(pv.calloutLabel)}</p>
        <p>${escapeHtml(n ? pv.calloutQuestions(n) : pv.calloutNone)}</p>
      </div>
    </section>
    <section>
      <h2 id="${slugify(pv.nextHeading)}">${escapeHtml(pv.nextHeading)}</h2>
      <ol class="steps">
${pv.steps.map(([when, what]) => `        <li><span class="when">${escapeHtml(when)}</span><div>${escapeHtml(what)}</div></li>`).join('\n')}
      </ol>
    </section>
  </div>`;
}

function renderMasthead(model, t) {
  const dark = model.logoOn === 'dark';
  return `
<div class="masthead ${dark ? 'masthead--dark' : 'masthead--light'}">
  <div class="wrap">${renderMark({ model, sizeClass: 'mark--head' })}</div>
</div>
<div class="rule"></div>`;
}

function renderMetaDl(rows) {
  return `<dl class="meta">
${rows.map(([k, v]) => `    <div><dt>${escapeHtml(k)}</dt><dd>${v}</dd></div>`).join('\n')}
  </dl>`;
}

function renderSwatch({ label, value, note, guessed, confirmPillLabel }) {
  const normalized = normalizeColorValue(value);
  return `<div class="swatch">
      <div class="chip chip--fixed" style="background:${escapeHtml(normalized)}"></div>
      <div class="name">${escapeHtml(label)}${guessed ? ` <span class="tag">${escapeHtml(confirmPillLabel)}</span>` : ''}</div>
      <div class="value">${escapeHtml(normalized)}</div>
      <p class="note">${note}</p>
    </div>`;
}

function renderDocument(model, t) {
  const lang = model.lang;
  // One date on the sheet: the day it was built. When the evidence was
  // collected stays in profile.meta.json; two dates on one page read as a typo.
  const dateToday = formatDateLocal(new Date(), lang);
  const dateTop = dateToday;
  const sourcesLine = renderSourcesLine(model.sources);
  const favicon = dataUriSvg(`<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'><rect width='32' height='32' fill='none'/><rect x='4' y='13' width='24' height='6' fill='${/^#/.test(model.primary?.value || '') ? model.primary.value : '#888888'}'/></svg>`);
  const title = `${t.titlePrefix}: ${model.name}`;
  const description = t.ogDescription(model.name);

  // ---- Section 1: logo and name ----
  let section1Body;
  if (model.logoDataUri) {
    // The header panel always matches --brand-logo-on. The opposite panel
    // exists to show why the logo version is still an open question; once
    // the owner has confirmed the logo there is nothing left to compare.
    //
    // Artwork on paper: the second panel is a dark-theme panel, where
    // the mask takes the dark theme's --brand-logo-color (or --brand-logo turns
    // into the dark copy, or the logo sits on its light plate), which is what a reader in dark mode sees. Artwork on
    // a dark band: the second panel is bare paper, showing why the band is
    // there.
    const onDark = model.logoOn === 'dark';
    const panel = ({ variant, caption, theme = null, bare = false }) => `
    <div class="logopanel logopanel--${variant}"${theme ? ` data-theme="${theme}"` : ''}>
      ${renderMark({ model, sizeClass: 'mark--panel', bare })}
      <p class="panelnote">${escapeHtml(caption)}</p>
    </div>`;
    const header = panel({ variant: onDark ? 'dark' : 'light', caption: t.panelHeaderCaption(onDark) });
    const opposite = onDark
      ? panel({ variant: 'light', caption: t.panelOppositeCaption, bare: true })
      : panel({ variant: 'themed', caption: t.panelDarkModeCaption, theme: 'dark' });
    section1Body = model.logoNote?.confidence === 'confirmed'
      ? `
  <div class="logopair logopair--single">${header}
  </div>`
      : `
  <div class="logopair">${header}${opposite}
  </div>`;
  } else {
    section1Body = `
  <div class="logopanel logopanel--light">
    <span class="mark-text mark--panel">${escapeHtml(model.name)}</span>
    <p class="panelnote">${escapeHtml(t.noLogoSentence)}</p>
  </div>`;
  }
  const nameLine = `<p>${t.nameInDocs(model.name)}${model.notesLogo ? ` ${escapeHtml(sanitizeProvenance(model.notesLogo, lang))}` : ''}</p>`;

  // ---- Section 2: colors ----
  const swatches = [];
  if (model.primary) {
    swatches.push(renderSwatch({
      label: t.colorPrimary, value: model.primary.value, note: escapeHtml(sanitizeProvenance(model.primary.note, lang) || ''),
      guessed: model.primary.confidence === 'guessed', confirmPillLabel: t.confirmPill,
    }));
  }
  if (model.foreground?.value) {
    swatches.push(renderSwatch({
      label: t.colorForeground, value: model.foreground.value, note: escapeHtml(sanitizeProvenance(model.foreground.note, lang) || ''),
      guessed: model.foreground.confidence === 'guessed', confirmPillLabel: t.confirmPill,
    }));
  } else if (model.foregroundTokenValue) {
    // No text color from the brand (a dark site, or no rule): documents use
    // the style's, so the swatch shows that one and says where it is from.
    const fieldNote = sanitizeProvenance(model.foreground?.note, lang);
    swatches.push(renderSwatch({
      label: t.colorForeground, value: model.foregroundTokenValue,
      note: escapeHtml(fieldNote ? `${t.fromStyle} ${fieldNote}` : t.fromStyle),
      guessed: false, confirmPillLabel: t.confirmPill,
    }));
  }
  if (model.backgroundTokenValue) {
    swatches.push(renderSwatch({
      label: t.colorBackground, value: model.backgroundTokenValue,
      note: escapeHtml(model.backgroundFromBrand ? t.backgroundFromSite : t.backgroundNote),
      guessed: false, confirmPillLabel: t.confirmPill,
    }));
  }
  if (model.secondary && model.secondary.value != null) {
    swatches.push(renderSwatch({
      label: t.colorSecondary, value: model.secondary.value, note: escapeHtml(sanitizeProvenance(model.secondary.note, lang) || ''),
      guessed: model.secondary.confidence === 'guessed', confirmPillLabel: t.confirmPill,
    }));
  }

  // ---- Section 3: typography ----
  const facts = [];
  // A face the documents cannot carry is swapped for the nearest open one
  // and marked guessed; the label makes that swap answerable on the sheet.
  // Each face gets its own "where from" line, which is also where a
  // substituted face explains itself.
  const pill = (f) => (f?.confidence === 'guessed' ? ` <span class="tag">${escapeHtml(t.confirmPill)}</span>` : '');
  if (model.bodyFace) facts.push(`<li><strong>${escapeHtml(t.bodyFace)}:</strong> ${escapeHtml(model.bodyFace.value)}${pill(model.bodyFace)}</li>`);
  if (model.headingFace && model.headingFace.value !== model.bodyFace?.value) {
    facts.push(`<li><strong>${escapeHtml(t.headingFace)}:</strong> ${escapeHtml(model.headingFace.value)}${pill(model.headingFace)}</li>`);
  }
  if (model.headingWeight != null) facts.push(`<li><strong>${escapeHtml(t.headingWeight)}:</strong> ${escapeHtml(String(model.headingWeight))}</li>`);
  const bodyNote = sanitizeProvenance(model.bodyFace?.note, lang);
  const headingNote = sanitizeProvenance(model.headingFace?.note, lang);
  if (bodyNote) facts.push(`<li><strong>${escapeHtml(t.fontLoadingBody)}:</strong> ${escapeHtml(bodyNote)}</li>`);
  if (headingNote && headingNote !== bodyNote) facts.push(`<li><strong>${escapeHtml(t.fontLoadingHeading)}:</strong> ${escapeHtml(headingNote)}</li>`);
  const notesToneSanitized = sanitizeProvenance(model.notesTone, lang);
  const sampleParagraphText = notesToneSanitized
    ? notesToneSanitized.split(/(?<=[.!?])\s+/)[0]
    : model.voiceSample || '';

  // ---- Section 4: tone ----
  const nowordsBlock = model.nowords.length > 0
    ? `<p class="nowords-label">${escapeHtml(t.nowordsLabel)}:</p>
  <ul class="nowords">
${model.nowords.map((w) => `    <li>${escapeHtml(w)}</li>`).join('\n')}
  </ul>`
    : `<p>${escapeHtml(t.nowordsEmpty)}</p>`;

  // ---- Section 5: composition ----
  let compositionBody;
  if (model.composition && (model.composition.density || model.composition.imagery || model.composition.rhythm)) {
    const lines = [];
    if (model.composition.density && t.density[model.composition.density]) lines.push(`<p>${escapeHtml(t.density[model.composition.density])}</p>`);
    if (model.composition.imagery && t.imagery[model.composition.imagery]) lines.push(`<p>${escapeHtml(t.imagery[model.composition.imagery])}</p>`);
    if (model.composition.rhythm && t.rhythm[model.composition.rhythm]) lines.push(`<p>${escapeHtml(t.rhythm[model.composition.rhythm])}</p>`);
    compositionBody = lines.join('\n  ');
  } else {
    compositionBody = `<p>${escapeHtml(t.compositionFallback)}</p>`;
  }

  // ---- Section 6: questions ----
  let questionsBody;
  if (model.questions.length > 0) {
    // The <ol> supplies the number (see ol.questions > li::marker below) —
    // the heading text never gets a second, manual "1. " prefix. Question
    // text and "why" both go through sanitizeProvenance(): these strings
    // come from a taught profile and can carry technical tokens a reader
    // shouldn't see (an og:site_name, a CSS variable name, ...).
    questionsBody = `<ol class="questions">
${model.questions.map((q) => `    <li>
      <h3 id="${escapeHtml(q.id)}">${escapeHtml(sanitizeProvenance(q.text, lang))}</h3>
      <p>${escapeHtml(sanitizeProvenance(q.why || '', lang))}</p>
    </li>`).join('\n')}
  </ol>
  <p>${escapeHtml(t.questionsClosing)}</p>`;
  } else {
    questionsBody = `<p>${escapeHtml(t.questionsClosing)}</p>`;
  }

  // ---- Section 7: preview ----
  // The sample carries only what the profile knows: the brand and the day
  // the sheet was built.
  const previewMetaRows = model.previewSample
    ? [
        [t.metaClient, escapeHtml(model.name)],
        [t.metaDate, escapeHtml(dateToday)],
      ]
    : [
        [t.metaClient, escapeHtml(model.name)],
        [t.metaDate, escapeHtml(dateToday)],
        [t.metaStatus, escapeHtml(t.previewStatus)],
        [t.previewNextStep, escapeHtml(model.previewNextStep)],
      ];

  const topMetaRows = [
    [t.metaClient, escapeHtml(model.name)],
  ];
  if (sourcesLine) topMetaRows.push([t.metaSources, escapeHtml(sourcesLine)]);
  topMetaRows.push([t.metaDate, escapeHtml(dateTop)]);
  topMetaRows.push([t.metaStatus, escapeHtml(t.metaStatusValue)]);
  topMetaRows.push([t.metaAnswers, escapeHtml(t.metaAnswersValue)]);

  return `<!doctype html>
<html lang="${lang}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(title)}</title>
<meta name="description" content="${escapeHtml(description)}">
<meta property="og:title" content="${escapeHtml(title)}">
<meta property="og:description" content="${escapeHtml(description)}">
<meta property="og:type" content="article">
<link rel="icon" href="${favicon}">
<style>
${model.tokensCssRaw}

/* ---- brand-sheet document styles (tokens only; chip fills are the one
   deliberate exception — they must show the captured value verbatim) ---- */
*, *::before, *::after { box-sizing: border-box; }
html { -webkit-text-size-adjust: 100%; }
body {
  margin: 0;
  background: var(--background);
  color: var(--foreground);
  font-family: var(--font-sans);
  font-size: var(--text-base, 1rem);
  line-height: var(--leading-normal, 1.55);
  overflow-x: hidden;
}
.wrap { max-width: var(--measure, 44rem); margin: 0 auto; padding: 0 16px; }

.masthead { padding: 22px 0 20px; }
.masthead--dark { background: var(--brand-logo-plate, var(--foreground)); }
.masthead--light { background: var(--card, var(--background)); }
.masthead--light .mark-text { color: var(--foreground); }
.masthead--dark .mark-text { color: var(--background); }
.mark-img {
  display: block;
  box-sizing: content-box;
  max-width: 100%;
  background-image: var(--brand-logo);
  background-repeat: no-repeat;
  background-position: left center;
  background-size: contain;
  -webkit-print-color-adjust: exact;
  print-color-adjust: exact;
}${model.logoPlate ? `
.mark-img {
  padding: 6px 10px;
  background-origin: content-box;
  background-color: var(--brand-logo-plate, transparent);
  border-radius: var(--radius-sm, 3px);
}
.mark-img--bare { background-color: transparent; }` : ''}${model.logoMask ? `
.mark-img--mask {
  background: var(--brand-logo-color, var(--foreground));
  -webkit-mask: var(--brand-logo-mask) left center / contain no-repeat;
  mask: var(--brand-logo-mask) left center / contain no-repeat;
}` : ''}
.mark-text { font-family: var(--font-display); font-weight: 300; font-size: 1.5rem; }
.rule { height: var(--brand-rule-height, 6px); background: var(--brand-rule, var(--primary)); }

header .titleblock { padding-top: 34px; padding-bottom: 6px; }
/* Element rules skip .doc: they lay out the sheet and must not reach the
   preview document, which the base style lays out. */
h1${NOT_DOC} {
  font-family: var(--font-display);
  font-size: var(--text-3xl, 2rem);
  font-weight: var(--font-heading-weight, ${model.headingWeight ?? 700});
  line-height: var(--leading-tight, 1.2);
  margin: 0 0 14px;
  color: var(--foreground);
}
h1 .accent { color: var(--primary-ink, var(--foreground)); }
.titleblock .lede { font-size: var(--text-lg, 1.125rem); line-height: 1.5; margin: 0 0 26px; max-width: 38rem; }

dl.meta${NOT_DOC} { margin: 0 0 38px; padding: 0; border-top: 1px solid var(--border); }
dl.meta${NOT_DOC} div { display: flex; gap: 12px; align-items: baseline; padding: 7px 0; border-bottom: 1px solid var(--border); flex-wrap: wrap; }
dl.meta${NOT_DOC} dt { flex: 0 0 9.5rem; margin: 0; font-size: var(--text-xs, 0.75rem); font-weight: 700; letter-spacing: var(--tracking-label, 0.06em); text-transform: uppercase; color: var(--muted-foreground); }
dl.meta${NOT_DOC} dd { margin: 0; font-size: var(--text-sm, 0.875rem); }

section${NOT_DOC} { margin: 0 0 var(--space-section, 2.5rem); }
h2${NOT_DOC} {
  font-family: var(--font-display);
  font-size: var(--text-xl, 1.375rem);
  font-weight: var(--font-heading-weight, 700);
  line-height: 1.25;
  margin: 0 0 12px;
  padding-top: 14px;
  border-top: var(--brand-rule-height, 6px) solid var(--brand-rule, var(--primary));
}
h3${NOT_DOC} { font-size: var(--text-base, 1rem); font-weight: var(--font-heading-weight, 700); line-height: 1.35; margin: 0 0 5px; }
p${NOT_DOC} { margin: 0 0 13px; }
p${NOT_DOC}:last-child { margin-bottom: 0; }

.logopair { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; margin: 0 0 15px; }
.logopair--single { grid-template-columns: 1fr; }
.logopanel { padding: 20px 18px; border: 1px solid var(--border); }
.logopanel--dark { background: var(--brand-logo-plate, var(--foreground)); }
.logopanel--light { background: var(--card, var(--background)); }
.logopanel--themed { background: var(--background); color: var(--foreground); }
.logopanel--dark .mark-text { color: var(--background); }
.logopanel--light .mark-text { color: var(--foreground); }
.panelnote { margin: 14px 0 0; font-size: var(--text-sm, 0.875rem); line-height: 1.45; color: var(--muted-foreground); }
.logopanel--dark .panelnote { color: var(--background); opacity: 0.75; }

.swatches { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 22px 18px; margin-bottom: 24px; }
.swatch { min-width: 0; }
.swatch .chip { height: 72px; border: 1px solid var(--border); margin-bottom: 9px; }
.swatch .name { font-weight: 700; font-size: var(--text-sm, 0.875rem); }
.swatch .value { font-family: var(--font-mono); font-size: var(--text-sm, 0.875rem); margin: 2px 0 5px; word-break: break-all; }
.swatch .note { font-size: var(--text-sm, 0.875rem); line-height: 1.4; color: var(--muted-foreground); margin: 0; }
.tag { display: inline-block; margin-left: 6px; padding: 1px 6px; font-size: 0.6875rem; font-weight: 700; letter-spacing: 0.06em; text-transform: uppercase; background: var(--accent); color: var(--accent-foreground); border: 1px solid var(--accent-foreground); }

.typesample { border: 1px solid var(--border); padding: 20px 18px; background: var(--card, var(--background)); }
.typesample .t-display { font-family: var(--font-display); font-size: var(--text-2xl, 1.5rem); font-weight: var(--font-heading-weight, ${model.headingWeight ?? 700}); line-height: 1.2; margin: 0 0 11px; }
.typesample .t-body { margin: 0; }
.facts { margin: 15px 0 0; padding-left: 1.15em; }
.facts li { margin-bottom: 5px; }

.voice { border-left: 4px solid var(--brand-rule, var(--primary)); padding-left: 16px; }
.nowords-label { font-weight: 700; margin: 22px 0 6px; }
.nowords { margin: 0 0 0 1.15em; padding: 0; font-size: var(--text-sm, 0.875rem); color: var(--muted-foreground); }
.nowords li { margin-bottom: 4px; }

ol.questions { margin: 0; padding-left: 1.7em; }
ol.questions > li { margin-bottom: 19px; }
ol.questions > li::marker { font-weight: 700; color: var(--primary-ink, var(--foreground)); }
ol.questions p { font-size: var(--text-sm, 0.875rem); color: var(--muted-foreground); margin: 0; }

.preview { border: 1px solid var(--border); background: var(--card, var(--background)); overflow: hidden; }
.preview .band { padding: 15px 20px 13px; }
.preview .band.band--dark { background: var(--brand-logo-plate, var(--foreground)); }
.preview .band.band--light { background: var(--card, var(--background)); }
.preview .inner { padding: 22px 20px 26px; }${model.previewSample ? '\n.preview .sample-tag { margin: 0 0 10px; }\n.preview .sample-tag .tag { margin-left: 0; }' : ''}
.preview .doc-title { font-family: var(--font-display); font-size: var(--text-2xl, 1.5rem); font-weight: var(--font-heading-weight, ${model.headingWeight ?? 700}); line-height: 1.2; margin: 0 0 15px; }
.preview .tldr { border-top: var(--brand-rule-height, 6px) solid var(--brand-rule, var(--primary)); padding-top: 13px; margin-bottom: 0; }
.preview .tldr .label { font-size: var(--text-xs, 0.75rem); font-weight: 700; letter-spacing: 0.06em; text-transform: uppercase; color: var(--muted-foreground); display: block; margin-bottom: 5px; }

footer${NOT_DOC} { border-top: 1px solid var(--border); margin-top: 46px; padding: 17px 0 44px; }
footer${NOT_DOC} p { font-size: var(--text-sm, 0.875rem); color: var(--muted-foreground); margin: 0; }

${model.previewCss ? `.preview-frame { border: 1px solid var(--border); background: var(--background); color: var(--foreground); }
/* The style keeps its own padding: some draw in it (consulting's spine). */
.preview-frame > .doc { margin: 0 auto; }
.preview-frame .brand-mark { display: block; }
.sample-tag { margin: 0 0 10px; }
.sample-tag .tag { margin-left: 0; }
.pv-chip { display: inline-block; width: 1.05em; height: 1.05em; border-radius: 3px; vertical-align: -0.18em; margin-right: 0.5em;
  box-shadow: inset 0 0 0 1px color-mix(in oklab, var(--foreground) 25%, transparent); -webkit-print-color-adjust: exact; print-color-adjust: exact; }

/* ---- the base style (${model.style}) for the preview document ---- */
${model.previewCss}

` : ''}@media (max-width: 640px) {
  .logopair { grid-template-columns: 1fr; gap: 12px; }
  dl.meta${NOT_DOC} div { flex-direction: column; gap: 1px; }
  dl.meta${NOT_DOC} dt { flex: none; }
}
@media (max-width: 480px) {
  .swatches { grid-template-columns: 1fr; }
  h1${NOT_DOC} { font-size: 1.5rem; }
}
</style>
</head>
<body>
<header>
${renderMasthead(model, t)}
  <div class="wrap titleblock">
    <h1>${t.titlePrefix}: <span class="accent">${escapeHtml(model.name)}</span></h1>
    <p class="lede">${escapeHtml(t.lede)}</p>
    ${renderMetaDl(topMetaRows)}
  </div>
</header>

<main class="wrap">

<section>
  <h2 id="logo-and-name">${escapeHtml(t.sections['logo-and-name'])}</h2>
  <p>${escapeHtml(sanitizeProvenance(model.notesName, lang) || '')}</p>${section1Body}
  ${nameLine}
</section>

<section>
  <h2 id="colors">${escapeHtml(t.sections.colors)}</h2>
  <div class="swatches">
${swatches.join('\n')}
  </div>
  <p>${escapeHtml(model.inkIsPrimary ? t.colorClosingSameInk : t.colorClosing)}</p>
</section>

<section>
  <h2 id="typography">${escapeHtml(t.sections.typography)}</h2>
  <div class="typesample">
    <p class="t-display">${escapeHtml(model.previewTitle)}</p>
    <p class="t-body">${escapeHtml(sampleParagraphText)}</p>
  </div>
  <ul class="facts">
${facts.join('\n')}
  </ul>
</section>

<section>
  <h2 id="tone">${escapeHtml(t.sections.tone)}</h2>
  <div class="voice">
    <p>${escapeHtml(notesToneSanitized || '')}</p>
  </div>
  ${nowordsBlock}
</section>

<section>
  <h2 id="composition">${escapeHtml(t.sections.composition)}</h2>
  ${compositionBody}
</section>

<section>
  <h2 id="questions">${escapeHtml(t.sections.questions)}</h2>
  ${questionsBody}
</section>

<section>
  <h2 id="preview">${escapeHtml(t.sections.preview)}</h2>
  <p>${escapeHtml(model.previewCss && model.previewSample ? t.previewIntroSample : t.previewIntro)}</p>
  ${model.previewCss ? `${model.previewSample ? `<p class="sample-tag"><span class="tag">${escapeHtml(t.sampleTag)}</span></p>
  ` : ''}<div class="preview-frame">
  ${renderPreviewDoc(model, t, { sourcesLine, metaRows: previewMetaRows, date: dateToday })}
  </div>` : `<div class="preview">
    <div class="band ${model.logoOn === 'dark' ? 'band--dark' : 'band--light'}">${renderMark({ model, sizeClass: 'mark--panel' })}</div>
    <div class="inner">
      ${model.previewSample ? `<p class="sample-tag"><span class="tag">${escapeHtml(t.sampleTag)}</span></p>
      ` : ''}<p class="doc-title">${escapeHtml(model.previewTitle)}</p>
      ${renderMetaDl(previewMetaRows)}
      <div class="tldr">
        <span class="label">${escapeHtml(t.previewTldrLabel)}</span>
        <p>${escapeHtml(model.notesPreview)}</p>
      </div>
    </div>
  </div>`}
</section>

</main>

<footer>
  <div class="wrap">
    <p>${t.footerStatus(escapeHtml(model.name), escapeHtml(dateTop))}</p>
  </div>
</footer>

</body>
</html>
`;
}

// ============================================================
// Main
// ============================================================

function main() {
  const args = parseArgs(process.argv.slice(2));
  if (!args.profileDir) {
    console.error('usage: node brand-sheet.mjs <profile-dir> [--out <path>] [--check-script <path>]');
    process.exit(1);
  }
  const profileDir = resolve(args.profileDir);
  const outPath = args.outPath ? resolve(args.outPath) : join(profileDir, 'brand-sheet.html');
  const checkScript = args.checkScript ? resolve(args.checkScript) : join(__dirname, 'check-document.mjs');

  const warnings = [];
  const warn = (msg) => warnings.push(msg);

  let html;
  try {
    const profile = loadProfile(profileDir);
    const model = buildModel(profile, warn);
    model.tokensCssRaw = profile.tokensCss;
    const t = STRINGS[model.lang];
    html = renderDocument(model, t);
  } catch (e) {
    if (e instanceof FatalError) {
      console.error(`brand-sheet: ${e.message}`);
      process.exit(1);
    }
    throw e;
  }

  try {
    writeFileSync(outPath, html, 'utf8');
  } catch (e) {
    console.error(`brand-sheet: could not write ${outPath} — ${e.message}`);
    process.exit(1);
  }

  console.log(`brand-sheet: wrote ${outPath}`);
  if (warnings.length > 0) {
    console.warn(`brand-sheet: ${warnings.length} warning(s):`);
    for (const w of warnings) console.warn(`  - ${w}`);
  }

  if (!existsSync(checkScript)) {
    console.error(`brand-sheet: check script not found: ${checkScript}`);
    process.exit(1);
  }
  const result = spawnSync(process.execPath, [checkScript, outPath], { encoding: 'utf8', stdio: 'inherit' });
  process.exit(result.status ?? 1);
}

main();
