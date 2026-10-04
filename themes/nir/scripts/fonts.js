/* global hexo */
'use strict';

// Self-hosted serif CJK webfonts, subset per page.
// Each post (or page) gets a WOFF2 holding exactly the Chinese/Japanese characters it uses,
// cut from Noto Serif CJK in the page's own region (SC, or JP for `lang: ja-jp`), so kanji and
// hanzi never mix glyph forms from different fonts. The faces cover only characters that every
// CJK font sets 1em wide, and never the space, so they are never a line's primary font: line
// heights come from the Latin face and the swap from the system's CJK font moves nothing.

const fs = require('fs');
const fsp = fs.promises;
const path = require('path');
const zlib = require('zlib');
const crypto = require('crypto');
const subsetFont = require('subset-font');

const VERSION = 'Serif2.003';
const SOURCE = `https://raw.githubusercontent.com/notofonts/noto-cjk/${VERSION}/Serif/OTF/`;
const SOURCES = {
  sc: {
    400: ['SimplifiedChinese/NotoSerifCJKsc-Regular.otf', '2a2eae2628df83556c54018c41e20fa532c1b862c5256ae8b3f23feb918d12ca'],
    700: ['SimplifiedChinese/NotoSerifCJKsc-Bold.otf', '8af07d4b6c2e82bcc72a30e066eaf295f11b9424f4aad2eaa9fe0e9c3b38fc73']
  },
  jp: {
    400: ['Japanese/NotoSerifCJKjp-Regular.otf', 'd9854c7a8ef170b5a7932558856fd64eb8de0b007cd823fed6f9f514ad2803d3'],
    700: ['Japanese/NotoSerifCJKjp-Bold.otf', '861a2b2c0e24b23745c262be8c3fdef63f12628f0492fb120ee51aa55c503af8']
  }
};
const CACHE_DIR = path.join(hexo.base_dir, '.cache', 'fonts');

// Horizontal text only, and no half-width punctuation features (`text-spacing-trim` is off, see
// core.css): vertical metrics and alternate glyphs would roughly double the size.
const SUBSET_OPTIONS = { targetFormat: 'sfnt', keepFeatures: ['kern', 'ccmp'], dropTables: ['vhea', 'vmtx', 'VORG'] };

// Characters drawn from the CJK face: ideographs, kana, CJK and full-width punctuation, and the
// ellipsis. Only characters every CJK font sets 1em wide are included, so the system font shown
// while the webfont loads and the webfont always break lines identically; curly quotes and dashes (proportional in some CJK
// fonts, and shared with English words) stay with the Latin face.
const RANGES = [
  [0x2026, 0x2026],
  [0x2E80, 0x2FDF], [0x3000, 0x30FF], [0x31C0, 0x31FF], [0x3400, 0x4DBF], [0x4E00, 0x9FFF],
  [0xF900, 0xFAFF], [0xFE30, 0xFE4F], [0xFF00, 0xFFEF], [0x20000, 0x3134F]
];
const hex = n => n.toString(16).toUpperCase();
const UNICODE_RANGE = RANGES.map(([a, b]) => a === b ? `U+${hex(a)}` : `U+${hex(a)}-${hex(b)}`).join(',');
const inRange = cp => RANGES.some(([a, b]) => cp >= a && cp <= b);

const FAMILY = { sc: 'Nir Serif SC', jp: 'Nir Serif JP' };

// ---------- characters used on each page ----------

const decode = s => s.replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
  .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(+d)).replace(/&[a-z]+;/gi, ' ');
