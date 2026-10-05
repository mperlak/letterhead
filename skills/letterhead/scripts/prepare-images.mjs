#!/usr/bin/env node
// Prepares the pictures for a presentation document (templates/presentation):
// reads a folder of rooms (one subfolder per room), makes every picture small
// enough to travel inside one HTML file, and writes a manifest the build
// script and the agent both read.
//
// Usage:
//   node prepare-images.mjs <folder> --out <workdir>
//        [--max 1600] [--budget-mb 7] [--lang pl|en] [--tool auto|sips|magick|pillow|none]
//
// Input:
//   <folder>/<n>. <ROOM NAME>/<file>.jpg|jpeg|png|webp|heic
//   Rooms come in the order of the "<n>. " prefix, otherwise alphabetically.
//   A folder with no subfolders is one room, unless its file names name at
//   least two spaces with two pictures each ("SALA 1", "SALA 2", "WC 1",
//   "WC 2"): then one room per name, alphabetically; an order the agent sets
//   in manifest.json survives the next run. A file whose name ends in
//   " — <label>" (or " - wersja …", " - version …") is a variant of the file
//   with the same name before the dash: "Kitchen 7.jpg" and
//   "Kitchen 7 — white fronts.jpg" become one view in two variants.
//
// Output:
//   <workdir>/img/<room-slug>-<n>.jpg   long edge <= --max, never enlarged
//   <workdir>/manifest.json             rooms[] -> images[] (id, file, width,
//                                       height, caption, variantGroup,
//                                       variantLetter, variantLabel)
//   Room names and captions are read from folder and file names. A name
//   written in capitals comes back as a sentence and is marked
//   nameSource "folder": proper nouns lost their capitals, so the agent
//   checks and corrects it in the manifest before the build. Corrections
//   survive a second run (same room slug, same image id).
//
// Size: the JPEG quality goes down step by step until all pictures together
// fit --budget-mb (about 7 MB of pictures is about 9 MB of HTML). Resizing
// uses macOS sips, ImageMagick or Python with Pillow when present; without
// any of them the pictures are copied as they are and the script says so.
//
// Exit codes:
//   0 — manifest written
//   1 — usage error, unreadable folder, or no pictures found

import { readdirSync, readFileSync, writeFileSync, mkdirSync, rmSync, existsSync, renameSync, statSync } from 'node:fs';
import { join, resolve, extname, basename } from 'node:path';
import {
  imageSizeOfFile, detectImageTool, encodeImage, pool, slugify, naturalCompare, sentenceCase, bytesText, EXT,
} from './lib/images.mjs';

const USAGE = 'usage: node prepare-images.mjs <folder> --out <workdir> [--max 1600] [--budget-mb 7] [--lang pl|en] [--tool auto|sips|magick|pillow|none]';
const IMAGE_RE = /\.(jpe?g|png|webp|heic|heif)$/i;
const VARIANT_WORDS = 'wersja|wersji|wariant|opcja|version|variant|option|alt';

function fail(msg) {
  console.error(`prepare-images: ${msg}`);
  process.exit(1);
}

function parseArgs(argv) {
  const o = { folder: null, out: null, max: 1600, budgetMb: 7, lang: 'en', tool: 'auto' };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '-h' || a === '--help') { console.log(USAGE); process.exit(0); }
    else if (a === '--out') o.out = argv[++i];
    else if (a === '--max') o.max = Number(argv[++i]);
    else if (a === '--budget-mb') o.budgetMb = Number(argv[++i]);
    else if (a === '--lang') o.lang = argv[++i];
    else if (a === '--tool') o.tool = argv[++i];
    else if (a.startsWith('--')) fail(`unknown option ${a}\n${USAGE}`);
    else if (!o.folder) o.folder = a;
    else fail(USAGE);
  }
  if (!o.folder || !o.out) fail(USAGE);
  if (!(o.max >= 200)) fail('--max must be a number of pixels, at least 200');
  if (!(o.budgetMb > 0)) fail('--budget-mb must be a positive number');
  if (!['auto', 'sips', 'magick', 'pillow', 'none'].includes(o.tool)) fail('--tool must be auto, sips, magick, pillow or none');
  return o;
}

// "3. SALON Z KUCHNIĄ" → { number: 3, rest: "SALON Z KUCHNIĄ" }
function splitNumber(name) {
  const m = /^(\d+)(?:[.)]\s*|\s+[-–—]?\s*)(.+)$/.exec(name.trim());
  return m ? { number: Number(m[1]), rest: m[2].trim() } : { number: null, rest: name.trim() };
}

