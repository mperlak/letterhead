// The rendering half of check-document.mjs (--render): opens the document in
// a headless Chromium over the DevTools protocol and looks for what the HTML
// alone does not show. No npm dependencies: Node's global WebSocket (Node 22
// and later) and a browser already on the machine ($CHROME, Playwright's
// cached browsers, Chrome, Chromium or Edge).
//
// What it reports, each as a warning unless marked:
//   render/text-from-script   the script writes words the HTML does not have
//   render/text-on-click      a click adds or removes words (comment anchors
//                             count quote occurrences across the whole text)
//   render/dom-moves          a click moves or adds elements
//   render/heading-outline    the outline after the script skips a level
//   render/horizontal-scroll  ERROR: the page scrolls sideways at 1280 or 390 px
//   render/print-dark         print with a dark system theme comes out dark
//   render/print-hidden       states toggled by [hidden] stay hidden in print
//   render/console-error      the page throws or logs an error
// and render/unavailable (info) when it cannot run at all.

import { spawn } from 'node:child_process';
import { existsSync, readdirSync, mkdtempSync, rmSync } from 'node:fs';
import { homedir, tmpdir } from 'node:os';
import { join, delimiter } from 'node:path';
import { pathToFileURL } from 'node:url';

function playwrightBrowsers() {
  const bases = [process.env.PLAYWRIGHT_BROWSERS_PATH, join(homedir(), 'Library', 'Caches', 'ms-playwright'), join(homedir(), '.cache', 'ms-playwright')].filter(Boolean);
  const found = [];
  for (const base of bases) {
    let dirs = [];
    try { dirs = readdirSync(base).sort().reverse(); } catch { continue; }
    for (const d of dirs) {
      if (d.startsWith('chromium_headless_shell-')) {
        for (const inner of safeList(join(base, d))) found.push(join(base, d, inner, 'chrome-headless-shell'), join(base, d, inner, 'headless_shell'));
      } else if (/^chromium-\d+$/.test(d)) {
        for (const inner of safeList(join(base, d))) {
          found.push(join(base, d, inner, 'Google Chrome for Testing.app', 'Contents', 'MacOS', 'Google Chrome for Testing'),
            join(base, d, inner, 'Chromium.app', 'Contents', 'MacOS', 'Chromium'), join(base, d, inner, 'chrome'));
        }
      }
    }
  }
  return found;
}

function safeList(dir) {
  try { return readdirSync(dir); } catch { return []; }
}

export function findBrowser() {
  if (process.env.CHROME) return existsSync(process.env.CHROME) ? process.env.CHROME : null;
  const candidates = [
    ...playwrightBrowsers(),
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/Applications/Chromium.app/Contents/MacOS/Chromium',
    '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
    ...(process.env.PATH || '').split(delimiter).flatMap((p) => ['google-chrome', 'google-chrome-stable', 'chromium', 'chromium-browser', 'microsoft-edge'].map((n) => join(p, n))),
  ];
  return candidates.find((c) => c && existsSync(c)) || null;
}

async function launch(exe) {
  const userDir = mkdtempSync(join(process.env.TMPDIR || tmpdir(), 'letterhead-render-'));
  const proc = spawn(exe, ['--headless', '--remote-debugging-port=0', '--disable-gpu', '--hide-scrollbars', '--no-first-run',
    '--no-default-browser-check', `--user-data-dir=${userDir}`, 'about:blank'], { stdio: ['ignore', 'ignore', 'pipe'] });
  const wsUrl = await new Promise((resolve, reject) => {
    let buf = '';
    const timer = setTimeout(() => reject(new Error('the browser did not start within 20 s')), 20000);
    proc.stderr.on('data', (d) => {
      buf += d;
      const m = buf.match(/DevTools listening on (ws:\/\/\S+)/);
      if (m) { clearTimeout(timer); resolve(m[1]); }
    });
    proc.on('exit', () => { clearTimeout(timer); reject(new Error('the browser exited at start')); });
  });
  const ws = new WebSocket(wsUrl);
  await new Promise((res, rej) => { ws.onopen = res; ws.onerror = () => rej(new Error('cannot connect to the browser')); });
  let id = 0;
  const pending = new Map();
  const listeners = new Set();
  ws.onmessage = (ev) => {
    const msg = JSON.parse(ev.data);
    if (msg.id && pending.has(msg.id)) {
      const { resolve, reject } = pending.get(msg.id);
      pending.delete(msg.id);
      if (msg.error) reject(new Error(msg.error.message)); else resolve(msg.result);
    } else if (msg.method) for (const l of listeners) l(msg);
  };
  const send = (method, params = {}, sessionId) => new Promise((resolve, reject) => {
    const mid = ++id;
    pending.set(mid, { resolve, reject });
    ws.send(JSON.stringify({ id: mid, method, params, ...(sessionId ? { sessionId } : {}) }));
  });
  const close = () => {
    try { ws.close(); } catch {}
    proc.kill();
    rmSync(userDir, { recursive: true, force: true });
  };
  return { send, listeners, close };
}

