#!/usr/bin/env node
// Smoke test for letterhead/scripts/brand-evidence.mjs.
//
// Runs the script against offline synthetic fixtures (no network) and
// asserts the handful of behaviors the teach spec calls out by name: vendor
// CSS-variable flags (including the Tailwind-style rescue when a vendor-only
// variable is also used directly on >=3 brand surfaces), the >12:1 "strip"
// flag, background-image logo candidates ranked above stripped ones,
// body-font resolution through a plain `body { font-family }` rule, Google
// Fonts detection, heading/display font-weight collection (including the
// base vs. contextual split), PNG/SVG whiteOnTransparent logo detection,
// page.bodyTextColor, and sourced, text-only page.nameForms.
//
// wp-presets / tailwind-dark cover the 2026-09-25 fidelity fixes: WP brand
// presets and Elementor globals are not vendor, --fupi-* / admin-bar /
// cookie-banner colors are; icon fonts are flagged and kept out of faces;
// heading and body fonts and heading weights resolve through the classes
// the page puts on h1/h2/<body>; inherit and ua-default fallbacks; font
// sources; dark sites; SVG-only and off-page colors; unnamed logos in a
// home link; entity decoding and code rejection in name forms.
//
// names-and-logo covers the 2026-09-25 round 2: a legal form is cut off
// into legalName, a bare domain is not offered as a name next to a real
// one, and a logo candidate reports its saturated colors.
//
// The 2026-09-28 round adds colors[].logoDistance, --summary, --out and
// --save-logo (extension from the bytes, inline SVG saved as a file).
//
// next-image covers URLs read from attributes: entities decoded (`&amp;`),
// image-optimizer URLs (Next.js, Vercel, Cloudflare) resolved to the
// original file with optimizedUrl beside it, the largest srcset candidate
// only when there is no optimizer, and --save-logo saving the original.
//
// Usage: node dev-scripts/brand-evidence-smoke.mjs
// Exit codes: 0 all assertions passed, 1 a script run or assertion failed.