const cjk = (text, into = new Set()) => {
  for (const c of decode(String(text || ''))) if (inRange(c.codePointAt(0))) into.add(c);
  return into;
};
// Text set in the serif face: code, tables, math and alerts use other fonts.
const readable = html => String(html || '')
  .replace(/<(pre|code|table|math|script|style|svg|template)\b[\s\S]*?<\/\1>/gi, ' ')
  .replace(/<div class="alert[\s\S]*?<\/div>/gi, ' ');
const textOf = html => html.replace(/<[^>]+>/g, ' ');
const boldOf = html => [...html.matchAll(/<(h[1-6]|strong|b)\b[^>]*>([\s\S]*?)<\/\1>/gi)].map(m => textOf(m[2])).join(' ');

const regionOf = item => /^ja/i.test(String(item.lang || '').trim()) ? 'jp' : 'sc';
const pageFonts = new Map(); // page path -> { region, 400: Set, 700: Set }
const articles = new Set(); // paths of every post and page, with or without CJK text
let siteFonts = null;

function collect(locals) {
  pageFonts.clear();
  articles.clear();
  const items = [...locals.posts.toArray(), ...locals.pages.toArray().filter(p => !p.layout || p.layout === 'page')];
  for (const item of items) {
    articles.add(item.path);
    const html = readable(item.content);
    const sets = { region: regionOf(item), 400: cjk(textOf(html)), 700: cjk(boldOf(html) + ' ' + (item.title || '')) };
    if (sets[400].size || sets[700].size) pageFonts.set(item.path, sets);
  }
  // List pages only set their (bold) headings in the serif face: category and tag names, the site title.
  const names = [...locals.categories.map(c => c.name), ...locals.tags.map(t => t.name), hexo.config.title, hexo.config.description].join(' ');
  siteFonts = { region: 'sc', 400: cjk(hexo.config.description), 700: cjk(names) };
}

// ---------- subsetting and WOFF2 encoding ----------

async function sourceFont(region, weight) {
  const [file, sha] = SOURCES[region][weight];
  const local = path.join(CACHE_DIR, 'src', VERSION, path.basename(file));
  const verify = buf => crypto.createHash('sha256').update(buf).digest('hex') === sha;
  try {
    const buf = await fsp.readFile(local);
    if (verify(buf)) return buf;
  } catch {}
  hexo.log.info('[fonts] downloading %s', path.basename(file));
  const res = await fetch(SOURCE + file);
  if (!res.ok) throw new Error(`[fonts] ${SOURCE + file}: HTTP ${res.status}`);
  const buf = Buffer.from(await res.arrayBuffer());
  if (!verify(buf)) throw new Error(`[fonts] ${file}: checksum mismatch`);
  await fsp.mkdir(path.dirname(local), { recursive: true });
  await fsp.writeFile(local, buf);
  return buf;
}

// The full fonts are ~25 MB each, so they are cut down once to every character the site
// uses; per-page subsets are then taken from that much smaller font.
const bases = new Map();
const siteChars = { sc: { 400: new Set(), 700: new Set() }, jp: { 400: new Set(), 700: new Set() } };
const baseFont = (region, weight) => {
  const key = region + weight;
  if (!bases.has(key)) {
    bases.set(key, sourceFont(region, weight).then(buf => subsetFont(buf, [...siteChars[region][weight]].join(''), SUBSET_OPTIONS)));
  }
  return bases.get(key);
};

// Minimal WOFF2 encoder for CFF-flavoured fonts: those have no glyf/loca tables, so every table
// goes in untransformed and the whole file is a single Brotli stream (native zlib is much faster
// than a wasm encoder).
function woff2(sfnt) {
  const numTables = sfnt.readUInt16BE(4);
  const tables = [];
  for (let i = 0; i < numTables; i++) {
    const o = 12 + 16 * i;
    tables.push({ tag: sfnt.subarray(o, o + 4), offset: sfnt.readUInt32BE(o + 8), length: sfnt.readUInt32BE(o + 12) });
  }
  tables.sort((a, b) => Buffer.compare(a.tag, b.tag));
  const base128 = n => {
    const bytes = [n & 0x7f];
    while ((n >>>= 7)) bytes.unshift(0x80 | (n & 0x7f));
    return Buffer.from(bytes);
  };
  const directory = Buffer.concat(tables.flatMap(t => [Buffer.from([0x3f]), t.tag, base128(t.length)]));
  const data = Buffer.concat(tables.map(t => sfnt.subarray(t.offset, t.offset + t.length)));
  return new Promise((resolve, reject) => zlib.brotliCompress(data, {
    params: {
      [zlib.constants.BROTLI_PARAM_MODE]: zlib.constants.BROTLI_MODE_FONT,
      [zlib.constants.BROTLI_PARAM_QUALITY]: 11,
      [zlib.constants.BROTLI_PARAM_SIZE_HINT]: data.length
    }
  }, (err, compressed) => {
    if (err) return reject(err);
    const padded = Math.ceil((48 + directory.length + compressed.length) / 4) * 4;
    const header = Buffer.alloc(48);
    header.write('wOF2', 0, 'latin1');
    sfnt.copy(header, 4, 0, 4); // flavor ('OTTO')
    header.writeUInt32BE(padded, 8);
    header.writeUInt16BE(numTables, 12);
    header.writeUInt32BE(12 + 16 * numTables + tables.reduce((n, t) => n + Math.ceil(t.length / 4) * 4, 0), 16);
    header.writeUInt32BE(compressed.length, 20);
    header.writeUInt16BE(1, 24);
    resolve(Buffer.concat([header, directory, compressed], padded));
  }));
}

const files = new Map(); // route path -> { id, region, weight, text }
function fileFor(region, weight, chars) {
  if (!chars.size) return null;
  const text = [...chars].sort().join('');
  const id = crypto.createHash('sha256').update([VERSION, JSON.stringify(SUBSET_OPTIONS), region, weight, text].join('\n')).digest('hex').slice(0, 12);
  const route = `fonts/${region}-${weight}.${id}.woff2`;
  if (!files.has(route)) {
    files.set(route, { id, region, weight, text });
    for (const c of chars) siteChars[region][weight].add(c);
  }
  return route;
}

async function subsetFile({ id, region, weight, text }) {
  const cached = path.join(CACHE_DIR, id + '.woff2');
  try { return await fsp.readFile(cached); } catch {}
  const data = await woff2(await subsetFont(await baseFont(region, weight), text, SUBSET_OPTIONS));
  await fsp.mkdir(CACHE_DIR, { recursive: true });
  await fsp.writeFile(cached, data).catch(() => {});
  return data;
}

const faces = new Map(); // page path (or '' for list pages) -> { css: @font-face rules, urls: subset files }

hexo.extend.generator.register('nir-fonts', locals => {
  collect(locals);
  files.clear();
  faces.clear();
  for (const r of Object.keys(siteChars)) for (const w of [400, 700]) siteChars[r][w].clear();
  bases.clear();
  const build = sets => {
    const urls = [];
    const rules = [400, 700].map(w => {
      const route = fileFor(sets.region, w, sets[w]);
      if (!route) return '';
      urls.push(hexo.config.root + route);
      return `@font-face{font-family:"${FAMILY[sets.region]}";font-weight:${w};font-display:swap;src:url(${hexo.config.root}${route}) format("woff2");unicode-range:${UNICODE_RANGE}}`;
    }).join('');
    return { css: rules, urls };
  };
  for (const [p, sets] of pageFonts) faces.set(p, build(sets));
  if (siteFonts[400].size || siteFonts[700].size) faces.set('', build(siteFonts));
  return [...files].map(([route, file]) => ({ path: route, data: () => subsetFile(file) }));
});

const facesFor = page => faces.get(page && articles.has(page.path) ? page.path : '');

// @font-face rules for one page and the files they point at (list pages share one subset of
// category and tag names). Both are empty when the page sets no CJK text in serif.
hexo.extend.helper.register('font_css', page => facesFor(page)?.css || '');
hexo.extend.helper.register('font_urls', page => (facesFor(page)?.urls || []).join(' '));
