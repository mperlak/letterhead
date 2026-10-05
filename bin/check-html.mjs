#!/usr/bin/env node
// Tag-closure check for HTML files (fixtures and generated examples).
// A deliberately simple stack parser: catches unclosed / mismatched tags,
// which is the failure mode that breaks rendering in review tools.
//
// Usage: node bin/check-html.mjs <file.html> [...more]
// Exit:  0 clean · 1 findings or unreadable input

import { readFileSync } from 'node:fs';

const VOID = new Set([
  'area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input',
  'link', 'meta', 'param', 'source', 'track', 'wbr',
]);

function check(path) {
  const html = readFileSync(path, 'utf8');
  const errors = [];
  const stack = [];
  // Strip content that legally contains raw "<" without being markup.
  const stripped = html
    .replace(/<!--[\s\S]*?-->/g, (m) => m.replace(/</g, ' '))
    .replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1>/gi, (m) => {
      const open = m.match(/^<[^>]*>/)[0];
      const close = m.match(/<\/(script|style)>$/i)[0];
      return open + m.slice(open.length, m.length - close.length).replace(/</g, ' ') + close;
    });
  const tagRe = /<\/?([a-zA-Z][a-zA-Z0-9-]*)((?:"[^"]*"|'[^']*'|[^>"'])*)>/g;
  let m;
  while ((m = tagRe.exec(stripped)) !== null) {
    const raw = m[0];
    const name = m[1].toLowerCase();
    const line = stripped.slice(0, m.index).split('\n').length;
    if (raw.startsWith('</')) {
      if (VOID.has(name)) continue;
      const at = stack.lastIndexOf(name);
      if (at === -1) {
        errors.push(`${path}:${line} closing </${name}> with no open <${name}>`);
      } else {
        for (let i = stack.length - 1; i > at; i--) {
          errors.push(`${path}:${line} <${stack[i]}> left open when </${name}> closed`);
        }
        stack.length = at;
      }
    } else if (!raw.endsWith('/>') && !VOID.has(name)) {
      stack.push(name);
    }
  }
  for (const name of stack) errors.push(`${path}: <${name}> never closed`);
  return errors;
}

const files = process.argv.slice(2);
if (files.length === 0) {
  console.error('usage: node bin/check-html.mjs <file.html> [...more]');
  process.exit(1);
}
let failed = false;
for (const f of files) {
  try {
    const errors = check(f);
    if (errors.length) {
      failed = true;
      for (const e of errors) console.error(`  ✗ ${e}`);
    } else {
      console.log(`  ✓ ${f}`);
    }
  } catch (e) {
    failed = true;
    console.error(`  ✗ ${f}: ${e.message}`);
  }
}
process.exit(failed ? 1 : 0);
