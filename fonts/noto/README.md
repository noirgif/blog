# Pinned Google Noto sources

These sources were obtained from **Google Fonts**, not GitHub. Google's official
family download manifests identify the versioned `fonts.gstatic.com` URLs:

- <https://fonts.google.com/download/list?family=Noto%20Serif>
- <https://fonts.google.com/download/list?family=Noto%20Serif%20SC>
- <https://fonts.google.com/download/list?family=Noto%20Serif%20KR>

`manifest.json` records each upstream URL, the original file's SHA-256, the
vendored file's SHA-256, its font version, and its OFL license. The full Latin
and SC sources are losslessly recompressed from Google's variable OpenType
files to WOFF2. The KR source is subsetted to **all supported Hangul characters
only**; it cannot supply Korean regional Han shapes. Font designs and glyph
metrics are not edited. The original copyright notices and complete SIL Open
Font Licenses are retained alongside the sources and copied into deployment.

The source files are build inputs, **not deployment assets**. Builds are offline
with respect to fonts: `scripts/fonts.mjs` automatically creates content-hashed
WOFF2 subsets covering the published site's text, titles, tags, categories,
excerpts, search snippets, navigation, and ordinary Latin/generated UI text.
Drafts do not influence these subsets. A local cache under
`.sites-runtime/font-cache/` avoids repeating unchanged subsetting work.

Reading follows [Google's recommended Noto family order](https://fonts.google.com/noto/use#use-noto-fonts-as-web-fonts):

```css
font-family: 'Noto Serif', 'Noto Serif SC', 'Noto Serif KR', 'Songti SC', 'SimSun', serif;
```

Noto Serif supplies Latin, Greek, Cyrillic, digits, and shared punctuation, with
matching real Latin italics. SC supplies Han/kanji, kana, and regional CJK
punctuation. KR supplies Hangul only, needed because Google's SC distribution
omits five Hangul syllables already present in this journal. The checks enforce
one SC Han variant, published reading-glyph coverage, and one-em Han/kana
advances. Noto KR's intentionally proportional Hangul design is preserved.
Emoji, decorative icons, code, and KaTeX keep their appropriate system or
specialized fonts. Already-encoded half-width text is not silently rewritten.

Latin subsets keep normal width and weights 400–700. CJK subsets retain the
native 200–900 weight axis because HarfBuzz cannot partially instance CFF2.
Only horizontal reading/shaping/kerning features are retained for CJK: width
alternates, vertical forms, and optional alternate glyphs are discarded. CSS
also disables `hwid`, `pwid`, `palt`, `halt`, and `chws` and removes negative
tracking from reading headings.

To update a source, obtain the intended version from Google's official family
download manifest, retain its supplied OFL, recompress the original font (or
retain Hangul-only coverage for KR), and update both checksums and provenance in
`manifest.json`. Source updates are explicit; ordinary site builds never fetch
fonts or follow a mutable upstream URL.
