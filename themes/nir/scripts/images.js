/* global hexo */
'use strict';

// Transparent image optimization.
// Authors keep writing `![](/assets/image/photo.jpg)` (or `{% image %}`); at build time every
// local JPEG/PNG/WebP gets resized WebP variants, and every <img> pointing to one is rewritten
// with srcset, intrinsic width/height (no layout shift) and lazy loading.

const fs = require('fs');
const fsp = fs.promises;
const path = require('path');
const crypto = require('crypto');
const sharp = require('sharp');

const EXT = /\.(jpe?g|png|webp)$/i;
const CACHE_DIR = path.join(hexo.base_dir, '.cache', 'images');
const images = new Map();
const warned = new Set(); // public URL -> { file, width, height, key, widths }
let scanned = null;

const conf = () => hexo.theme.config || {};
const widthsFor = width => {
  const list = (conf().image_widths || [240, 480, 800, 1200, 1600, 2000]).filter(w => w < width);
  if (width <= 2000) list.push(width); else if (!list.includes(2000)) list.push(2000);
  return [...new Set(list)].sort((a, b) => a - b);
};

async function walk(dir, base, out) {
  let entries;
  try { entries = await fsp.readdir(dir, { withFileTypes: true }); } catch { return out; }
  for (const e of entries) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) await walk(full, base + e.name + '/', out);
    else if (EXT.test(e.name)) out.push({ file: full, url: base + e.name });
  }
  return out;
}

async function scan() {
  images.clear();
  const root = hexo.config.root;
  const found = [];
  // Site assets (source/assets/...), theme images (themes/nir/source/img/...)
  await walk(path.join(hexo.source_dir, 'assets'), root + 'assets/', found);
  await walk(path.join(hexo.theme_dir, 'source', 'img'), root + 'img/', found);
  // Post asset folders: source/_posts/<slug>/x.png is served next to the post
  const posts = path.join(hexo.source_dir, '_posts');
  for (const e of await fsp.readdir(posts, { withFileTypes: true }).catch(() => [])) {
    if (!e.isDirectory()) continue;
    const post = hexo.model('Post').findOne({ source: '_posts/' + e.name + '.md' });
    if (post) await walk(path.join(posts, e.name), post.path.startsWith('/') ? post.path : root + post.path, found);
  }
  await Promise.all(found.map(async ({ file, url }) => {
    try {
      const buf = await fsp.readFile(file);
      const meta = await sharp(buf).metadata();
      let { width, height } = meta;
      if ((meta.orientation || 1) >= 5) [width, height] = [height, width];
      const key = crypto.createHash('sha1').update(buf).digest('hex').slice(0, 12);
      images.set(decodeURI(url), { file, width, height, key, widths: widthsFor(width) });
    } catch (err) {
      hexo.log.warn('[images] skipped %s: %s', url, err.message);
    }
  }));
}

// Encode every width of one source in a single decode pass, with a small concurrency limit
// so large photos do not exhaust memory on the build machine.
const jobs = new Map();
let active = 0;
const queue = [];
const limit = fn => new Promise((resolve, reject) => {
  const run = () => { active++; fn().then(resolve, reject).finally(() => { active--; queue.length && queue.shift()(); }); };
  active < 3 ? run() : queue.push(run);
});

function variants(img) {
  if (!jobs.has(img.key)) {
    jobs.set(img.key, limit(async () => {
      const quality = conf().image_quality || 78;
      const out = new Map();
      const missing = [];
      for (const w of img.widths) {
        const cached = path.join(CACHE_DIR, `${img.key}-${w}-q${quality}.webp`);
        try { out.set(w, await fsp.readFile(cached)); } catch { missing.push(w); }
      }
      if (missing.length) {
        const base = sharp(img.file, { failOn: 'none' }).rotate();
        await fsp.mkdir(CACHE_DIR, { recursive: true });
        for (const w of missing) {
          const data = await base.clone().resize({ width: w, withoutEnlargement: true })
            .webp({ quality, effort: 4, smartSubsample: true }).toBuffer();
          out.set(w, data);
          await fsp.writeFile(path.join(CACHE_DIR, `${img.key}-${w}-q${quality}.webp`), data).catch(() => {});
        }
      }
      return out;
    }));
  }
  return jobs.get(img.key);
}

const variantUrl = (img, w) => `${hexo.config.root}img/v/${img.key}-${w}.webp`;

