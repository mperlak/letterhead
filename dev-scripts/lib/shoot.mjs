// Shared screenshot helpers for dev-scripts/screenshots.mjs and contact-sheet.mjs.
//
// Drives Playwright's cached chrome-headless-shell (or $CHROME) over the
// DevTools protocol, so one browser serves every capture and we can wait for
// document.fonts.ready before taking the picture. Google Chrome with
// --headless=new hangs on some machines; the headless shell does not.
// No npm dependencies: Node's global WebSocket, fetch-free, plus the cwebp
// binary for the final encode.

import { spawn, spawnSync } from 'node:child_process';
import { readdirSync, writeFileSync, statSync, mkdirSync, mkdtempSync, rmSync } from 'node:fs';
import { homedir, tmpdir } from 'node:os';
import { join } from 'node:path';

export function findChrome() {
  if (process.env.CHROME) return process.env.CHROME;
  const base = join(homedir(), 'Library', 'Caches', 'ms-playwright');
  let dirs = [];
  try { dirs = readdirSync(base).filter((d) => d.startsWith('chromium_headless_shell-')).sort(); } catch {}
  for (const d of dirs.reverse()) {
    const inner = readdirSync(join(base, d)).find((x) => x.startsWith('chrome-headless-shell-'));
    if (inner) return join(base, d, inner, 'chrome-headless-shell');
  }
  throw new Error('No chrome-headless-shell found in ~/Library/Caches/ms-playwright; set CHROME=/path/to/chrome-headless-shell');
}

export function requireCwebp() {
  if (spawnSync('cwebp', ['-version']).error) throw new Error('cwebp not found on PATH');
}

export function makeWorkDir(prefix = 'letterhead-shots') {
  return mkdtempSync(join(process.env.TMPDIR || tmpdir(), `${prefix}.`));
}

export function rmWorkDir(dir) {
  rmSync(dir, { recursive: true, force: true });
}

/** Launch the browser; returns { shoot, close }. */
export async function launchBrowser() {
  const chrome = findChrome();
  const userDir = makeWorkDir('letterhead-chrome');
  const proc = spawn(chrome, [
    '--remote-debugging-port=0', '--disable-gpu', '--hide-scrollbars', '--no-first-run',
    '--allow-file-access-from-files', `--user-data-dir=${userDir}`, 'about:blank',
  ], { stdio: ['ignore', 'ignore', 'pipe'] });

  const wsUrl = await new Promise((resolve, reject) => {
    let buf = '';
    const timer = setTimeout(() => reject(new Error('browser did not start')), 20000);
    proc.stderr.on('data', (d) => {
      buf += d;
      const m = buf.match(/DevTools listening on (ws:\/\/\S+)/);
      if (m) { clearTimeout(timer); resolve(m[1]); }
    });
    proc.on('exit', () => reject(new Error('browser exited early')));
  });

  const ws = new WebSocket(wsUrl);
  await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
  let id = 0;
  const pending = new Map();
  const listeners = [];
  ws.onmessage = (ev) => {
    const msg = JSON.parse(ev.data);
    if (msg.id && pending.has(msg.id)) {
      const { resolve, reject } = pending.get(msg.id);
      pending.delete(msg.id);
      msg.error ? reject(new Error(`${msg.error.message}`)) : resolve(msg.result);
    } else if (msg.method) {
      for (const l of listeners) l(msg);
    }
  };
  const send = (method, params = {}, sessionId) => new Promise((resolve, reject) => {
    const mid = ++id;
    pending.set(mid, { resolve, reject });
    ws.send(JSON.stringify({ id: mid, method, params, ...(sessionId ? { sessionId } : {}) }));
  });

  /**
   * Capture the top-left width x height CSS px of `url`, device scale `scale`.
   * theme: 'light' | 'dark' (emulated prefers-color-scheme). Returns a PNG Buffer.
   */
  async function shoot(url, { width, height, scale = 2, theme = 'light', mobile = false }) {
    const { targetId } = await send('Target.createTarget', { url: 'about:blank' });
    const { sessionId } = await send('Target.attachToTarget', { targetId, flatten: true });
    const s = (m, p) => send(m, p, sessionId);
    try {
      await s('Page.enable');
      await s('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: scale, mobile });
      await s('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-color-scheme', value: theme }] });
      const loaded = new Promise((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error(`load timeout: ${url}`)), 30000);
        const l = (msg) => {
          if (msg.sessionId === sessionId && msg.method === 'Page.loadEventFired') {
            clearTimeout(timer); listeners.splice(listeners.indexOf(l), 1); resolve();
          }
        };
        listeners.push(l);
      });
      await s('Page.navigate', { url });
      await loaded;
      // Webfonts + two frames so layout and transitions settle.
      await s('Runtime.evaluate', {
        expression: `document.fonts.ready.then(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(() => setTimeout(r, 150)))))`,
        awaitPromise: true,
      });
      const { data } = await s('Page.captureScreenshot', {
        format: 'png',
        clip: { x: 0, y: 0, width, height, scale: 1 },
        captureBeyondViewport: false,
      });
      return Buffer.from(data, 'base64');
    } finally {
      await send('Target.closeTarget', { targetId }).catch(() => {});
    }
  }

  /** Open `url`, wait for fonts, evaluate a JS expression in the page and return its value. */
  async function evaluate(url, expression) {
    const { targetId } = await send('Target.createTarget', { url });
    const { sessionId } = await send('Target.attachToTarget', { targetId, flatten: true });
    try {
      await new Promise((r) => setTimeout(r, 400));
      const res = await send('Runtime.evaluate', {
        expression: `document.fonts.ready.then(() => (${expression}))`, awaitPromise: true, returnByValue: true,
      }, sessionId);
      return res.result.value;
    } finally {
      await send('Target.closeTarget', { targetId }).catch(() => {});
    }
  }

  async function close() {
    try { ws.close(); } catch {}
    proc.kill();
    rmWorkDir(userDir);
  }
  return { shoot, evaluate, send, close };
}

/**
 * Encode a PNG buffer to webp, stepping quality down until it fits maxKB
 * (never below minQ). Returns { bytes, quality }.
 */
export function encodeWebp(png, outPath, { quality = 82, maxKB = 150, minQ = 40, workDir }) {
  const tmp = join(workDir, `enc-${process.pid}-${Math.random().toString(36).slice(2)}.png`);
  writeFileSync(tmp, png);
  let q = quality;
  for (;;) {
    const r = spawnSync('cwebp', ['-quiet', '-q', String(q), '-m', '6', '-sharp_yuv', tmp, '-o', outPath]);
    if (r.status !== 0) throw new Error(`cwebp failed: ${r.stderr}`);
    const bytes = statSync(outPath).size;
    if (bytes <= maxKB * 1024 || q <= minQ) { rmSync(tmp, { force: true }); return { bytes, quality: q }; }
    q -= 6;
  }
}

export { mkdirSync };
