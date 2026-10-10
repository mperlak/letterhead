#!/usr/bin/env node
// Builds the skills-only package for OpenAI's plugin directory. A
// repository utility: it lives outside letterhead/, so sync-mounts.sh never
// ships it with the skill. Run from any cwd:
//   node dev-scripts/openai/build-openai.mjs
import { cpSync, mkdirSync, readFileSync, writeFileSync, readdirSync, lstatSync, rmSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const source = join(root, 'letterhead');
const out = join(root, 'temp', 'openai-submission');
const stage = join(out, 'package');
const zipPath = join(out, 'letterhead-openai.zip');
const manifest = JSON.parse(readFileSync(join(root, '.codex-plugin/plugin.json'), 'utf8'));
const fail = (message) => { throw new Error(message); };
const check = (ok, message) => { if (!ok) fail(message); };
const run = (command, args, cwd) => {
  const r = spawnSync(command, args, { cwd, encoding: 'utf8' });
  check(!r.error && r.status === 0, `${command} failed: ${r.error?.message || r.stderr || r.stdout}`);
  return r.stdout;
};
function files(dir) {
  return readdirSync(dir).sort().flatMap((name) => {
    const path = join(dir, name);
    const stat = lstatSync(path);
    check(!stat.isSymbolicLink(), `Symlink is not allowed in submission: ${path}`);
    return stat.isDirectory() ? files(path) : [path];
  });
}
function textField(value, limit, name) {
  check(typeof value === 'string' && value.trim().length > 0 && [...value].length <= limit,
    `${name} must be nonempty text of at most ${limit} characters`);
}
function httpsURL(value, name) {
  const url = new URL(value);
  check(url.protocol === 'https:' && !url.username && !url.password, `${name} must be an HTTPS URL without credentials`);
}
textField(manifest.name, 64, 'name');
check(/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(manifest.name), 'Invalid package name');
check(/^\d+\.\d+\.\d+$/.test(manifest.version), 'Use a release semver');
const versions = [
  /\nversion: ([^\n]+)/.exec(readFileSync(join(source, 'SKILL.md'), 'utf8'))?.[1],
  ...['.claude-plugin', '.cursor-plugin'].map((host) => JSON.parse(readFileSync(join(root, 'plugin', host, 'plugin.json'), 'utf8')).version),
];
check(versions.every((v) => v === manifest.version), 'Release versions differ');
textField(manifest.description, 4000, 'description');
textField(manifest.author?.name, 120, 'author.name');
const listing = manifest.interface;
for (const [key, limit] of Object.entries({ displayName: 30, shortDescription: 30, longDescription: 4000, developerName: 80 })) {
  textField(listing?.[key], limit, `interface.${key}`);
}
textField(listing.category, 120, 'category');
check(Array.isArray(listing.capabilities) && listing.capabilities.length <= 20, 'Invalid capabilities');
listing.capabilities.forEach((v) => textField(v, 120, 'capability'));
for (const key of ['websiteURL', 'supportURL', 'privacyPolicyURL', 'termsOfServiceURL']) {
  textField(listing[key], 1024, key);
  httpsURL(listing[key], key);
}
check(Array.isArray(listing.defaultPrompt) && listing.defaultPrompt.length <= 3, 'Use up to three starter prompts');
listing.defaultPrompt.forEach((v) => { textField(v, 128, 'starter prompt'); check(!/@/.test(v), 'Starter prompts must omit app mentions'); });
check(!('screenshots' in listing) && !('apps' in manifest) && !('mcpServers' in manifest) && !('hooks' in manifest), 'Skills-only submission cannot include screenshots, app references, MCP configuration or hooks');
run('bash', [join(root, 'bin/sync-mounts.sh'), '--check'], root);

// Rebuild only this dedicated generated package; leave other submission assets alone.
rmSync(stage, { recursive: true, force: true });
mkdirSync(join(stage, '.codex-plugin'), { recursive: true });
mkdirSync(join(stage, 'assets'), { recursive: true });
cpSync(source, join(stage, 'skills/letterhead'), {
  recursive: true,
  filter: (path) => !['.DS_Store', 'node_modules', '.git'].includes(path.split('/').at(-1)),
});
cpSync(join(source, 'assets/icon.png'), join(stage, 'assets/icon.png'));
for (const key of ['composerIcon', 'composerIconDark', 'logo', 'logoDark']) listing[key] = './assets/icon.png';
manifest.skills = './skills/';
writeFileSync(join(stage, '.codex-plugin/plugin.json'), `${JSON.stringify(manifest, null, 2)}\n`);
cpSync(join(root, 'LICENSE'), join(stage, 'LICENSE'));
for (const [src, dst] of [['privacy.md', 'PRIVACY.md'], ['terms.md', 'TERMS.md']]) cpSync(join(root, 'docs', src), join(stage, dst));
writeFileSync(join(stage, 'README.md'), `# letterhead\n\n${listing.longDescription}\n\nSupport: ${listing.supportURL}\n\nPrivacy: ${listing.privacyPolicyURL}\n\nUse and licenses: ${listing.termsOfServiceURL}\n`);
const png = readFileSync(join(stage, 'assets/icon.png'));
check(png.subarray(0, 8).toString('hex') === '89504e470d0a1a0a', 'Icon must be a PNG');
check(png.readUInt32BE(16) === 512 && png.readUInt32BE(20) === 512, 'Use a 512 by 512 icon');
const packaged = files(stage);
for (const path of packaged) {
  const name = relative(stage, path);
  check(lstatSync(path).size < 5 * 1024 * 1024, `Oversized file: ${name}`);
  check(!/(^|\/)(\.env(?:\..*)?|\.app\.json|\.mcp\.json|hooks\.json|id_rsa|id_ed25519)$/.test(name), `Private or unsupported file: ${name}`);
  if (path.endsWith('.mjs') || path.endsWith('.js')) run(process.execPath, ['--check', path], stage);
}
// A real fixture and every shipped token set must work at their packaged paths.
const skill = join(stage, 'skills/letterhead');
const tokenPaths = readdirSync(join(skill, 'styles')).map((style) => join(skill, 'styles', style, 'tokens.css'));
const tokensResult = run(process.execPath, [join(skill, 'scripts/check-tokens.mjs'), ...tokenPaths], stage);
const fixturePaths = readdirSync(join(skill, 'fixtures')).filter((f) => f.endsWith('.html')).map((f) => join(skill, 'fixtures', f));
check(fixturePaths.length > 0, 'No document fixtures to verify');
const documentsResult = run(process.execPath, [join(skill, 'scripts/check-document.mjs'), ...fixturePaths], stage);
rmSync(zipPath, { force: true });
run('zip', ['-qr', '-X', zipPath, '.'], stage);
run('unzip', ['-tq', zipPath], out);
const report = {
  version: manifest.version,
  checkedAt: new Date().toISOString(),
  files: packaged.length,
  zipBytes: lstatSync(zipPath).size,
  sha256: createHash('sha256').update(readFileSync(zipPath)).digest('hex'),
  localChecks: ['listing lengths and URLs', 'matching release versions', 'mirror consistency', 'icon PNG dimensions', 'file sizes and unsupported files', 'all packaged JavaScript syntax', 'all style token sets', 'document fixtures at packaged paths', 'ZIP integrity'],
  pending: ['Publish privacy and terms URLs with the repository changes', 'Verify developer identity and dashboard category', 'Test activation and workflows in a clean plugin-enabled host', 'Pass OpenAI scans and human review'],
};
writeFileSync(join(out, 'validation.json'), `${JSON.stringify(report, null, 2)}\n`);
writeFileSync(join(out, 'checks.txt'), `${tokensResult}\n${documentsResult}`);
console.log(JSON.stringify({ zip: zipPath, ...report }, null, 2));
