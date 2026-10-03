import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import subsetFont from 'subset-font';
import { create } from 'fontkit';

const digest = value => crypto.createHash('sha256').update(value).digest('hex');
const cjk = /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Hangul}\p{Script=Bopomofo}]/u;
const readingGlyph = /[\p{L}\p{N}\p{P}\p{M}]/u;
const ignorable = /\p{Default_Ignorable_Code_Point}/u;
const decorative = /[\u2600-\u27BF]/u;
const hangul = /\p{Script=Hangul}/u;
const description = character => `${character} (U+${character.codePointAt(0).toString(16).toUpperCase()})`;

export function readingCharacters(texts) {
  // Keep ordinary Latin text, generated dates, and a small multilingual test sample.
  const characters = new Set(Array.from({ length: 95 }, (_, index) => String.fromCodePoint(index + 32)));
  for (const text of ['中文漢字かなカナ', ...texts]) {
    for (const character of String(text)) if (!/[\p{Cc}\p{Cs}]/u.test(character)) characters.add(character);
  }
  return [...characters].sort((a, b) => a.codePointAt(0) - b.codePointAt(0));
}

export function assertReadingCoverage(fonts, characters) {
  const normal = fonts.filter(face => face.style === 'normal');
  const missing = characters.filter(character => !ignorable.test(character) && !decorative.test(character) && readingGlyph.test(character) && !normal.some(face => face.font.hasGlyphForCodePoint(character.codePointAt(0))));
  assert.equal(missing.length, 0, `Reading fonts lack published glyphs: ${missing.slice(0, 20).map(description).join(', ')}. Add an appropriate licensed Noto source; do not silently mix CJK regional fonts.`);
  const regional = normal.find(face => face.family === 'Noto Serif SC');
  assert(regional, 'Missing the single SC regional reading face');
  for (const character of characters.filter(character => cjk.test(character))) {
    const codePoint = character.codePointAt(0);
    const face = hangul.test(character) ? normal.find(face => face.font.hasGlyphForCodePoint(codePoint)) : regional;
    assert(face?.font.hasGlyphForCodePoint(codePoint), `Reading font lacks ${description(character)}`);
    // Explicit half-width text and combining/conjoining marks are not rewritten.
    if (codePoint >= 0xff61 && codePoint <= 0xffdc) continue;
    // Noto Serif KR intentionally uses proportional Hangul; preserve its design.
    if (hangul.test(character) || /\p{M}/u.test(character)) continue;
    assert.equal(face.font.glyphForCodePoint(codePoint).advanceWidth, face.font.unitsPerEm, `CJK glyph must occupy one em: ${description(character)}`);
  }
}

export async function createReadingFonts(texts, out) {
  const directory = path.resolve('fonts/noto');
  const manifest = JSON.parse(await fs.readFile(path.join(directory, 'manifest.json'), 'utf8'));
  const characters = readingCharacters(texts), sources = [];
  for (const entry of manifest) {
    assert.equal(new URL(entry.source).hostname, 'fonts.gstatic.com', 'Noto fonts must come from Google');
    const buffer = await fs.readFile(path.join(directory, entry.file));
    assert.equal(digest(buffer), entry.sha256, `Noto source checksum mismatch: ${entry.file}`);
    const font = create(buffer);
    if (entry.family === 'Noto Serif KR') assert(font.characterSet.every(codePoint => codePoint === 0xffff || hangul.test(String.fromCodePoint(codePoint))), 'KR source must be Hangul-only, never another regional Han face');
    sources.push({ ...entry, buffer, font });
    await fs.copyFile(path.join(directory, entry.license), path.join(out, 'licenses', entry.license));
  }
  assertReadingCoverage(sources, characters);
  const primary = sources.find(face => face.family === 'Noto Serif' && face.style === 'normal').font;
  const version = JSON.parse(await fs.readFile('node_modules/subset-font/package.json', 'utf8')).version;
  const cache = path.resolve('.sites-runtime/font-cache');
  await fs.mkdir(cache, { recursive: true });
  const faces = [], generated = [];
  for (const source of sources) {
    const text = characters.filter(character => source.font.hasGlyphForCodePoint(character.codePointAt(0)) && (source.family !== 'Noto Serif SC' || !primary.hasGlyphForCodePoint(character.codePointAt(0)))).join('');
    if (!text) continue;
    const options = { targetFormat: 'woff2', preserveNameIds: [0, 7, 8, 9, 11, 13, 14] };
    // Reading is horizontal: discard width alternates and vertical/alternate glyphs.
    // Keep normal shaping/kerning, and never introduce another regional Han shape.
    if (source.family !== 'Noto Serif') options.keepFeatures = ['ccmp', 'rlig', 'liga', 'calt', 'kern'];
    // CFF2 CJK retains its native 200–900 axis; HarfBuzz does not partially instance it.
    // Latin gets normal width and the weights used by the reading area.
    if (source.family === 'Noto Serif') options.variationAxes = { wdth: 100, wght: { min: 400, max: 700, default: 400 } };
    const key = digest(JSON.stringify({ source: source.sha256, text, options, version }));
    const cached = path.join(cache, key + '.woff2');
    let buffer;
    try { buffer = await fs.readFile(cached); } catch (error) { if (error.code !== 'ENOENT') throw error; }
    if (!buffer) { buffer = await subsetFont(source.buffer, text, options); await fs.writeFile(cached, buffer); }
    const slug = source.family.toLowerCase().replaceAll(' ', '-') + (source.style === 'italic' ? '-italic' : '');
    const src = `/static/${slug}-${digest(buffer).slice(0, 16)}.woff2`;
    await fs.writeFile(path.join(out, src), buffer);
    faces.push({ family: source.family, style: source.style, weight: source.weight, src, bytes: buffer.length });
    generated.push({ ...source, font: create(buffer) });
  }
  assertReadingCoverage(generated, characters);
  // Ensure emphasis never falls back to an unrelated Latin font.
  const regular = generated.find(face => face.family === 'Noto Serif' && face.style === 'normal').font;
  const italic = generated.find(face => face.family === 'Noto Serif' && face.style === 'italic').font;
  for (const character of characters.filter(character => !ignorable.test(character) && readingGlyph.test(character) && regular.hasGlyphForCodePoint(character.codePointAt(0)))) {
    assert(italic.hasGlyphForCodePoint(character.codePointAt(0)), `Italic Noto Serif lacks ${description(character)}`);
  }
  return { faces, characters: characters.length, cjkCharacters: characters.filter(character => cjk.test(character)).length };
}
