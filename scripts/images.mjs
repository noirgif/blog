import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import sharp from 'sharp';

const hash = data => crypto.createHash('sha256').update(data).digest('hex').slice(0, 16);
export const ARTICLE_SIZES = '(orientation: landscape) and (max-width: 1200px) 88vw, (min-width: 1000px) 860px, 88vw';
export const CARD_SIZES = '(orientation: portrait) and (max-width: 800px) 88vw, (orientation: portrait) and (hover: none) and (pointer: coarse) 88vw, (orientation: landscape) and (max-width: 1200px) 62vw, (max-width: 1599px) 57vw, (max-width: 1770px) calc(86vw - 464.4px), 903px';
export const PORTRAIT_MEDIA = '(orientation: portrait) and (max-width: 800px), (orientation: portrait) and (hover: none) and (pointer: coarse)';
export const COVER_SIZES = '(orientation: landscape) and (max-width: 1200px) 30vw, (min-width: 1600px) 540px, 34vw';

// All generated media is named after its encoded bytes, so immutable caching is safe.
export function createImagePipeline(sourceDir, outputDir, warn) {
  const cache = new Map();
  const thumbnails = new Map();

  async function write(buffer, extension) {
    const url = `/media/${hash(buffer)}.${extension}`;
    await fs.writeFile(path.join(outputDir, url), buffer);
    return url;
  }

  async function variants(input, widths, { maxWidth, height, quality = 80 } = {}) {
    const sizes = [...new Set(widths.map(width => Math.min(width, maxWidth)))].sort((a, b) => a - b);
    const result = [];
    for (const width of sizes) {
      const resized = await sharp(input, { animated: false }).rotate().resize({
        width,
        ...(height ? { height: Math.round(height(width)), fit: 'cover' } : {}),
        withoutEnlargement: true,
      }).webp({ quality, effort: 4 }).toBuffer({ resolveWithObject: true });
      result.push({ src: await write(resized.data, 'webp'), width: resized.info.width, height: resized.info.height });
    }
    const unique = [...new Map(result.map(image => [image.width, image])).values()];
    const largest = unique.at(-1);
    const fallback = unique.find(image => image.width >= 960) || largest;
    return { src: fallback.src, srcset: unique.map(image => `${image.src} ${image.width}w`).join(', '), width: largest.width, height: largest.height };
  }

  function optimize(src) {
    if (cache.has(src)) return cache.get(src);
    const task = (async () => {
      let relative = src;
      if (relative.startsWith('https://nir.moe/')) relative = new URL(relative).pathname;
      if (relative.startsWith('assets/')) relative = '/' + relative;
      const local = relative.startsWith('/assets/') || relative.startsWith('/media/');
      if (!local) relative = `/media/${hash(src)}.jpg`; // Previously cached remote images; never download at build time.
      const file = path.resolve(sourceDir, '.' + decodeURIComponent(relative));
      if (!file.startsWith(path.resolve(sourceDir) + path.sep)) throw Error('Invalid asset path');
      let input;
      try { input = await fs.readFile(file); }
      catch (error) {
        if (error.code !== 'ENOENT') throw error;
        if (local) warn('Missing/unreadable local image: ' + relative);
        return null;
      }
      const metadata = await sharp(input, { animated: false }).metadata();
      const rotated = metadata.orientation >= 5 && metadata.orientation <= 8;
      const width = rotated ? metadata.height : metadata.width, height = rotated ? metadata.width : metadata.height;
      const maxWidth = Math.max(1, Math.floor(width * Math.min(1, 1800 / width, 1800 / height)));
      const images = await variants(input, [480, 960, 1440, 1800], { maxWidth });
      const tiny = await sharp(input, { animated: false }).rotate().resize({ width: 36, height: 36, fit: 'inside' }).jpeg({ quality: 45 }).toBuffer();
      return { ...images, preview: await write(tiny, 'jpg'), file };
    })();
    cache.set(src, task);
    return task;
  }

  function thumbnail(image) {
    if (thumbnails.has(image.file)) return thumbnails.get(image.file);
    const task = (async () => {
      const input = await fs.readFile(image.file);
      const result = await variants(input, [480, 960, 1440], { maxWidth: Math.min(image.width, Math.floor(image.height * 8 / 5)), height: width => width * 5 / 8, quality: 75 });
      const tiny = await sharp(input, { animated: false }).rotate().resize({ width: 36, height: 23, fit: 'cover' }).jpeg({ quality: 45 }).toBuffer();
      return { ...result, preview: await write(tiny, 'jpg') };
    })();
    thumbnails.set(image.file, task);
    return task;
  }

  async function sidebar(src, avatar = false) {
    const image = await optimize(src);
    if (!image) return null;
    const input = await fs.readFile(image.file);
    if (avatar) return variants(input, [48, 96, 144], { maxWidth: Math.min(image.width, image.height), height: width => width });
    const desktop = await variants(input, [320, 640, 960, 1200], { maxWidth: image.width });
    const mobile = await variants(input, [480, 960], { maxWidth: image.width, height: width => width * 2 / 15, quality: 75 });
    return { ...desktop, mobile };
  }

  return { optimize, thumbnail, sidebar, cache };
}
