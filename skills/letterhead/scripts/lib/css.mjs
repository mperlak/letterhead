// Small CSS helpers shared by check-document.mjs, check-tokens.mjs and
// brand-evidence.mjs.
//
// Not a full CSS parser. It reads the shapes letterhead documents and
// tokens files actually use: style rules, @media / @supports / @layer /
// @container groups, @keyframes, and declaration-only at-rules such as
// @font-face. Every node keeps its absolute offset in the source file so
// findings can point at a line.

import { parse as parseColor, converter, wcagContrast } from '../vendor/culori.mjs';

const GROUP_AT_RULES = new Set(['media', 'supports', 'layer', 'container', 'scope', 'document', 'keyframes', '-webkit-keyframes']);

// Replace /* ... */ with spaces of the same length, keeping newlines, so
// offsets computed on the blanked text still match the original.
export function blankComments(css) {
  return css.replace(/\/\*[\s\S]*?(?:\*\/|$)/g, (m) => m.replace(/[^\n]/g, ' '));
}

// Index of the character that closes the block opened at `open` (a "{"),
// skipping strings and nested blocks. Returns css.length when unclosed.
function matchBrace(css, open) {
  let depth = 0;
  for (let i = open; i < css.length; i++) {
    const ch = css[i];
    if (ch === '"' || ch === "'") {
      i = skipString(css, i);
    } else if (ch === '{') {
      depth++;
    } else if (ch === '}') {
      depth--;
      if (depth === 0) return i;
    }
  }
  return css.length;
}

function skipString(css, i) {
  const quote = css[i];
  for (let j = i + 1; j < css.length; j++) {
    if (css[j] === '\\') { j++; continue; }
    if (css[j] === quote || css[j] === '\n') return j;
  }
  return css.length;
}

// Split `text` on `sep` where it is not inside quotes or parentheses.
// Returns [{ part, start }] with start relative to `text`.
export function splitTopLevel(text, sep) {
  const parts = [];
  let depth = 0;
  let start = 0;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === '"' || ch === "'") i = skipString(text, i);
    else if (ch === '(' || ch === '[') depth++;
    else if (ch === ')' || ch === ']') depth = Math.max(0, depth - 1);
    else if (ch === sep && depth === 0) {
      parts.push({ part: text.slice(start, i), start });
      start = i + 1;
    }
  }
  parts.push({ part: text.slice(start), start });
  return parts;
}

export function parseDeclarations(body, bodyStart = 0) {
  const decls = [];
  for (const { part, start } of splitTopLevel(body, ';')) {
    if (part.includes('{')) continue;
    const colon = part.indexOf(':');
    if (colon === -1) continue;
    const rawProp = part.slice(0, colon).trim();
    if (!rawProp) continue;
    let value = part.slice(colon + 1).trim();
    let important = false;
    const bang = value.match(/!\s*important\s*$/i);
    if (bang) {
      important = true;
      value = value.slice(0, bang.index).trim();
    }
    const lead = part.length - part.trimStart().length;
    const prop = rawProp.startsWith('--') ? rawProp : rawProp.toLowerCase();
    decls.push({ prop, value, important, start: bodyStart + start + lead });
  }
  return decls;
}

// Parse a stylesheet into a node list. `offset` is the absolute position of
// css[0] in the file. Node shapes:
//   { type: 'rule', selector, start, decls }
//   { type: 'at', name, prelude, start, children }   (group at-rules)
//   { type: 'at', name, prelude, start, decls }      (@font-face, @page, ...)
//   { type: 'at', name, prelude, start }             (@import, @charset)
export function parseCss(source, offset = 0) {
  const css = blankComments(source);
  return parseBlock(css, 0, css.length, offset);
}

