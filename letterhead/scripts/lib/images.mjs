// Shared helpers for the presentation scripts (prepare-images, product-cards,
// build-presentation): image sizes read from the file header, resizing
// through whatever image tool the system has, and the text helpers that turn
// folder and file names into slugs and sentences.
//
// Zero-install: Node built-ins only. Resizing calls macOS `sips`, ImageMagick
// (`magick`, or `convert` when it is ImageMagick's) or Python with Pillow
// (Linux sandboxes, such as claude.ai's, have it) through child_process when
// one is present. Without one, images are used as they are and the caller
// warns.

import { readFileSync, copyFileSync, statSync } from 'node:fs';
import { execFile, spawnSync } from 'node:child_process';
import { cpus } from 'node:os';

// ---------------------------------------------------------------------------
// Image size from the header: JPEG (with EXIF orientation), PNG, WebP, GIF.
// ---------------------------------------------------------------------------

function jpegOrientation(buf, start, len) {
  // APP1 segment: "Exif\0\0" then a TIFF header.
  if (buf.toString('latin1', start, start + 4) !== 'Exif') return 1;
  const tiff = start + 6;
  const le = buf.toString('latin1', tiff, tiff + 2) === 'II';
  const u16 = (o) => (le ? buf.readUInt16LE(o) : buf.readUInt16BE(o));
  const u32 = (o) => (le ? buf.readUInt32LE(o) : buf.readUInt32BE(o));
  try {
    const ifd = tiff + u32(tiff + 4);
    const n = u16(ifd);
    for (let i = 0; i < n; i++) {
      const e = ifd + 2 + i * 12;
      if (e + 12 > start + len) break;
      if (u16(e) === 0x0112) return u16(e + 8);
    }
  } catch {
    return 1;
  }
  return 1;
}

export function imageSize(buf) {
  if (!buf || buf.length < 24) return null;
  // PNG
  if (buf.readUInt32BE(0) === 0x89504e47) {
    const colorType = buf[25];
    return { type: 'png', width: buf.readUInt32BE(16), height: buf.readUInt32BE(20), alpha: colorType === 4 || colorType === 6 };
  }
  // GIF
  if (buf.toString('latin1', 0, 3) === 'GIF') {
    return { type: 'gif', width: buf.readUInt16LE(6), height: buf.readUInt16LE(8) };
  }
  // WebP
  if (buf.toString('latin1', 0, 4) === 'RIFF' && buf.toString('latin1', 8, 12) === 'WEBP') {
    const chunk = buf.toString('latin1', 12, 16);
    if (chunk === 'VP8 ') return { type: 'webp', width: buf.readUInt16LE(26) & 0x3fff, height: buf.readUInt16LE(28) & 0x3fff };
    if (chunk === 'VP8L') {
      const b = buf.readUInt32LE(21);
      return { type: 'webp', width: (b & 0x3fff) + 1, height: ((b >> 14) & 0x3fff) + 1 };
    }
    if (chunk === 'VP8X') {
      return { type: 'webp', width: 1 + buf.readUIntLE(24, 3), height: 1 + buf.readUIntLE(27, 3), alpha: Boolean(buf[20] & 0x10) };
    }
    return null;
  }
  // JPEG
  if (buf[0] === 0xff && buf[1] === 0xd8) {
    let o = 2;
    let orientation = 1;
    while (o + 9 < buf.length) {
      if (buf[o] !== 0xff) { o++; continue; }
      const marker = buf[o + 1];
      if (marker === 0xd8 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) { o += 2; continue; }
      const len = buf.readUInt16BE(o + 2);
      if (marker === 0xe1) orientation = jpegOrientation(buf, o + 4, len - 2);
      if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) {
        const height = buf.readUInt16BE(o + 5);
        const width = buf.readUInt16BE(o + 7);
        // Orientations 5-8 turn the picture a quarter; the browser shows it turned.
        return orientation >= 5 ? { type: 'jpeg', width: height, height: width } : { type: 'jpeg', width, height };
      }
      o += 2 + len;
    }
    return null;
  }
  // HEIC/AVIF (ISO BMFF): the size sits in an ispe box.
  if (buf.toString('latin1', 4, 8) === 'ftyp') {
    const brand = buf.toString('latin1', 8, 12);
    const at = buf.indexOf('ispe', 0, 'latin1');
    const type = /avi[fs]/.test(brand) ? 'avif' : 'heic';
    if (at > 0 && at + 16 <= buf.length) return { type, width: buf.readUInt32BE(at + 8), height: buf.readUInt32BE(at + 12) };
    return { type, width: 0, height: 0 };
  }
  return null;
}

export function imageSizeOfFile(path) {
  try {
    return imageSize(readFileSync(path));
  } catch {
    return null;
  }
}

