/* templates/content-kit/content-kit.js: the copy buttons of a content kit.
 * Every word is already in the HTML: the texts, the counters (written by
 * scripts/count-copy.mjs), the button labels and the feedback words
 * (data-done, data-fail on the button; .copy-status for a screen reader).
 * This script only shows the buttons, copies, and toggles attributes that
 * the CSS turns into feedback. It never writes text into the document and
 * never moves an element, so a comment anchored to a quote finds it again.
 * It runs in a frame with sandbox="allow-scripts" and no allow-same-origin:
 * the first way to copy is the copy event (allowed there during a click),
 * the Clipboard API is the second. No storage, no network.
 * apply-template.mjs puts it into the document. */
(function () {
  'use strict';
  var doc = document;
  var all = function (sel, root) { return Array.prototype.slice.call((root || doc).querySelectorAll(sel)); };
  var status = doc.querySelector('.copy-status');

  // The text as published: what the <pre> shows, without trailing blank lines.
  function textOf(block) {
    var pre = block.querySelector('pre');
    return pre ? pre.textContent.replace(/\r\n?/g, '\n').replace(/\s+$/, '') : '';
  }

  function esc(s) { return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }

  // Formatted copy of an article body (templates/content-kit/template.md,
  // Copy blocks): blocks split on empty lines; one short line with no closing
  // punctuation is a heading; "- " lines a list, "1. " lines a numbered list;
  // the rest paragraphs, with single line breaks kept.
  function toHtml(text) {
    return text.split(/\n[ \t]*\n+/).map(function (block) {
      block = block.replace(/^\s*\n/, '').replace(/\s+$/, '');
      if (!block) return '';
      var lines = block.split('\n');
      var every = function (re) { return lines.every(function (l) { return re.test(l); }); };
      var items = function (re) { return lines.map(function (l) { return '<li>' + esc(l.replace(re, '')) + '</li>'; }).join(''); };
      if (every(/^- /)) return '<ul>' + items(/^- /) + '</ul>';
      if (every(/^\d+[.)] /)) return '<ol>' + items(/^\d+[.)] /) + '</ol>';
      if (lines.length === 1 && block.length < 80 && !/[.,:;!…]$/.test(block)) return '<h2>' + esc(block) + '</h2>';
      return '<p>' + lines.map(esc).join('<br>') + '</p>';
    }).join('\n');
  }

  // Select the text in the <pre>: the copy command needs a selection in some
  // browsers, and when copying fails the reader finds it selected.
  function select(block) {
    var pre = block.querySelector('pre');
    var sel = window.getSelection && window.getSelection();
    if (!pre || !sel) return;
    var range = doc.createRange();
    range.selectNodeContents(pre);
    sel.removeAllRanges();
    sel.addRange(range);
  }

  // First way: the copy event, which sets exactly our text (and the HTML
  // for a formatted copy). Synchronous, inside the click.
  function viaCopyEvent(block, plain, html) {
    var done = false;
    var onCopy = function (e) {
      if (!e.clipboardData) return;
      e.clipboardData.setData('text/plain', plain);
      if (html) e.clipboardData.setData('text/html', html);
      e.preventDefault();
      done = true;
    };
    var sel = window.getSelection && window.getSelection();
    select(block);
    doc.addEventListener('copy', onCopy, true);
    try { done = doc.execCommand('copy') && done; } catch (err) { done = false; }
    doc.removeEventListener('copy', onCopy, true);
    if (done && sel) sel.removeAllRanges();
    return done;
  }

  // Second way: the Clipboard API (formatted when the browser can, plain
  // text otherwise). Resolves true or false, never throws.
  function viaClipboard(plain, html) {
    var cb = navigator.clipboard;
    if (!cb) return Promise.resolve(false);
    var plainOnly = function () { return cb.writeText ? cb.writeText(plain).then(function () { return true; }) : Promise.resolve(false); };
    var attempt;
    try {
      if (html && cb.write && typeof window.ClipboardItem === 'function') {
        attempt = cb.write([new window.ClipboardItem({
          'text/html': new Blob([html], { type: 'text/html' }),
          'text/plain': new Blob([plain], { type: 'text/plain' }),
        })]).then(function () { return true; }, plainOnly);
      } else {
        attempt = plainOnly();
      }
    } catch (err) {
      return Promise.resolve(false);
    }
    return attempt.then(null, function () { return false; });
  }

  function show(btn, state) {
    btn.setAttribute('data-state', state);
    if (status) {
      status.removeAttribute('data-state');
      window.setTimeout(function () { status.setAttribute('data-state', state); }, 30);
    }
    window.clearTimeout(btn.__kitTimer);
    btn.__kitTimer = window.setTimeout(function () {
      btn.removeAttribute('data-state');
      if (status) status.removeAttribute('data-state');
    }, state === 'ok' ? 1800 : 4000);
  }

  all('.copy').forEach(function (block) {
    all('.copy-btn', block).forEach(function (btn) {
      btn.hidden = false;
      btn.addEventListener('click', function () {
        var plain = textOf(block);
        var html = btn.getAttribute('data-as') === 'rich' ? toHtml(plain) : null;
        if (viaCopyEvent(block, plain, html)) { show(btn, 'ok'); return; }
        viaClipboard(plain, html).then(function (ok) {
          if (ok) {
            var sel = window.getSelection && window.getSelection();
            if (sel) sel.removeAllRanges();
            show(btn, 'ok');
          } else {
            select(block);
            show(btn, 'fail');
          }
        });
      });
    });
  });

  /* ---- print: folded detail opens so it prints in full, then folds back ---- */
  var opened = [];
  window.addEventListener('beforeprint', function () {
    opened = all('details:not([open])');
    opened.forEach(function (d) { d.open = true; });
  });
  window.addEventListener('afterprint', function () {
    opened.forEach(function (d) { d.open = false; });
    opened = [];
  });
})();