import { spawnSync } from 'node:child_process';
import { readFileSync, existsSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SCRIPT = join(ROOT, 'letterhead', 'scripts', 'brand-evidence.mjs');
const FIXTURES = join(ROOT, 'dev-scripts', 'fixtures', 'brand-evidence');

let failures = 0;

function check(label, cond) {
  if (cond) {
    console.log(`  ok - ${label}`);
  } else {
    console.log(`  FAIL - ${label}`);
    failures++;
  }
}

function runOn(fixture) {
  const res = spawnSync(process.execPath, [SCRIPT, join(FIXTURES, fixture)], { encoding: 'utf8' });
  if (res.status !== 0) {
    console.log(`  FAIL - script exited ${res.status} for ${fixture}`);
    console.log(res.stderr);
    failures++;
    return null;
  }
  try {
    return JSON.parse(res.stdout).sites[0];
  } catch (e) {
    console.log(`  FAIL - could not parse JSON output for ${fixture}: ${e.message}`);
    console.log(res.stdout);
    failures++;
    return null;
  }
}

function findCandidate(list, source) {
  return list.find((c) => c.source === source);
}

console.log('fixture: wordpress-vendor.html');
{
  const site = runOn('wordpress-vendor.html');
  if (site) {
    check('no fatal error', site.error === null);

    const byHex = Object.fromEntries(site.colors.map((c) => [c.hex, c]));
    check('gf- prefixed variable is flagged vendor', byHex['#204ce5']?.vendor === true);
    check('stk- prefixed variable is flagged vendor', byHex['#f00069']?.vendor === true);
    check('cky prefixed variable is flagged vendor', byHex['#123456']?.vendor === true);
    check('named --primary-color is NOT flagged vendor', byHex['#ffaf00']?.vendor === false);

    const bg = site.logo.find((l) => l.kind === 'background' && (l.url || '').endsWith('arkona-logo.png'));
    const strip = site.logo.find((l) => (l.url || '').endsWith('logotypy_ver_2-4.jpg'));
    check('background-image logo candidate found in header', !!bg && bg.location === 'header');
    check('background logo candidate is not flagged strip', bg?.strip === false);
    check('13000x30 image candidate is flagged strip (>12:1)', strip?.strip === true);
    check(
      'background candidate ranks above the strip candidate',
      !!bg && !!strip && site.logo.indexOf(bg) < site.logo.indexOf(strip)
    );
    check('.jpg strip candidate is whiteOnTransparent: false (no alpha channel)', strip?.whiteOnTransparent === false);

    const whiteLogo = site.logo.find((l) => (l.url || '').endsWith('white-logo.png'));
    check('synthetic white-on-transparent PNG is detected as whiteOnTransparent: true', whiteLogo?.whiteOnTransparent === true);

    check('body font resolves to Roboto from the body rule', site.fonts.bodyRule?.family === 'Roboto');
    check('h1/h2 font-weight 700 collected into fonts.weights.h1', site.fonts.weights.h1.includes(700));
    check('h1/h2 font-weight 700 collected into fonts.weights.h2', site.fonts.weights.h2.includes(700));
    check('body has no font-weight declared -> fonts.weights.body is null', site.fonts.weights.body === null);
    check(
      'fonts.weights.base.h1 excludes the .page-header h1 contextual 300, keeps the bare h1,h2 700',
      site.fonts.weights.base.h1.includes(700) && !site.fonts.weights.base.h1.includes(300)
    );
    check('fonts.weights.contextual.h1 carries the .page-header h1 300', site.fonts.weights.contextual.h1.includes(300));

    check(
      'page.bodyTextColor resolves the later body{color:#414042} rule, not the earlier #333333',
      site.page.bodyTextColor?.value === '#414042' && site.page.bodyTextColor?.source === 'body'
    );
    check('the bodyTextColor hex also carries a "text" context in colors[]', byHex['#414042']?.contexts.includes('text'));

    const names = site.page.nameForms;
    check('nameForms carries og:site_name with source', findCandidate(names, 'og:site_name')?.value === 'Acme Corp');
    check('nameForms carries the footer copyright name, distinct from og:site_name', findCandidate(names, 'footer')?.value === 'Acme Corporation');
    check(
      'nameForms carries title-prefix ("ACME | Industrial Components" -> "ACME")',
      findCandidate(names, 'title-prefix')?.value === 'ACME'
    );
    check('nameForms carries logo alt text with source', findCandidate(names, 'logo-alt')?.value === 'Acme mark');
    check('nameForms does NOT carry the strip/partner-bar alt ("partner logos")', !names.some((c) => c.value === 'partner logos'));
  } else {
    failures += 18;
  }
}

console.log('fixture: tailwind-like.html');
{
  const site = runOn('tailwind-like.html');
  if (site) {
    check('no fatal error', site.error === null);

    const byHex = Object.fromEntries(site.colors.map((c) => [c.hex, c]));
    check('tw- prefixed variable with no brand-surface usage is flagged vendor', byHex['#ff00ff']?.vendor === true);
    check(
      'tw- prefixed variable used directly on button/nav/header is rescued (vendor: false)',
      byHex['#0fb36c']?.vendor === false
    );
    check(
      'rescued color lists its vendor variable separately in vendorVariables',
      Array.isArray(byHex['#0fb36c']?.vendorVariables) && byHex['#0fb36c'].vendorVariables.includes('--tw-ring-color')
    );

    check('Inter is detected as a Google Font', site.fonts.googleFonts.includes('Inter'));
    check('body font-weight 400 resolves into fonts.weights.body', site.fonts.weights.body === 400);
    check('.hero font-weight 300 resolves into fonts.weights.display', site.fonts.weights.display.includes(300));

    const svgLogo = site.logo.find((l) => l.kind === 'svg-inline');
    check('inline header <svg> is a logo candidate', svgLogo?.location === 'header');
    check('inline <svg> with a non-white fill is whiteOnTransparent: false', svgLogo?.whiteOnTransparent === false);
  } else {
    failures += 8;
  }
}

console.log('fixture: wp-presets.html');
{
  const site = runOn('wp-presets.html');
  if (site) {
    check('no fatal error', site.error === null);

    const byHex = Object.fromEntries(site.colors.map((c) => [c.hex, c]));
    check('--wp--preset--color--primary is NOT vendor (theme palette carries the brand)', byHex['#e20c7b']?.vendor === false);
    check('--wp--preset--color--primary-hover is NOT vendor', byHex['#830747']?.vendor === false);
    check('--wp--preset--color--vivid-red (core default swatch) stays vendor', byHex['#cf2e2e']?.vendor === true);
    check('--fupi-* (WP Full Picture) is vendor', byHex['#249dc1']?.vendor === true);
    check('--e-global-color-accent (Elementor global) is NOT vendor', byHex['#ff3535']?.vendor === false);
    check(
      '#wpadminbar-only colors are vendor by selector',
      byHex['#72aee6']?.vendor === true &&
        byHex['#72aee6']?.vendorReason === 'selector' &&
        byHex['#2c3338']?.vendor === true
    );
    check('cookie-banner-only color is vendor by selector', byHex['#1e73be']?.vendor === true);
    check('wp preset primary carries the button context from its rule', byHex['#e20c7b']?.contexts.includes('button'));

    const fonts = site.fonts;
    check('icon fonts are left out of fonts.faces', !fonts.faces.includes('dashicons') && fonts.faces.includes('Poppins'));
    check(
      'icon fonts are listed in fonts.iconFaces',
      fonts.iconFaces.includes('dashicons') && fonts.iconFaces.includes('Font Awesome 5 Free')
    );
    const fa = fonts.families.find((f) => f.family === 'Font Awesome 5 Free');
    const poppins = fonts.families.find((f) => f.family === 'Poppins');
    check('families[] marks Font Awesome icon: true', fa?.icon === true);
    check('an icon family ranks below text families even when more frequent', fonts.families.indexOf(poppins) < fonts.families.indexOf(fa));
    check('a face served from fonts.gstatic.com has fontSource google-fonts', poppins?.fontSource === 'google-fonts');
    check(
      'headingRule "inherit" resolves to the body family (origin inherit-body)',
      fonts.headingRule?.origin === 'inherit-body' && fonts.headingRule?.family === fonts.bodyRule?.family
    );
    check(
      'no declared heading weight -> weights.resolved.h1 is 700 from ua-default',
      fonts.weights.resolved.h1.value === 700 && fonts.weights.resolved.h1.source === 'ua-default'
    );

    check(
      'bodyTextColor comes from body, not from a block `p` rule',
      site.page.bodyTextColor?.value === '#222222' && site.page.bodyTextColor?.source === 'body'
    );
    check('pageBackground comes from body', site.page.pageBackground?.value === '#ffffff');
    check('a light page is not siteIsDark', site.page.siteIsDark === false);

    const names = site.page.nameForms;
    check(
      'double-encoded og:site_name is decoded ("&amp;#174; &amp;#8211;" -> "® –")',
      findCandidate(names, 'og:site_name')?.value === 'Mroomy® – pokoje dla dzieci'
    );
    check('logo alt entities are decoded', findCandidate(names, 'logo-alt')?.value === 'Mroomy® – pokoje');
    check('a copyright name over 60 characters is dropped', !findCandidate(names, 'footer'));
    check('a copyright line inside <script> is never read', !names.some((c) => c.value.includes('Script Corp')));

    const logo = site.logo[0];
    check('logo in <a href="/"> is flagged homeLink and ranks first', !!logo && logo.homeLink === true && (logo.url || '').endsWith('arkona-logo.png'));
  } else {
    failures += 23;
  }
}

console.log('fixture: tailwind-dark.html');
{
  const site = runOn('tailwind-dark.html');
  if (site) {
    check('no fatal error', site.error === null);

    const fonts = site.fonts;
    check(
      'heading font resolves through the class on h1/h2 (.font-heading -> Clash Grotesk)',
      fonts.headingRule?.family === 'Clash Grotesk' && fonts.headingRule?.origin === 'class' && fonts.headingRule?.selector === '.font-heading'
    );
    check('Fontshare family is tagged fontSource fontshare', fonts.headingRule?.fontSource === 'fontshare');
    check(
      'body font resolves through the class on <body> (.font-body -> Montserrat, google-fonts)',
      fonts.bodyRule?.family === 'Montserrat' && fonts.bodyRule?.origin === 'body-class' && fonts.bodyRule?.fontSource === 'google-fonts'
    );
    check(
      'h1 weight resolves through its class (.medium -> 500)',
      fonts.weights.resolved.h1.value === 500 && fonts.weights.resolved.h1.source === 'class'
    );
    check('h2 weight resolves through its class (.bold -> 700)', fonts.weights.resolved.h2.value === 700);

    const page = site.page;
    check('white body text on a dark body -> siteIsDark: true', page.siteIsDark === true);
    check(
      'bodyTextColor.value is null with a reason and the observed color',
      page.bodyTextColor?.value === null && page.bodyTextColor?.reason === 'site-is-dark' && page.bodyTextColor?.observed === '#ffffff'
    );
    check('pageBackground resolves the body class (.bg-body)', page.pageBackground?.value === '#0e0f11');

    const byHex = Object.fromEntries(site.colors.map((c) => [c.hex, c]));
    check(
      'a color painted only on SVG (inline markup + `.btn svg` rule) gets inline-svg-body, not button',
      byHex['#10a37f']?.contexts.includes('inline-svg-body') && !byHex['#10a37f']?.contexts.includes('button')
    );
    check('a color whose rules match nothing on the page is onPage: false', byHex['#cc785c']?.onPage === false);
    check(
      'an on-page color ranks above a more frequent off-page one',
      site.colors.indexOf(byHex['#ccff00']) < site.colors.indexOf(byHex['#cc785c'])
    );

    const top = site.logo[0];
    check(
      'unnamed header image in <a href="/"> is a logo candidate and ranks first',
      !!top && (top.url || '').endsWith('Untitled-design-3.svg') && top.homeLink === true && top.logoWord === false
    );
    const named = site.logo.find((l) => (l.url || '').endsWith('arkona-logo.png'));
    check('a smaller file named "logo" does not outrank the home-link logo', !!named && site.logo.indexOf(named) > 0);
    check(
      'header icons are dropped (24x24 close X, 320x512 glyph)',
      !site.logo.some((l) => l.kind === 'svg-inline')
    );
    check('home-link SVG logo is detected whiteOnTransparent', top?.whiteOnTransparent === true);
    check('a JSON-looking copyright line is not a name form', !site.page.nameForms.some((c) => /[{}]/.test(c.value)));
  } else {
    failures += 17;
  }
}

console.log('fixture: names-and-logo.html');
{
  const site = runOn('names-and-logo.html');
  if (site) {
    const names = site.page.nameForms;
    const footer = findCandidate(names, 'footer');
    check('legal form cut off: "Vantora Labs Inc" -> value "Vantora Labs"', footer?.value === 'Vantora Labs');
    check('the full form is kept in legalName', footer?.legalName === 'Vantora Labs Inc');
    check('a bare domain is not offered when another name form exists', !names.some((c) => /example-brand\.com/.test(c.value)));
    const logo = site.logo.find((l) => l.kind === 'svg-inline');
    check('inline SVG logo reports its saturated colors, greys left out', !!logo && Array.isArray(logo.colors) && logo.colors.length === 1 && logo.colors[0].hex === '#ed1c24');
    check('logo color share counts the color declarations', logo?.colors?.[0]?.share === 0.667);
  } else {
    failures += 5;
  }
}

console.log('logoDistance, --summary, --out, --save-logo');
{
  const tmp = mkdtempSync(join(tmpdir(), 'brand-evidence-smoke-'));
  const site = runOn('names-and-logo.html');
  const btn = site?.colors.find((c) => c.hex === '#b82424');
  check('every color carries logoDistance', !!site && site.colors.every((c) => 'logoDistance' in c));
  check('logoDistance is measured against the inline SVG logo', site?.logoDistanceFrom?.kind === 'svg-inline' && site.logoDistanceFrom.colors[0] === '#ed1c24');
  check('the button red sits near the logo red (0 < logoDistance < 20)', btn?.logoDistance > 0 && btn.logoDistance < 20);
  const noLogoColor = runOn('wp-presets.html');
  check('logoDistance is null when no logo paints with a saturated color', !!noLogoColor && noLogoColor.logoDistanceFrom === null && noLogoColor.colors.every((c) => c.logoDistance === null));

  const outJson = join(tmp, 'evidence.json');
  const sum = spawnSync(process.execPath, [SCRIPT, join(FIXTURES, 'names-and-logo.html'), '--summary', '--out', outJson, '--save-logo', join(tmp, 'inline', 'logo')], { encoding: 'utf8' });
  const lines = (sum.stdout || '').trim().split('\n');
  check('--summary exits 0', sum.status === 0);
  check('--summary stays short (at most 60 lines)', lines.length > 5 && lines.length <= 60);
  check('--summary names the brand, the language and the legal name', /name: "Vantora Labs" \(footer; legalName "Vantora Labs Inc"\)/.test(sum.stdout) && /^lang: en$/m.test(sum.stdout));
  check('--summary lists the button color with its logoDistance', /#b82424 .*button.*logoDistance \d/.test(sum.stdout));
  check('--summary lists the fonts and the logo candidates', /body: Inter/.test(sum.stdout) && /0\. \(inline SVG\)/.test(sum.stdout));
  let full = null;
  try { full = JSON.parse(readFileSync(outJson, 'utf8')); } catch {}
  check('--out writes the full JSON', full?.schema === 1 && full.sites[0].colors.length > 0);
  const svgPath = join(tmp, 'inline', 'logo.svg');
  check('--save-logo writes an inline SVG logo as logo.svg', existsSync(svgPath) && /^<svg xmlns="http:\/\/www\.w3\.org\/2000\/svg"/.test(readFileSync(svgPath, 'utf8')));
  check('the summary says where the logo went', sum.stdout.includes('saved #0 to'));

  const png = spawnSync(process.execPath, [SCRIPT, join(FIXTURES, 'wp-presets.html'), '--out', join(tmp, 'wp.json'), '--save-logo', join(tmp, 'wp', 'logo.svg')], { encoding: 'utf8' });
  check('--out alone prints nothing on stdout', png.status === 0 && png.stdout.trim() === '');
  const pngPath = join(tmp, 'wp', 'logo.png');
  check('--save-logo fixes the extension from the bytes (logo.svg -> logo.png)', existsSync(pngPath) && !existsSync(join(tmp, 'wp', 'logo.svg')));
  check('the saved PNG is the file as fetched', existsSync(pngPath) && readFileSync(pngPath).equals(readFileSync(join(FIXTURES, 'arkona-logo.png'))));
  const bad = spawnSync(process.execPath, [SCRIPT, join(FIXTURES, 'wp-presets.html'), '--summary', '--logo-index', '99', '--save-logo', join(tmp, 'none')], { encoding: 'utf8' });
  check('--logo-index past the list exits 3 and still prints the summary', bad.status === 3 && /^site: /.test(bad.stdout));
}

console.log('fixture: next-image.html (entities in URLs, image optimizers, srcset)');
{
  const site = runOn('next-image.html');
  const logos = site?.logo || [];
  const byLoc = (kind, loc) => logos.find((l) => l.kind === kind && l.location === loc);
  const head = byLoc('img', 'header');
  check('Next.js /_next/image resolves to the original file', head?.url === join(FIXTURES, 'arkona-logo.png'));
  check('optimizedUrl is what the page requested, &amp; decoded', head?.optimizedUrl === '/_next/image?url=%2Farkona-logo.png&w=1920&q=75');
  check('no candidate URL keeps an &amp; entity', logos.every((l) => !/&amp;/.test(`${l.url} ${l.optimizedUrl}`)));
  const bg = byLoc('background', 'header');
  check('style url() with &quot; entities resolves to the original', bg?.url === join(FIXTURES, 'badge-logo.png') && /&w=640&/.test(bg.optimizedUrl || ''));
  const partner = logos.find((l) => /partner-logo/.test(l.url || ''));
  check('no optimizer: the largest srcset candidate wins over src', /partner-logo-large\.png$/.test(partner?.url || '') && partner.optimizedUrl === null);
  const press = logos.find((l) => /press-logo/.test(l.url || ''));
  check('Cloudflare /cdn-cgi/image/<opts>/<path> resolves to the path', press?.url === 'https://cdn.example.com/uploads/press-logo.png');
  const foot = byLoc('img', 'footer');
  check('Vercel /_vercel/image?url=<absolute> resolves to that URL', foot?.url === 'https://assets.example.com/brand/logo.svg' && /\/_vercel\/image\?/.test(foot.optimizedUrl || ''));
  check('the original PNG is read (whiteOnTransparent known)', head?.whiteOnTransparent === false);

  const tmp = mkdtempSync(join(tmpdir(), 'brand-evidence-next-'));
  const r = spawnSync(process.execPath, [SCRIPT, join(FIXTURES, 'next-image.html'), '--summary', '--save-logo', join(tmp, 'logo')], { encoding: 'utf8' });
  const png = join(tmp, 'logo.png');
  check('--save-logo saves the original file, not the optimizer URL', r.status === 0 && existsSync(png) && readFileSync(png).equals(readFileSync(join(FIXTURES, 'arkona-logo.png'))));
  check('--summary marks the original of an optimized image', /original of an optimized image/.test(r.stdout));
}

if (failures > 0) {
  console.log(`\n${failures} assertion(s) failed.`);
  process.exit(1);
}
console.log('\nall assertions passed.');
process.exit(0);