function parseBlock(css, from, to, offset) {
  const nodes = [];
  let i = from;
  while (i < to) {
    // skip whitespace and stray closers
    while (i < to && (/\s/.test(css[i]) || css[i] === '}' || css[i] === ';')) i++;
    if (i >= to) break;
    const preludeStart = i;
    let depth = 0;
    let end = -1;
    let kind = null;
    for (; i < to; i++) {
      const ch = css[i];
      if (ch === '"' || ch === "'") { i = skipString(css, i); continue; }
      if (ch === '(' || ch === '[') depth++;
      else if (ch === ')' || ch === ']') depth = Math.max(0, depth - 1);
      else if (depth === 0 && (ch === '{' || ch === ';' || ch === '}')) {
        end = i;
        kind = ch;
        break;
      }
    }
    if (end === -1) break;
    const prelude = css.slice(preludeStart, end).trim();
    const start = offset + preludeStart;
    if (kind === '}') { i = end + 1; continue; }
    if (kind === ';') {
      if (prelude.startsWith('@')) {
        const name = prelude.slice(1).split(/[\s(]/)[0].toLowerCase();
        nodes.push({ type: 'at', name, prelude: prelude.slice(name.length + 1).trim(), start });
      }
      i = end + 1;
      continue;
    }
    const close = Math.min(matchBrace(css, end), to);
    const bodyFrom = end + 1;
    const body = css.slice(bodyFrom, close);
    if (prelude.startsWith('@')) {
      const name = prelude.slice(1).split(/[\s({]/)[0].toLowerCase();
      const rest = prelude.slice(name.length + 1).trim();
      if (GROUP_AT_RULES.has(name)) {
        nodes.push({ type: 'at', name, prelude: rest, start, children: parseBlock(css, bodyFrom, close, offset) });
      } else {
        nodes.push({ type: 'at', name, prelude: rest, start, decls: parseDeclarations(body, offset + bodyFrom) });
      }
    } else {
      nodes.push({ type: 'rule', selector: prelude, start, decls: parseDeclarations(body, offset + bodyFrom) });
    }
    i = close + 1;
  }
  return nodes;
}

export function selectorList(selector) {
  return splitTopLevel(selector, ',').map((p) => p.part.trim()).filter(Boolean);
}

// Walk rules, reporting the chain of enclosing at-rules for each one.
export function* walkRules(nodes, parents = []) {
  for (const node of nodes) {
    if (node.type === 'rule') yield { rule: node, parents };
    else if (node.children) yield* walkRules(node.children, [...parents, node]);
  }
}

export function isDarkSchemeMedia(node) {
  return node.type === 'at' && node.name === 'media' && /prefers-color-scheme\s*:\s*dark/i.test(node.prelude);
}

// Theme-attribute selectors, tolerant of quoting and spacing.
export const LIGHT_GUARD_RE = /:not\(\s*\[\s*data-theme\s*=\s*(["']?)light\1\s*\]\s*\)/i;
export const DARK_ATTR_RE = /\[\s*data-theme\s*=\s*(["']?)dark\1\s*\]/i;

// True when the selector only matches under an explicit dark choice, that
// is [data-theme="dark"] appears outside any :not(...).
export function isExplicitDark(selector) {
  return DARK_ATTR_RE.test(selector.replace(/:not\((?:[^()]|\([^()]*\))*\)/g, ''));
}

// ---------------------------------------------------------------------------
// A site's other color theme
// ---------------------------------------------------------------------------
//
// A site with a light and a dark theme writes both into one stylesheet:
// `:root{--accent:#3135c9}` and later `:root[data-theme="dark"]{--accent:#7a7ef0}`.
// Read as one flat list, the later write wins and the evidence describes
// the theme nobody sees by default (Markloop's periwinkle, Cursor's
// near-black). splitThemeCss() removes the other theme's rules so the
// evidence reads the default one.

const THEME_ATTR_NAME = String.raw`[\w-]*(?:theme|mode|scheme|appearance|color)[\w-]*`;
const themeAttrRe = (v) => new RegExp(String.raw`\[\s*${THEME_ATTR_NAME}\s*[~|^$*]?=\s*["']?${v}["']?\s*(?:[is]\s*)?\]`, 'i');
// [data-dark], [data-origin-dark]: a flag attribute that names the theme
const flagAttrRe = (v) => new RegExp(String.raw`\[\s*data-[\w-]*\b${v}\b[\w-]*\s*\]`, 'i');
// .dark, html.dark, :where(.dark, .dark *), .theme-dark at the start of a
// selector or inside a functional pseudo-class; never .dark\:bg-x (an
// escaped Tailwind class) or .card-dark (a component variant).
const rootClassRe = (v) =>
  new RegExp(String.raw`(?:^|[(,])\s*(?:html|:root|body)?\.(?:${v}|theme-${v}|${v}-mode|${v}-theme|is-${v})(?![\w\\-])`, 'i');
const SCOPE_RES = {
  dark: [themeAttrRe('dark'), flagAttrRe('dark'), rootClassRe('dark')],
  light: [themeAttrRe('light'), flagAttrRe('light'), rootClassRe('light')],
};
const schemeMediaRe = (v) => new RegExp(String.raw`prefers-color-scheme\s*:\s*${v}`, 'i');

// True when `selector` only matches under the `scheme` theme ("dark" or
// "light"); :not(...) guards are ignored.
export function selectorInTheme(selector, scheme) {
  const bare = selector.replace(/:not\((?:[^()]|\([^()]*\))*\)/g, '');
  return SCOPE_RES[scheme].some((re) => re.test(bare));
}

// The stylesheet as the default theme renders it. `scheme` is the theme
// the page opens in ("light" unless the markup says otherwise). Drops
// @media (prefers-color-scheme: <other>) blocks, rules whose every selector
// is scoped to the other theme (a mixed selector list keeps its other
// selectors), and resolves light-dark(a, b). Returns { css, other } where
// `other` lists how the other theme was written ('media', 'selector',
// 'light-dark'), empty when the site has one theme.
export function splitThemeCss(source, scheme = 'light') {
  const otherScheme = scheme === 'dark' ? 'light' : 'dark';
  const css = blankComments(source);
  const other = new Set();
  const mediaRe = schemeMediaRe(otherScheme);

  const walk = (from, to) => {
    let out = '';
    let i = from;
    while (i < to) {
      const stmtStart = i;
      let depth = 0;
      let end = -1;
      let kind = null;
      for (; i < to; i++) {
        const ch = css[i];
        if (ch === '"' || ch === "'") { i = skipString(css, i); continue; }
        if (ch === '(' || ch === '[') depth++;
        else if (ch === ')' || ch === ']') depth = Math.max(0, depth - 1);
        else if (depth === 0 && (ch === '{' || ch === ';' || ch === '}')) { end = i; kind = ch; break; }
      }
      if (end === -1) { out += css.slice(stmtStart, to); break; }
      if (kind !== '{') { out += css.slice(stmtStart, end + 1); i = end + 1; continue; }
      const close = Math.min(matchBrace(css, end), to);
      const prelude = css.slice(stmtStart, end);
      const head = prelude.trim();
      i = close + 1;
      if (head.startsWith('@')) {
        const name = head.slice(1).split(/[\s({]/)[0].toLowerCase();
        if (name === 'media' && mediaRe.test(head)) { other.add('media'); continue; }
        if (GROUP_AT_RULES.has(name) && !name.endsWith('keyframes')) {
          out += `${prelude}{${walk(end + 1, close)}}`;
        } else {
          out += css.slice(stmtStart, close + 1);
        }
        continue;
      }
      const sels = selectorList(head);
      const keep = sels.filter((s) => !selectorInTheme(s, otherScheme));
      if (!keep.length) { other.add('selector'); continue; }
      const sel = keep.length === sels.length ? prelude : `${prelude.match(/^\s*/)[0]}${keep.join(',')}`;
      if (keep.length !== sels.length) other.add('selector');
      out += `${sel}{${css.slice(end + 1, close)}}`;
    }
    return out;
  };

  let out = walk(0, css.length);
  const pick = scheme === 'dark' ? 2 : 1;
  out = out.replace(/light-dark\(\s*((?:[^,()]|\([^()]*\))+?)\s*,\s*((?:[^,()]|\([^()]*\))+?)\s*\)/gi, (...m) => {
    other.add('light-dark');
    return m[pick];
  });
  return { css: out, other: [...other] };
}

// The theme a page opens in, from its markup: data-theme="dark" (or
// data-mode / data-color-scheme / data-bs-theme), a `dark` class or
// color-scheme: dark on <html> or <body>, or <meta name="color-scheme"
// content="dark"> without "light". Anything else is "light".
export function defaultColorScheme(html) {
  const tags = [html.match(/<html\b[^>]*>/i)?.[0], html.match(/<body\b[^>]*>/i)?.[0]].filter(Boolean);
  for (const tag of tags) {
    if (new RegExp(String.raw`\s${THEME_ATTR_NAME}\s*=\s*["']?dark\b`, 'i').test(tag)) return 'dark';
    const cls = tag.match(/\sclass\s*=\s*["']([^"']*)["']/i)?.[1] || '';
    if (/(?:^|\s)(?:dark|theme-dark|dark-mode|dark-theme)(?:\s|$)/i.test(cls)) return 'dark';
    if (/style\s*=\s*["'][^"']*color-scheme\s*:\s*dark\b/i.test(tag)) return 'dark';
  }
  const meta = html.match(/<meta\b[^>]*name\s*=\s*["']color-scheme["'][^>]*>/i)?.[0];
  const content = meta?.match(/content\s*=\s*["']([^"']*)["']/i)?.[1] || '';
  if (/\bdark\b/i.test(content) && !/\blight\b/i.test(content)) return 'dark';
  return 'light';
}

// Replace var(--x[, fallback]) using `lookup(name)`. Returns null when a
// reference cannot be resolved and carries no fallback.
export function resolveVars(value, lookup, depth = 0) {
  if (value == null) return null;
  if (depth > 12) return null;
  let out = '';
  let i = 0;
  while (i < value.length) {
    const at = value.indexOf('var(', i);
    if (at === -1) { out += value.slice(i); break; }
    out += value.slice(i, at);
    let d = 0;
    let j = at + 3;
    for (; j < value.length; j++) {
      if (value[j] === '(') d++;
      else if (value[j] === ')') { d--; if (d === 0) break; }
    }
    if (j >= value.length) return null;
    const inner = value.slice(at + 4, j);
    const comma = splitTopLevel(inner, ',');
    const name = comma[0].part.trim();
    const fallback = comma.length > 1 ? inner.slice(comma[1].start).trim() : null;
    const found = lookup(name);
    let resolved = null;
    if (found != null) resolved = resolveVars(found, lookup, depth + 1);
    if (resolved == null && fallback != null) resolved = resolveVars(fallback, lookup, depth + 1);
    if (resolved == null) return null;
    out += resolved;
    i = j + 1;
  }
  return out.trim();
}

export const toRgb = converter('rgb');

const COLOR_FUNCTION_RE = /^(?:rgba?|hsla?|hwb|lab|lch|oklab|oklch|color)\(/i;

// A value that is one color and nothing else: hex, a color function, or a
// named color. Returns a culori color or null.
export function readColor(value) {
  if (!value) return null;
  const v = value.trim();
  if (!v || /^(?:inherit|initial|unset|revert|currentcolor|none)$/i.test(v)) return null;
  if (!(v.startsWith('#') || COLOR_FUNCTION_RE.test(v) || /^[a-z]+$/i.test(v))) return null;
  try {
    const c = parseColor(v);
    return c || null;
  } catch {
    return null;
  }
}

// The single color carried by a `background` shorthand, or null when the
// background is an image, a gradient, or not one readable color.
export function backgroundColor(value) {
  if (!value) return null;
  if (/gradient\(|url\(|image\(|image-set\(/i.test(value)) return null;
  const whole = readColor(value);
  if (whole) return whole;
  const colors = splitTopLevel(value.replace(/\s+/g, ' '), ' ')
    .map((p) => readColor(p.part))
    .filter(Boolean);
  return colors.length === 1 ? colors[0] : null;
}

export function alphaOf(color) {
  return color && typeof color.alpha === 'number' ? color.alpha : 1;
}

// WCAG ratio of `fg` drawn on `bg`. A translucent foreground is composited
// over the background first; the background itself is taken as opaque.
export function contrastRatio(fg, bg) {
  const b = toRgb({ ...bg, alpha: 1 });
  let f = toRgb(fg);
  const a = alphaOf(f);
  if (a < 1) {
    f = { mode: 'rgb', r: f.r * a + b.r * (1 - a), g: f.g * a + b.g * (1 - a), b: f.b * a + b.b * (1 - a) };
  } else {
    f = { ...f, alpha: 1 };
  }
  return wcagContrast(f, b);
}

// 1-based line number for an absolute offset.
export function lineIndex(text) {
  const starts = [0];
  for (let i = 0; i < text.length; i++) if (text[i] === '\n') starts.push(i + 1);
  return (offset) => {
    let lo = 0;
    let hi = starts.length - 1;
    while (lo < hi) {
      const mid = (lo + hi + 1) >> 1;
      if (starts[mid] <= offset) lo = mid;
      else hi = mid - 1;
    }
    return lo + 1;
  };
}
