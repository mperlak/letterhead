/* templates/report/report.js: the report's small script. Every state is
 * already in the HTML; this script only toggles [hidden], aria state and
 * the open state of the contents list, and positions the chart tooltip. It
 * never writes text into the document (the tooltip's words come from the
 * point's aria-label through CSS attr()) and never moves an element, so a
 * comment anchored to any state finds it again. It runs in a sandboxed
 * frame: no storage, no network. apply-template.mjs puts it into the
 * document. */
(function () {
  'use strict';
  var doc = document;
  var all = function (sel, root) { return Array.prototype.slice.call((root || doc).querySelectorAll(sel)); };
  var reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // Buttons drawn in SVG are <g role="button">: Enter and Space work like a click.
  function onActivate(el, fn) {
    el.addEventListener('click', fn);
    if (el.tagName !== 'BUTTON') {
      el.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); fn(); }
      });
    }
  }

  /* ---- contents: open as a rail on wide screens, folded on phones; the
     current section is the last heading above the reading line ---- */
  all('nav.contents').forEach(function (nav) {
    var details = nav.querySelector('details');
    var wide = window.matchMedia('(min-width: 1100px)');
    var userOpened = false;
    if (details) {
      var sync = function () { if (wide.matches) details.open = true; else if (!userOpened) details.open = false; };
      details.querySelector('summary') && details.querySelector('summary').addEventListener('click', function () { userOpened = !details.open; });
      if (wide.addEventListener) wide.addEventListener('change', sync); else if (wide.addListener) wide.addListener(sync);
      sync();
    }
    var links = all('a[href^="#"]', nav);
    var heads = links.map(function (a) { return doc.getElementById(decodeURIComponent(a.getAttribute('href').slice(1))); });
    var ticking = false;
    function mark() {
      ticking = false;
      var line = window.innerHeight * 0.3, idx = 0;
      heads.forEach(function (h, i) { if (h && h.getBoundingClientRect().top <= line) idx = i; });
      links.forEach(function (a, i) { if (i === idx) a.setAttribute('aria-current', 'true'); else a.removeAttribute('aria-current'); });
    }
    window.addEventListener('scroll', function () { if (!ticking) { ticking = true; window.requestAnimationFrame(mark); } }, { passive: true });
    mark();
  });

  /* ---- stepper: one body open at a time; optional prev / next / play.
     Play runs only on request and never with reduced motion ---- */
  all('ol.stepper').forEach(function (list) {
    var buttons = all(':scope > li > .step[aria-controls]', list);
    if (!buttons.length) return;
    var bodies = buttons.map(function (b) { return doc.getElementById(b.getAttribute('aria-controls')); });
    var cur = Math.max(0, buttons.findIndex(function (b) { return b.getAttribute('aria-expanded') === 'true'; }));
    var timer = null;
    var ctl = list.previousElementSibling && list.previousElementSibling.classList.contains('stepper-ctl') ? list.previousElementSibling : null;
    var play = ctl && ctl.querySelector('[data-stepper="play"]');
    function render() {
      buttons.forEach(function (b, i) {
        b.setAttribute('aria-expanded', i === cur ? 'true' : 'false');
        if (bodies[i]) bodies[i].hidden = i !== cur;
      });
    }
    function stop() {
      if (!timer) return;
      clearInterval(timer);
      timer = null;
      if (play) play.setAttribute('aria-pressed', 'false');
    }
    buttons.forEach(function (b, i) { b.addEventListener('click', function () { stop(); cur = i; render(); }); });
    if (ctl) {
      ctl.hidden = false;
      var prev = ctl.querySelector('[data-stepper="prev"]');
      var next = ctl.querySelector('[data-stepper="next"]');
      if (prev) prev.addEventListener('click', function () { stop(); cur = Math.max(cur - 1, 0); render(); });
      if (next) next.addEventListener('click', function () { stop(); cur = Math.min(cur + 1, buttons.length - 1); render(); });
      if (play) {
        if (reduceMotion) play.hidden = true;
        play.setAttribute('aria-pressed', 'false');
        play.addEventListener('click', function () {
          if (timer) { stop(); return; }
          if (cur === buttons.length - 1) cur = 0;
          render();
          play.setAttribute('aria-pressed', 'true');
          var ms = Number(list.getAttribute('data-interval')) || 4500;
          timer = setInterval(function () {
            if (cur >= buttons.length - 1) { stop(); return; }
            cur++;
            render();
          }, ms);
        });
      }
    }
    render();
  });

  /* ---- explorer: a part shows its description; every element that names
     the same part (the SVG and its HTML twin) shows the pressed state ---- */
  all('.explorer').forEach(function (root) {
    var parts = all('[data-part]', root);
    var details = all('[data-for-part]', root);
    if (!parts.length || !details.length) return;
    function show(key) {
      details.forEach(function (d) { d.hidden = d.getAttribute('data-for-part') !== key; });
      parts.forEach(function (p) { p.setAttribute('aria-pressed', p.getAttribute('data-part') === key ? 'true' : 'false'); });
    }
    parts.forEach(function (p) { onActivate(p, function () { show(p.getAttribute('data-part')); }); });
    var first = parts.filter(function (p) { return p.getAttribute('aria-pressed') === 'true'; })[0];
    show(first ? first.getAttribute('data-part') : details[0].getAttribute('data-for-part'));
  });

  /* ---- chart tooltip: the same data is in the table next to the chart ---- */
  all('.chart').forEach(function (wrap) {
    var tip = wrap.querySelector('.tip');
    var svg = wrap.querySelector('svg');
    if (!tip || !svg) return;
    tip.hidden = true;
    var vb = svg.viewBox && svg.viewBox.baseVal;
    function showTip(c) {
      var r = svg.getBoundingClientRect(), w = wrap.getBoundingClientRect();
      var k = vb && vb.width ? r.width / vb.width : 1;
      tip.setAttribute('data-label', c.getAttribute('aria-label') || '');
      tip.style.left = (r.left - w.left + Number(c.getAttribute('cx')) * k) + 'px';
      tip.style.top = (r.top - w.top + Number(c.getAttribute('cy')) * k) + 'px';
      tip.hidden = false;
    }
    function hideTip() { tip.hidden = true; }
    all('.hit', svg).forEach(function (c) {
      ['mouseenter', 'focus', 'click'].forEach(function (ev) { c.addEventListener(ev, function () { showTip(c); }); });
      ['mouseleave', 'blur'].forEach(function (ev) { c.addEventListener(ev, hideTip); });
    });
  });

  /* ---- print: folded detail opens so it prints in full, then folds back ---- */
  var opened = [];
  window.addEventListener('beforeprint', function () {
    opened = all('details:not([open])').filter(function (d) { return !d.closest('nav.contents'); });
    opened.forEach(function (d) { d.open = true; });
  });
  window.addEventListener('afterprint', function () {
    opened.forEach(function (d) { d.open = false; });
    opened = [];
  });
})();
