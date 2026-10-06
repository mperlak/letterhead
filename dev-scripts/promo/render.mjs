#!/usr/bin/env node
// Render the README demo film (stage.html) and teaser (teaser.html), frame by frame.
//
//   node dev-scripts/promo/render.mjs                      # examples/video/letterhead-demo.mp4
//   node dev-scripts/promo/render.mjs --teaser             # examples/video/letterhead-teaser.webp
//   node dev-scripts/promo/render.mjs --stills 4,12,20     # PNGs of single moments (add --teaser for the teaser)
//   node dev-scripts/promo/render.mjs --from 30 --to 40 --out /tmp/part.mp4
//   node dev-scripts/promo/render.mjs --poster 1.5         # a still with a play badge, as WebP
//
// Serves the repo root over http (the stage's iframes must be same-origin),
// drives chrome-headless-shell through lib/shoot.mjs and calls window.seek(t)
// for every frame. The film pipes PNGs into ffmpeg (H.264, yuv420p,
// faststart); the teaser goes through img2webp (from the webp package, next
// to cwebp) as a looping animated WebP.

import { createServer } from 'node:http';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { spawn, spawnSync } from 'node:child_process';
import { join, extname, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { launchBrowser } from '../lib/shoot.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const args = process.argv.slice(2);
const opt = (name, dflt) => { const i = args.indexOf(`--${name}`); return i >= 0 ? args[i + 1] : dflt; };
const TEASER = args.includes('--teaser');
const PAGE = TEASER ? 'teaser.html' : 'stage.html';
const [W, H] = TEASER ? [960, 600] : [1280, 720];
const FPS = Number(opt('fps', TEASER ? 15 : 30));
const SCALE = Number(opt('scale', TEASER ? 1 : 1.5));   // the stage: 1280x720 -> 1920x1080
const OUT = resolve(opt('out', join(ROOT, TEASER ? 'examples/video/letterhead-teaser.webp' : 'examples/video/letterhead-demo.mp4')));
const STILLS = opt('stills', null);
const POSTER = opt('poster', null);

const TYPES = { '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript', '.mjs': 'text/javascript', '.svg': 'image/svg+xml', '.webp': 'image/webp', '.png': 'image/png', '.woff2': 'font/woff2', '.json': 'application/json' };
const server = createServer(async (req, res) => {
  const p = join(ROOT, decodeURIComponent(new URL(req.url, 'http://x').pathname));
  if (!p.startsWith(ROOT)) { res.writeHead(403).end(); return; }
  try { res.writeHead(200, { 'content-type': TYPES[extname(p)] || 'application/octet-stream' }).end(await readFile(p)); }
  catch { res.writeHead(404).end(); }
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const base = `http://127.0.0.1:${server.address().port}`;

const browser = await launchBrowser();
const { send } = browser;
const { targetId } = await send('Target.createTarget', { url: 'about:blank' });
const { sessionId } = await send('Target.attachToTarget', { targetId, flatten: true });
const s = (m, p) => send(m, p, sessionId);
const evalIn = async (expression) => (await s('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true })).result.value;

try {
  await s('Page.enable');
  await s('Emulation.setDeviceMetricsOverride', { width: W, height: H, deviceScaleFactor: SCALE, mobile: false });
  await s('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-color-scheme', value: 'light' }] });
  // the teaser names the film's length, read from the rendered film
  let query = '';
  if (TEASER) {
    const r = spawnSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', join(ROOT, 'examples/video/letterhead-demo.mp4')]);
    if (r.status === 0) query = `?demo=${Math.round(Number(String(r.stdout).trim()))}`;
  }
  await s('Page.navigate', { url: `${base}/dev-scripts/promo/${PAGE}${query}` });
  for (let i = 0; !(await evalIn('!!window.ready').catch(() => false)); i++) {
    if (i > 100) throw new Error('stage did not load');
    await new Promise((r) => setTimeout(r, 100));
  }
  await evalIn('window.ready');
  const duration = await evalIn('window.DURATION');

  const grab = async (t) => {
    await evalIn(`(window.seek(${t}), new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))))`);
    const { data } = await s('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
    return Buffer.from(data, 'base64');
  };

  if (POSTER) {
    await evalIn('window.poster(true)');
    const png = join(ROOT, 'temp', 'promo-poster.png');
    await mkdir(dirname(png), { recursive: true });
    await writeFile(png, await grab(Number(POSTER)));
    const webp = opt('out', join(ROOT, 'examples/video/letterhead-demo-poster.webp'));
    const r = spawnSync('cwebp', ['-quiet', '-q', '82', '-m', '6', '-sharp_yuv', png, '-o', webp]);
    if (r.status !== 0) throw new Error(`cwebp failed: ${r.stderr}`);
    console.log(webp);
  } else if (STILLS) {
    const dir = resolve(opt('dir', join(ROOT, 'temp/promo-stills')));
    await mkdir(dir, { recursive: true });
    for (const t of STILLS.split(',').map(Number)) {
      const f = join(dir, `t${String(t).padStart(5, '0')}.png`);
      await writeFile(f, await grab(t));
      console.log(f);
    }
  } else if (TEASER) {
    const dir = join(ROOT, 'temp/promo-teaser');
    await mkdir(dir, { recursive: true });
    const n = Math.round(duration * FPS), files = [];
    for (let i = 0; i < n; i++) {
      const f = join(dir, `f${String(i).padStart(4, '0')}.png`);
      await writeFile(f, await grab(i / FPS));
      files.push(f);
    }
    await mkdir(dirname(OUT), { recursive: true });
    const r = spawnSync('img2webp', ['-loop', '0', '-m', '6', '-d', String(Math.round(1000 / FPS)), '-lossy', '-q', opt('q', '72'), ...files, '-o', OUT]);
    if (r.status !== 0) throw new Error(`img2webp failed: ${r.stderr}`);
    console.log(OUT);
  } else {
    const from = Number(opt('from', 0)), to = Math.min(Number(opt('to', duration)), duration);
    await mkdir(dirname(OUT), { recursive: true });
    const ff = spawn('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'image2pipe', '-framerate', String(FPS), '-i', '-',
      '-c:v', 'libx264', '-preset', 'slow', '-crf', '20', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', OUT],
      { stdio: ['pipe', 'inherit', 'inherit'] });
    const done = new Promise((res, rej) => ff.on('exit', (c) => (c === 0 ? res() : rej(new Error(`ffmpeg exited ${c}`)))));
    const n = Math.round((to - from) * FPS);
    for (let i = 0; i < n; i++) {
      const png = await grab(from + i / FPS);
      if (!ff.stdin.write(png)) await new Promise((r) => ff.stdin.once('drain', r));
      if (i % FPS === 0) process.stdout.write(`\r${(i / FPS).toFixed(0)}s / ${(n / FPS).toFixed(0)}s`);
    }
    ff.stdin.end();
    await done;
    console.log(`\n${OUT}`);
  }
} finally {
  await browser.close().catch(() => {});
  server.close();
}