// "2. KITCHEN 7 — WHITE FRONTS.jpg" → main "KITCHEN 7", label "WHITE FRONTS", num 7
function parseFile(file) {
  const stem = basename(file, extname(file)).trim();
  // A leading "2. " is the designer's own file ordering, not part of the name.
  const bare = stem.replace(/^\d+[.)]\s+(?=\S)/, '');
  let main = bare;
  let label = null;
  const dash = /\s+[—–]\s+/.exec(bare) || new RegExp(`\\s+-\\s+(?=(?:${VARIANT_WORDS})\\b)`, 'i').exec(bare);
  if (dash) {
    main = bare.slice(0, dash.index).trim();
    label = bare.slice(dash.index + dash[0].length).trim() || null;
  }
  const num = (/(\d+)\s*$/.exec(main) || [])[1];
  return { file, stem, main, label, num: num === undefined ? null : Number(num) };
}

function listRooms(folder) {
  let entries;
  try {
    entries = readdirSync(folder, { withFileTypes: true });
  } catch (e) {
    fail(`cannot read ${folder}: ${e.code || e.message}`);
  }
  const visible = entries.filter((e) => !e.name.startsWith('.'));
  const dirs = visible.filter((e) => e.isDirectory());
  const looseImages = visible.filter((e) => e.isFile() && IMAGE_RE.test(e.name));
  const warnings = [];
  if (dirs.length === 0) {
    // No subfolders. When the file names themselves name the spaces
    // ("SALA KONFERENCYJNA 1", "WC 2"), each name before the number is a room,
    // provided there are at least two such names and each has two pictures or
    // more; otherwise the whole folder is one room.
    const byName = new Map();
    for (const e of looseImages) {
      const roomName = parseFile(e.name).main.replace(/\s*\d+\s*$/, '').trim();
      const key = roomName.toLocaleLowerCase();
      if (!byName.has(key)) byName.set(key, { name: roomName, files: [] });
      byName.get(key).files.push(e.name);
    }
    const named = [...byName.values()];
    if (named.length >= 2 && named.every((g) => g.name && g.files.length >= 2)) {
      named.sort((a, b) => naturalCompare(a.name, b.name));
      warnings.push(`no room subfolders: ${named.length} rooms taken from the file names (${named.map((g) => g.name).join(', ')}), in alphabetical order; reorder the rooms in manifest.json if the main space should come first`);
      return { rooms: named.map((g) => ({ dir: folder, folderName: g.name, files: g.files })), warnings };
    }
    return { rooms: [{ dir: folder, folderName: basename(folder) }], warnings };
  }
  if (looseImages.length) {
    warnings.push(`${looseImages.length} picture(s) directly in ${basename(folder)}/ were left out: with room subfolders, every picture belongs in one`);
  }
  const rooms = dirs.map((d) => ({ dir: join(folder, d.name), folderName: d.name }));
  rooms.sort((a, b) => {
    const na = splitNumber(a.folderName).number;
    const nb = splitNumber(b.folderName).number;
    if (na !== null && nb !== null && na !== nb) return na - nb;
    if (na !== null && nb === null) return -1;
    if (na === null && nb !== null) return 1;
    return naturalCompare(a.folderName, b.folderName);
  });
  return { rooms, warnings };
}

function unique(base, taken) {
  let id = base;
  for (let i = 2; taken.has(id); i++) id = `${base}-${i}`;
  taken.add(id);
  return id;
}