hexo.extend.generator.register('nir-images', async () => {
  scanned = scan();
  await scanned;
  const routes = [];
  for (const img of images.values()) {
    for (const w of img.widths) {
      routes.push({ path: variantUrl(img, w).slice(hexo.config.root.length), data: () => variants(img).then(m => m.get(w)) });
    }
  }
  return routes;
});

const attr = (tag, name) => {
  const m = tag.match(new RegExp(`\\s${name}\\s*=\\s*("([^"]*)"|'([^']*)'|([^\\s>]+))`, 'i'));
  return decodeEntities(m ? (m[2] ?? m[3] ?? m[4]) : null);
};
const decodeEntities = v => {
  return v && v.replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCharCode(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCharCode(d)).replace(/&quot;/g, '"').replace(/&amp;/g, '&');
};
const setAttr = (tag, name, value) => {
  const re = new RegExp(`\\s${name}\\s*=\\s*("[^"]*"|'[^']*'|[^\\s>]+)`, 'i');
  const piece = value == null ? '' : ` ${name}="${value}"`;
  return re.test(tag) ? tag.replace(re, piece) : tag.replace(/^<img/i, '<img' + piece);
};

function lookup(src, pagePath) {
  if (!src || /^(data:|https?:|\/\/)/i.test(src)) return null;
  let url = src.split(/[?#]/)[0];
  if (!url.startsWith('/')) url = hexo.config.root + path.posix.join(path.posix.dirname('/' + (pagePath || '')), url).slice(1);
  const tryGet = u => { try { return images.get(decodeURI(u)); } catch { return images.get(u); } };
  // Tolerate `assets/x.jpg` written without the leading slash.
  return tryGet(url) || (!src.startsWith('/') && tryGet(hexo.config.root + src.split(/[?#]/)[0])) || null;
}

// Default rendered width of images in a post: the text column is at most ~46rem wide.
const DEFAULT_SIZES = '(min-width: 800px) 736px, calc(100vw - 2rem)';

// Runs once per generated HTML route (after layouts and injectors), so it may be async.
hexo.extend.filter.register('_after_html_render', async function (html, locals) {
  if (!scanned) return html;
  await scanned;
  const pagePath = locals?.path || '';
  // The first image of the article is likely the LCP element: load it eagerly.
  const eagerFrom = html.indexOf('data-first-image');
  let eagerUsed = false;
  return html.replace(/<img\b[^>]*>/gi, (tag, offset) => {
    const src = attr(tag, 'src');
    const img = lookup(src, pagePath);
    if (!img) {
      if (src && EXT.test(src) && !/^(data:|https?:|\/\/)/i.test(src) && !warned.has(src)) {
        warned.add(src);
        hexo.log.warn('[images] %s references a missing image: %s', pagePath, src);
      }
      return tag;
    }
    const sizes = attr(tag, 'data-sizes') || attr(tag, 'sizes') || DEFAULT_SIZES;
    const fallback = img.widths.find(w => w >= 800) || img.widths[img.widths.length - 1];
    let out = setAttr(tag, 'src', variantUrl(img, fallback));
    out = setAttr(out, 'data-sizes', null);
    out = setAttr(out, 'srcset', img.widths.map(w => `${variantUrl(img, w)} ${w}w`).join(', '));
    out = setAttr(out, 'sizes', sizes);
    if (!attr(out, 'width') && !attr(out, 'height')) {
      out = setAttr(out, 'width', img.width);
      out = setAttr(out, 'height', img.height);
    }
    if (attr(out, 'alt') == null) out = setAttr(out, 'alt', '');
    out = setAttr(out, 'decoding', 'async');
    if (!attr(out, 'loading')) {
      if (eagerFrom >= 0 && offset > eagerFrom && !eagerUsed) {
        eagerUsed = true;
        out = setAttr(out, 'loading', 'eager');
        out = setAttr(out, 'fetchpriority', 'high');
      } else out = setAttr(out, 'loading', 'lazy');
    }
    return out;
  // Let clicks open the largest variant instead of the multi-megabyte original.
  }).replace(/(<a\b[^>]*\shref=")([^"]+)("[^>]*>\s*<img)/gi, (m, a, href, b) => {
    const img = lookup(decodeEntities(href), pagePath);
    return img ? a + variantUrl(img, img.widths[img.widths.length - 1]) + b : m;
  });
});