// In-page helpers, as one source string: the document's words (scripts,
// styles and short live regions such as "Step 2 of 10" left out), its
// element shape, and the controls a reader can click.
const PAGE_HELPERS = `
  window.__lhText = function (withoutControls) {
    var c = document.body.cloneNode(true);
    if (withoutControls) c.querySelectorAll('button, [role="button"]').forEach(function (n) { n.remove(); });
    c.querySelectorAll('script, style, template, noscript').forEach(function (n) { n.remove(); });
    c.querySelectorAll('[aria-live], [role="status"], [role="timer"]').forEach(function (n) { if (n.textContent.trim().length <= 80) n.remove(); });
    return c.textContent.replace(/\\s+/g, ' ').trim();
  };
  window.__lhShape = function () {
    return Array.prototype.map.call(document.body.querySelectorAll('*'), function (e) { return e.tagName; }).join(',');
  };
  window.__lhControls = function () {
    return Array.prototype.filter.call(document.querySelectorAll('button, [role="button"], summary, [data-part]'), function (el) {
      return !el.closest('a') && el.getClientRects().length > 0;
    });
  };
`;

const norm = (s) => s.replace(/\s+/g, ' ').trim();

// file: the document; staticText: its body text from the HTML (scripts and
// styles left out). Returns findings in check-document's shape.
export async function renderChecks(file, staticText) {
  const out = [];
  const add = (severity, rule, message) => out.push({ severity, rule, line: null, locator: 'render', message });
  if (typeof WebSocket !== 'function') {
    add('info', 'render/unavailable', `--render needs Node 22 or later (this is ${process.version}); the static checks ran.`);
    return out;
  }
  const exe = findBrowser();
  if (!exe) {
    add('info', 'render/unavailable', 'No Chromium-family browser found (set CHROME=/path/to/chrome); the static checks ran.');
    return out;
  }
  let browser;
  try {
    browser = await launch(exe);
  } catch (e) {
    add('info', 'render/unavailable', `${e.message}; the static checks ran.`);
    return out;
  }
  const { send, listeners, close } = browser;
  const url = pathToFileURL(file).href;
  const errors = new Set();
  try {
    const open = async (width, height, media) => {
      const { targetId } = await send('Target.createTarget', { url: 'about:blank' });
      const { sessionId } = await send('Target.attachToTarget', { targetId, flatten: true });
      const s = (m, p) => send(m, p, sessionId);
      const onMsg = (msg) => {
        if (msg.sessionId !== sessionId) return;
        if (msg.method === 'Runtime.exceptionThrown') errors.add(msg.params.exceptionDetails?.exception?.description?.split('\n')[0] || msg.params.exceptionDetails?.text || 'exception');
        if (msg.method === 'Runtime.consoleAPICalled' && msg.params.type === 'error') errors.add((msg.params.args || []).map((a) => a.value ?? a.description ?? '').join(' ').slice(0, 160));
      };
      listeners.add(onMsg);
      await s('Page.enable');
      await s('Runtime.enable');
      await s('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: width < 600 });
      if (media) await s('Emulation.setEmulatedMedia', media);
      const loaded = new Promise((resolve) => {
        const timer = setTimeout(resolve, 30000);
        const l = (msg) => { if (msg.sessionId === sessionId && msg.method === 'Page.loadEventFired') { clearTimeout(timer); listeners.delete(l); resolve(); } };
        listeners.add(l);
      });
      await s('Page.navigate', { url });
      await loaded;
      const evaluate = async (expression) => (await s('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true })).result.value;
      await evaluate(`document.fonts.ready.then(() => new Promise((r) => requestAnimationFrame(() => setTimeout(r, 150))))`);
      await evaluate(PAGE_HELPERS);
      const closeTab = async () => { listeners.delete(onMsg); await send('Target.closeTarget', { targetId }).catch(() => {}); };
      return { s, evaluate, closeTab };
    };

    // Wide screen: words written by the script, clicks, outline.
    {
      const tab = await open(1280, 900);
      const rendered = await tab.evaluate('window.__lhText()');
      if (staticText != null && rendered !== norm(staticText)) {
        const extra = rendered.length - norm(staticText).length;
        add('warning', 'render/text-from-script', `After the script runs the page has ${Math.abs(extra)} characters ${extra >= 0 ? 'more' : 'fewer'} than the HTML. Text a reviewer can comment on belongs in the HTML; the script only shows and hides it.`);
      }
      const result = await tab.evaluate(`(async function () {
        var wait = function () { return new Promise(function (r) { setTimeout(r, 60); }); };
        var before = window.__lhText(), shape = window.__lhShape(), changed = [], moved = [];
        var controls = window.__lhControls();
        for (var i = 0; i < controls.length; i++) {
          var el = controls[i];
          var name = (el.getAttribute('aria-label') || el.textContent || el.tagName).replace(/\\s+/g, ' ').trim().slice(0, 40);
          // A control's own label (Play / Pause) may change; the document's words may not.
          var t0 = window.__lhText(true), s0 = window.__lhShape();
          el.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, view: window }));
          await wait();
          if (window.__lhText(true) !== t0) changed.push(name);
          if (window.__lhShape() !== s0) moved.push(name);
        }
        var heads = Array.prototype.map.call(document.querySelectorAll('h1, h2, h3, h4, h5, h6'), function (h) { return { level: +h.tagName[1], text: h.textContent.trim().slice(0, 50) }; });
        var skips = [];
        for (var j = 1; j < heads.length; j++) if (heads[j].level > heads[j - 1].level + 1) skips.push('h' + heads[j - 1].level + ' to h' + heads[j].level + ' ("' + heads[j].text + '")');
        return { clicked: controls.length, changed: changed, moved: moved, textAfter: window.__lhText() !== before, shapeAfter: window.__lhShape() !== shape, skips: skips };
      })()`);
      if (result.changed.length) add('warning', 'render/text-on-click', `${result.changed.length} of ${result.clicked} controls change the document's words when clicked (${result.changed.slice(0, 4).map((n) => `"${n}"`).join(', ')}). Put every state in the HTML and toggle [hidden]: a comment anchored by a quote counts its occurrences across the whole text.`);
      if (result.moved.length) add('warning', 'render/dom-moves', `${result.moved.length} control(s) add or move elements when clicked (${result.moved.slice(0, 4).map((n) => `"${n}"`).join(', ')}). Keep every element where the HTML put it; a comment anchored by position loses its place.`);
      if (result.skips.length) add('warning', 'render/heading-outline', `After the script runs, the outline skips a level: ${result.skips.slice(0, 3).join('; ')}.`);
      await tab.closeTab();
    }

    // Sideways scroll on a wide screen and a phone.
    for (const [w, h] of [[1280, 900], [390, 844]]) {
      const tab = await open(w, h);
      const [sw, cw] = await tab.evaluate('[document.documentElement.scrollWidth, document.documentElement.clientWidth]');
      if (sw > cw + 1) add('error', 'render/horizontal-scroll', `At ${w} px the page is ${sw} px wide and scrolls sideways. On a phone the reader pans left and right to read a line. Find the element that is wider than the screen (a no-wrap chip or a long URL or identifier) and let it wrap, or put a wide table in .table-wrap.`);
      await tab.closeTab();
    }

    // Print with a dark system theme.
    {
      const tab = await open(1280, 900, { media: 'print', features: [{ name: 'prefers-color-scheme', value: 'dark' }] });
      const p = await tab.evaluate(`(function () {
        var probe = document.createElement('canvas').getContext('2d');
        var lum = function (c) { probe.fillStyle = '#000'; probe.fillStyle = c; probe.fillRect(0, 0, 1, 1); var d = probe.getImageData(0, 0, 1, 1).data; return (0.2126 * d[0] + 0.7152 * d[1] + 0.0722 * d[2]) / 255; };
        var bg = getComputedStyle(document.body).backgroundColor;
        if (/rgba\\(0, 0, 0, 0\\)|transparent/.test(bg)) bg = getComputedStyle(document.documentElement).backgroundColor;
        // States the script toggles ([hidden]) that print would leave out.
        var hidden = Array.prototype.filter.call(document.querySelectorAll('body [hidden]'), function (e) {
          return e.textContent.trim().length > 20 && getComputedStyle(e).display === 'none' && !e.closest('nav, script, style, template, [aria-hidden="true"]');
        });
        return { bg: bg, dark: /rgba\\(0, 0, 0, 0\\)|transparent/.test(bg) ? false : lum(bg) < 0.5, hidden: hidden.length };
      })()`);
      if (p.dark) add('warning', 'render/print-dark', `Printed with a dark system theme the page is dark (${p.bg}). Paper is light: re-set the colors under @media print (apply-tokens.mjs writes that block).`);
      if (p.hidden) add('warning', 'render/print-hidden', `${p.hidden} block(s) with text stay hidden in print. Print shows every state; a reader on paper cannot click.`);
      await tab.closeTab();
    }
  } catch (e) {
    add('info', 'render/unavailable', `rendering stopped: ${e.message}`);
  } finally {
    close();
  }
  if (errors.size) add('warning', 'render/console-error', `The page reports ${errors.size} error(s): ${[...errors].slice(0, 3).join(' | ')}.`);
  return out;
}