function main() {
  const opts = parseArgs(process.argv.slice(2));
  const folder = resolve(opts.folder);
  const work = resolve(opts.out);
  const warnings = [];
  const { rooms: roomDirs, warnings: w1 } = listRooms(folder);
  warnings.push(...w1);

  const tool = detectImageTool(opts.tool);
  if (!tool) {
    warnings.push(opts.tool === 'none'
      ? 'resizing switched off (--tool none): pictures are used at their own size'
      : 'no image tool found (sips, ImageMagick, Python with Pillow): pictures are used at their own size, and the document may come out large');
  }

  // Corrections the agent made in an earlier manifest survive this run.
  const manifestPath = join(work, 'manifest.json');
  let previous = null;
  if (existsSync(manifestPath)) {
    try { previous = JSON.parse(readFileSync(manifestPath, 'utf8')); } catch { previous = null; }
  }
  const prevRooms = new Map((previous?.rooms || []).map((r) => [r.slug, r]));
  const prevImages = new Map((previous?.rooms || []).flatMap((r) => r.images || []).map((i) => [i.id, i]));

  const roomSlugs = new Set();
  const imageIds = new Set();
  const rooms = [];
  const jobs = [];
  for (const rd of roomDirs) {
    let files;
    try {
      files = (rd.files || readdirSync(rd.dir)).filter((f) => !f.startsWith('.') && IMAGE_RE.test(f));
    } catch (e) {
      warnings.push(`cannot read ${rd.folderName}: ${e.code || e.message}`);
      continue;
    }
    if (!tool) {
      const heic = files.filter((f) => /\.hei[cf]$/i.test(f));
      if (heic.length) warnings.push(`${rd.folderName}: ${heic.length} HEIC file(s) left out; browsers cannot show HEIC and no tool is here to convert it`);
      files = files.filter((f) => !/\.hei[cf]$/i.test(f));
    }
    if (!files.length) {
      warnings.push(`${rd.folderName}: no pictures, room left out`);
      continue;
    }
    const { rest } = splitNumber(rd.folderName);
    const name = sentenceCase(rest, opts.lang);
    const slug = unique(slugify(name) || 'room', roomSlugs);
    const prev = prevRooms.get(slug);

    const parsed = files.map(parseFile);
    // View number first; within one view the file without a label is the
    // base (variant A). Plain name sorting puts "7 — B.jpg" before "7.jpg".
    parsed.sort((a, b) => {
      const na = a.num ?? Infinity;
      const nb = b.num ?? Infinity;
      if (na !== nb) return na - nb;
      const key = naturalCompare(a.main, b.main);
      if (key) return key;
      if (!a.label !== !b.label) return a.label ? 1 : -1;
      return naturalCompare(a.stem, b.stem);
    });
    const groups = new Map();
    for (const p of parsed) {
      const k = p.main.toLocaleLowerCase(opts.lang);
      groups.set(k, [...(groups.get(k) || []), p]);
    }
    const images = [];
    for (const p of parsed) {
      const group = groups.get(p.main.toLocaleLowerCase(opts.lang));
      const inGroup = group.length > 1;
      const letter = inGroup ? String.fromCharCode(65 + group.indexOf(p)) : null;
      const view = p.num !== null ? String(p.num) : slugify(p.main) || 'view';
      const id = unique(`${slug}-${view}${letter ? letter.toLowerCase() : ''}`, imageIds);
      const before = prevImages.get(id);
      const keepCaption = before && before.captionSource && before.captionSource !== 'file';
      const image = {
        id,
        file: null,
        width: 0,
        height: 0,
        caption: keepCaption ? before.caption : sentenceCase(p.main, opts.lang),
        captionSource: keepCaption ? before.captionSource : 'file',
        source: rd.dir === folder ? p.file : join(rd.folderName, p.file),
        variantGroup: inGroup ? `${slug}-${view}` : null,
        variantLetter: letter,
        variantLabel: inGroup && p.label ? sentenceCase(p.label, opts.lang) : null,
        bytes: 0,
      };
      if (!inGroup && p.label) image.caption = keepCaption ? image.caption : `${sentenceCase(p.main, opts.lang)}, ${sentenceCase(p.label, opts.lang).toLocaleLowerCase(opts.lang)}`;
      images.push(image);
      jobs.push({ image, input: join(rd.dir, p.file) });
    }
    const keepName = prev && prev.nameSource && prev.nameSource !== 'folder';
    rooms.push({
      n: rooms.length + 1,
      slug,
      name: keepName ? prev.name : name,
      nameSource: keepName ? prev.nameSource : 'folder',
      folder: rd.dir === folder && !rd.files ? basename(folder) : rd.folderName,
      images,
    });
  }
  // The agent may reorder rooms in manifest.json (main space first); a second
  // run keeps that order for the rooms it knew and renumbers.
  const prevOrder = new Map((previous?.rooms || []).map((r, i) => [r.slug, i]));
  if (prevOrder.size) {
    rooms.sort((a, b) => (prevOrder.get(a.slug) ?? Infinity) - (prevOrder.get(b.slug) ?? Infinity) || a.n - b.n);
    rooms.forEach((r, i) => { r.n = i + 1; });
  }
  if (!jobs.length) fail(`no pictures (jpg, png, webp${tool ? ', heic' : ''}) found in ${folder}`);

  return { opts, work, tool, rooms, jobs, warnings, manifestPath };
}

