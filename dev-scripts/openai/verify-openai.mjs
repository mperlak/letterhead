#!/usr/bin/env node
// Verify the actual ZIP in an isolated workspace; no production services.
import { mkdtempSync, mkdirSync, cpSync, writeFileSync, readFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { spawnSync } from 'node:child_process';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const out = join(root, 'temp/openai-submission');
const work = mkdtempSync(join(tmpdir(), 'letterhead-openai-'));
const unpacked = join(work, 'unpacked');
mkdirSync(unpacked);
function run(command, args, extra = {}) {
  const result = spawnSync(command, args, { cwd: work, encoding: 'utf8', ...extra });
  assert.equal(result.error, undefined, result.error?.message);
  assert.equal(result.status, 0, `${command} ${args.join(' ')}\n${result.stdout}\n${result.stderr}`);
  return result.stdout;
}
run('unzip', ['-q', join(out, 'letterhead-openai.zip'), '-d', unpacked]);
const skill = join(unpacked, 'skills/letterhead');
const networkLog = join(work, 'network-attempts.txt');
const guard = join(work, 'offline-guard.mjs');
writeFileSync(guard, `import { appendFileSync } from 'node:fs';\nglobalThis.fetch = async () => { appendFileSync(${JSON.stringify(networkLog)}, 'unexpected fetch\\n'); throw new Error('Network disabled for offline package verification'); };\n`);
const env = { ...process.env, NODE_OPTIONS: `${process.env.NODE_OPTIONS || ''} --import=${pathToFileURL(guard).href}` };
const script = (name, args) => run(process.execPath, [join(skill, 'scripts', name), ...args], { env });
const site = join(work, 'brand.html');
writeFileSync(site, '<!doctype html><html lang="en"><head><title>Example Studio</title><style>body{color:#222;background:#fff;font-family:Arial,sans-serif}a{color:#245c42}h1{font-family:Arial,sans-serif;font-weight:700}</style></head><body><h1>Example Studio</h1><p>Design for everyday work.</p><a href="#about">About</a></body></html>');
script('brand-evidence.mjs', [site, '--summary']);
const profile = join(work, 'profile');
cpSync(join(root, 'dev-scripts/fixtures/brand-sheet/en'), profile, { recursive: true });
script('brand-tokens.mjs', ['--style', join(skill, 'styles/corporate/tokens.css'), '--primary', '#3B6FE0', '--font-body', 'Roboto, sans-serif', '--font-heading', 'Roboto, sans-serif', '--embed-fonts', '--lang', 'en', '--font-file', `Roboto=${join(root, 'dev-scripts/fixtures/brand-tokens/roboto-variable-subset.woff2')}`, '--out', join(profile, 'tokens.css')]);
script('brand-sheet.mjs', [profile]);
const document = join(work, 'document.html');
const body = readFileSync(join(root, 'dev-scripts/matrix-bodies/status-update.html'), 'utf8');
writeFileSync(document, `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Order Sync Status Update</title><meta property="og:title" content="Order Sync Status Update"><meta property="og:description" content="Status update for the integration team."></head><body><main class="doc">${body}</main></body></html>`);
const headingIDs = (html) => [...html.matchAll(/<h[23]\b[^>]*\bid=["']([^"']+)/g)].map((m) => m[1]);
const ids = headingIDs(readFileSync(document, 'utf8'));
assert.ok(ids.length > 0);
script('apply-tokens.mjs', [profile, document, '--style', 'engineering']);
script('check-document.mjs', [document]);
assert.deepEqual(headingIDs(readFileSync(document, 'utf8')), ids);
script('apply-tokens.mjs', [profile, document, '--style', 'engineering']);
script('check-document.mjs', [document]);
assert.deepEqual(headingIDs(readFileSync(document, 'utf8')), ids);
assert.ok(!existsSync(networkLog), 'Offline workflows attempted a network request');
const report = {
  checkedAt: new Date().toISOString(),
  zipSha256: createHash('sha256').update(readFileSync(join(out, 'letterhead-openai.zip'))).digest('hex'),
  workspace: work,
  passed: ['actual ZIP extraction', 'brand evidence from local HTML', 'font embedding from supplied local file', 'brand sheet generation', 'brand application and document check', 'repeated style application preserves heading IDs', 'no fetch attempts in offline workflows'],
  pending: ['live host activation and instruction-following evaluation', 'visual inspection in both themes and phone width', 'OpenAI scan and review'],
};
writeFileSync(join(out, 'integration.json'), `${JSON.stringify(report, null, 2)}\n`);
console.log(JSON.stringify(report, null, 2));