export const MIME = { jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp', gif: 'image/gif' };
export const EXT = { jpeg: 'jpg', png: 'png', webp: 'webp', gif: 'gif' };

// ---------------------------------------------------------------------------
// Image tools
// ---------------------------------------------------------------------------

function works(cmd, args, expect) {
  const r = spawnSync(cmd, args, { encoding: 'utf8' });
  if (r.error) return false;
  return expect ? expect.test(`${r.stdout}${r.stderr}`) : true;
}

let python = null;

// preference: 'auto' | 'sips' | 'magick' | 'pillow' | 'none'
export function detectImageTool(preference = 'auto') {
  if (preference === 'none') return null;
  if ((preference === 'auto' || preference === 'sips') && works('sips', ['--help'], /sips/i)) return 'sips';
  if (preference === 'auto' || preference === 'magick') {
    if (works('magick', ['-version'], /ImageMagick/i)) return 'magick';
    // On Windows `convert` is a disk tool; only ImageMagick's counts.
    if (works('convert', ['-version'], /ImageMagick/i)) return 'convert';
  }
  if (preference === 'auto' || preference === 'pillow') {
    for (const cmd of ['python3', 'python']) {
      if (works(cmd, ['-c', 'import PIL; print("pillow")'], /^pillow/)) {
        python = cmd;
        return 'pillow';
      }
    }
  }
  return null;
}

// Pillow's side of encodeImage: argv = input, output, maxEdge, quality, format.
// HEIC opens only when pillow-heif is installed next to Pillow.
const PILLOW_SCRIPT = `
import sys
from PIL import Image, ImageOps
try:
    from pillow_heif import register_heif_opener
    register_heif_opener()
except ImportError:
    pass
src, out, edge, quality, fmt = sys.argv[1], sys.argv[2], int(sys.argv[3]), int(sys.argv[4]), sys.argv[5]
try:
    im = Image.open(src)
except Exception as e:
    sys.exit(("HEIC needs pillow-heif: " if src.lower().endswith((".heic", ".heif")) else "") + str(e))
im = ImageOps.exif_transpose(im)
im.thumbnail((edge, edge), Image.LANCZOS)
if fmt == "png":
    if im.mode not in ("RGB", "RGBA", "L", "LA", "P"):
        im = im.convert("RGBA")
    im.save(out, "PNG", optimize=True)
else:
    if im.mode in ("RGBA", "LA") or (im.mode == "P" and "transparency" in im.info):
        im = im.convert("RGBA")
        bg = Image.new("RGB", im.size, (255, 255, 255))
        bg.paste(im, mask=im.getchannel("A"))
        im = bg
    elif im.mode != "RGB":
        im = im.convert("RGB")
    im.save(out, "JPEG", quality=quality, optimize=True, progressive=True, subsampling="4:2:0")
`;

function run(cmd, args) {
  return new Promise((resolve, reject) => {
    execFile(cmd, args, { maxBuffer: 16 * 1024 * 1024 }, (err, stdout, stderr) => {
      if (err) reject(new Error(`${cmd} failed: ${(stderr || err.message).toString().trim().split('\n')[0]}`));
      else resolve(stdout);
    });
  });
}

// Encode one image with the long edge at most maxEdge (never enlarged).
// format: 'jpeg' or 'png'. Returns the output's { width, height, bytes, type }.
export async function encodeImage(tool, input, output, { maxEdge, quality = 75, format = 'jpeg', srcSize = null }) {
  let size = srcSize || imageSizeOfFile(input);
  if (tool === 'sips') {
    if (!size || !size.width) {
      const out = await run('sips', ['-g', 'pixelWidth', '-g', 'pixelHeight', input]);
      size = { width: Number((/pixelWidth: (\d+)/.exec(out) || [])[1]), height: Number((/pixelHeight: (\d+)/.exec(out) || [])[1]) };
    }
    const long = Math.max(size.width || 0, size.height || 0);
    // sips -Z also enlarges, so pass it only when the picture is too big.
    const resize = long > maxEdge ? ['-Z', String(maxEdge)] : [];
    const fmt = format === 'png' ? ['-s', 'format', 'png'] : ['-s', 'format', 'jpeg', '-s', 'formatOptions', String(quality)];
    await run('sips', [...resize, ...fmt, input, '--out', output]);
  } else if (tool === 'magick' || tool === 'convert') {
    const args = [input, '-auto-orient', '-resize', `${maxEdge}x${maxEdge}>`, '-strip'];
    if (format === 'png') args.push(`png:${output}`);
    else args.push('-background', 'white', '-flatten', '-quality', String(quality), '-sampling-factor', '4:2:0', '-interlace', 'JPEG', `jpeg:${output}`);
    await run(tool, args);
  } else if (tool === 'pillow') {
    await run(python || 'python3', ['-c', PILLOW_SCRIPT, input, output, String(maxEdge), String(quality), format]);
  } else {
    copyFileSync(input, output);
  }
  const out = imageSizeOfFile(output);
  return { width: out?.width || 0, height: out?.height || 0, type: out?.type || null, bytes: statSync(output).size };
}

// Run async jobs with a concurrency limit, results in input order.
export async function pool(items, worker, limit = Math.max(2, Math.min(8, cpus().length))) {
  const results = new Array(items.length);
  let next = 0;
  const lanes = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) {
      const i = next++;
      results[i] = await worker(items[i], i);
    }
  });
  await Promise.all(lanes);
  return results;
}

// ---------------------------------------------------------------------------
// Text helpers
// ---------------------------------------------------------------------------

export function slugify(s) {
  return String(s)
    .toLowerCase()
    .replace(/ł/g, 'l')
    .replace(/ø/g, 'o')
    .replace(/æ/g, 'ae')
    .replace(/ß/g, 'ss')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export function naturalCompare(a, b) {
  return a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' });
}

// A name written in capitals loses which words are proper nouns, so it comes
// back as a sentence ("SALON Z KUCHNIĄ" → "Salon z kuchnią") and the caller
// marks it for checking. A name in mixed case is kept as written.
export function sentenceCase(s, lang = 'en') {
  const text = String(s).trim().replace(/\s+/g, ' ');
  const letters = text.replace(/[^\p{L}]/gu, '');
  if (!letters || letters !== letters.toLocaleUpperCase(lang)) return text;
  const lower = text.toLocaleLowerCase(lang);
  return lower.charAt(0).toLocaleUpperCase(lang) + lower.slice(1);
}

export function bytesText(n) {
  return n >= 1048576 ? `${(n / 1048576).toFixed(2)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`;
}