async function encodeAll({ opts, work, tool, jobs, warnings }) {
  const imgDir = join(work, 'img');
  const scratch = join(work, '.prepare');
  rmSync(scratch, { recursive: true, force: true });
  mkdirSync(scratch, { recursive: true });
  const budget = opts.budgetMb * 1048576;

  if (!tool) {
    let total = 0;
    const results = jobs.map(({ image, input }) => {
      const size = imageSizeOfFile(input);
      if (!size || !EXT[size.type]) return { error: `${image.source}: not a JPEG, PNG or WebP file` };
      const out = join(scratch, `${image.id}.${EXT[size.type]}`);
      const bytes = statSync(input).size;
      writeFileSync(out, readFileSync(input));
      total += bytes;
      return { out, width: size.width, height: size.height, bytes };
    });
    if (total > budget) warnings.push(`pictures total ${bytesText(total)}, over the ${opts.budgetMb} MB budget; install ImageMagick or Pillow (pip install pillow), or run on macOS, to shrink them`);
    const longest = Math.max(...results.filter((r) => !r.error).map((r) => Math.max(r.width, r.height)));
    if (longest > opts.max) warnings.push(`the longest picture edge is ${longest} px, over --max ${opts.max}; nothing here can resize it`);
    return { results, quality: null, scratch, imgDir };
  }

  const passes = new Map();
  async function pass(q) {
    if (passes.has(q)) return passes.get(q);
    const dir = join(scratch, `q${q}`);
    mkdirSync(dir, { recursive: true });
    const results = await pool(jobs, async ({ image, input }) => {
      const out = join(dir, `${image.id}.jpg`);
      try {
        return { out, ...(await encodeImage(tool, input, out, { maxEdge: opts.max, quality: q })) };
      } catch (e) {
        return { error: `${image.source}: ${e.message}` };
      }
    });
    const total = results.reduce((a, r) => a + (r.bytes || 0), 0);
    const done = { q, results, total };
    passes.set(q, done);
    process.stdout.write(`  quality ${q}: ${bytesText(total)}\n`);
    return done;
  }

  // Start high; if the pictures do not fit, search downwards for the highest
  // quality that does. Quality below 20 costs more in looks than it saves.
  let chosen = await pass(82);
  if (chosen.total > budget) {
    let lo = 20;
    let hi = 78;
    let best = null;
    while (hi - lo >= 4) {
      const mid = Math.round((lo + hi) / 2);
      const r = await pass(mid);
      if (r.total <= budget) { best = r; lo = mid + 1; } else hi = mid - 1;
    }
    if (!best) {
      const floor = await pass(lo);
      if (floor.total <= budget) best = floor;
    }
    if (!best) {
      best = await pass(20);
      if (best.total > budget) warnings.push(`even at quality 20 the pictures total ${bytesText(best.total)}, over the ${opts.budgetMb} MB budget; lower --max or split the document`);
    }
    chosen = best;
  }
  return { results: chosen.results, quality: chosen.q, scratch, imgDir };
}

const ctx = main();
const { results, quality, scratch, imgDir } = await encodeAll(ctx);
rmSync(imgDir, { recursive: true, force: true });
mkdirSync(imgDir, { recursive: true });
let total = 0;
let failed = 0;
ctx.jobs.forEach(({ image }, i) => {
  const r = results[i];
  if (r.error) {
    ctx.warnings.push(r.error);
    image.error = r.error;
    failed++;
    return;
  }
  const name = basename(r.out);
  renameSync(r.out, join(imgDir, name));
  Object.assign(image, { file: `img/${name}`, width: r.width, height: r.height, bytes: r.bytes });
  total += r.bytes;
});
rmSync(scratch, { recursive: true, force: true });
for (const room of ctx.rooms) room.images = room.images.filter((i) => !i.error);
ctx.rooms = ctx.rooms.filter((r) => r.images.length);

const manifest = {
  schema: 1,
  source: resolve(ctx.opts.folder),
  preparedAt: new Date().toISOString(),
  tool: ctx.tool || 'none',
  maxEdge: ctx.opts.max,
  quality,
  budgetMb: ctx.opts.budgetMb,
  totalBytes: total,
  rooms: ctx.rooms,
};
mkdirSync(ctx.work, { recursive: true });
writeFileSync(ctx.manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);

for (const room of ctx.rooms) {
  console.log(`${String(room.n).padStart(2, '0')} ${room.name}  (${room.slug}, ${room.images.length} pictures)${room.nameSource === 'folder' ? '  [name from folder: check capitals]' : ''}`);
  for (const i of room.images) {
    const variant = i.variantLetter ? `  [variant ${i.variantLetter}${i.variantLabel ? ` · ${i.variantLabel}` : ''}]` : '';
    console.log(`   ${bytesText(i.bytes).padStart(8)}  ${`${i.width}x${i.height}`.padEnd(10)} ${i.id}${variant}`);
  }
}
const count = ctx.rooms.reduce((a, r) => a + r.images.length, 0);
console.log(`prepare-images: ${count} pictures in ${ctx.rooms.length} room(s), ${bytesText(total)}${quality ? ` at JPEG quality ${quality}` : ''} (≈ ${bytesText((total * 4) / 3)} inside the HTML)`);
console.log(`prepare-images: wrote ${ctx.manifestPath}`);
if (ctx.warnings.length) {
  console.warn(`prepare-images: ${ctx.warnings.length} warning(s):`);
  for (const w of ctx.warnings) console.warn(`  - ${w}`);
}
if (!count) process.exit(1);
if (failed) console.warn(`prepare-images: ${failed} picture(s) could not be read and were left out`);
