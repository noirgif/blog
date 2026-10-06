# AGENTS.md

Guidance for coding agents working in this repository. `CLAUDE.md` has the wider project
overview (directory layout, multilingual setup, deployment targets); this file covers how to
build and run the site, and the performance rules every change must keep.

## Build and run

Requirements: Node ≥ 22 (`.node-version`) and **bun ≥ 1.4**. `bun.lock` is a v2 lockfile, which
bun 1.3 cannot read (`UnknownLockfileVersion`); if the installed bun is older, run it as
`npx -y bun@latest` instead of upgrading globally.

```sh
bun install --frozen-lockfile   # install exactly what bun.lock pins
bun run build:cloudflare        # hexo clean + hexo generate into dist/ + tools/check.mjs
bun run build                   # same, without the checks
bun run check                   # run tools/check.mjs against an existing dist/
npx hexo server                 # dev server at http://localhost:4000 (-p to change the port)
npx hexo new "Post Title"       # new post; `hexo new draft` / `hexo publish` for drafts
```

- `bun run build:cloudflare` is what Cloudflare Pages runs, so it is the command to verify a
  change with. It must end with `Checked N HTML pages and M files: OK`. `tools/check.mjs` fails
  the build when a required file is missing, a page lacks its inlined stylesheet, or a page
  references a `/js/`, `/css/`, `/img/` or `/fonts/` URL that was not generated.
- The first build on a clean machine downloads the CJK source fonts (about 100 MB, pinned and
  checksummed) into `.cache/fonts` and encodes every WebP variant into `.cache/images`; expect
  a minute or two. Later builds reuse `.cache/` and take seconds. Never commit `.cache/` or
  `dist/` (both are git-ignored), and delete `.cache/` only when a cache is actually stale.
- `hexo generate` rewrites `"hexo": { "version" }` and the formatting of `package.json`. Revert
  that churn (`git checkout package.json`) unless the change is about dependencies.
- `hexo server` renders on request from `source/` and does not use `dist/`; use it for quick
  visual checks, and the full build for anything that ships.
- Legacy GitHub Pages deploy: `npx hexo deploy` (pushes to `noirgif/noirgif.github.io`). Do not
  run it unless asked.

## Performance designs to uphold

The bar for every change: **no layout shift (CLS 0), no actionable Lighthouse findings
(performance 100), and no JavaScript on the critical path.** The page must render and read
fully before any script runs, and must work with JS disabled. When a change touches layout,
fonts, images or scripts, check it against the rules below and run a Lighthouse pass on a
built page (`dist/`, served statically) before calling it done.

### CSS: inlined, split per page type
- `themes/nir/scripts/assets.js` minifies `themes/nir/assets/css/*.css` with esbuild and the
  layout inlines it into `<style>` tags (`inline_css()` in `layout/layout.ejs`): `core.css` on
  every page, plus `home`/`list`/`post` only on the page kinds that use them (`PAGE_CSS`). There
  is no render-blocking stylesheet request.
- Keep it that way: no `<link rel="stylesheet">` for site CSS, no CSS framework, no web font for
  Latin text (system font stacks only). Put new rules in the narrowest file that needs them;
  only truly global rules belong in `core.css`, since it ships in every page.

### Icons: inline SVG
- Icons come from the `ICONS` map in `scripts/assets.js` via the `icon()` helper and are inlined
  as `<svg>`. No icon fonts, sprite requests or icon libraries. Add new icons as paths there.

### JavaScript: off the critical path
- `assets/app.js` is bundled, minified and fingerprinted (`/js/app.<hash>.js`, cached
  immutably via `_headers`). The layout injects it only after `load`, two animation frames and a
  `setTimeout`, as a low-priority module, so it never competes with first render.
- Do not add `<script src>` tags in `<head>` or before content, synchronous inline scripts that
  do real work, or third-party scripts on load. Large or rarely used features load on demand
  (`snow.js` is fetched only when the easter egg is triggered; its URL is injected through an
  esbuild `define`).
- Page navigation is a pjax-style swap of `<main>` (`fetchPage`/`navigate` in `app.js`) with
  View Transitions when available and reduced-motion respected. Pages are prefetched on intent
  (hover after 60 ms, touchstart, focus) and kept in a small cache. Plain links must still work
  without JS: never make navigation depend on the script.

### Search and comments: lazy
- `/search.json` is generated at build time (`scripts/content.js`) and fetched only when search
  is first opened (`loadIndex` in `app.js`). Keep it out of the initial page load.
- Giscus is loaded only after the visitor first interacts (pointer, key, wheel or touch) *and*
  the comments section comes within 300 px of the viewport. The `.comments` block reserves
  `min-height` so the iframe does not push content around. Do not load third-party embeds on
  page load.

### Images: WebP srcset with intrinsic sizes
- `scripts/images.js` turns every local JPEG/PNG/WebP (`source/assets/`, post asset folders,
  `themes/nir/source/img/`) into resized WebP variants (`/img/v/`, card thumbnails cropped to
  4:3 under `/img/t/`) and rewrites each `<img>` with `srcset`, `sizes`, intrinsic
  `width`/`height`, `decoding="async"` and `loading="lazy"`. The first image in an article (the
  likely LCP element) gets `loading="eager"` and `fetchpriority="high"` instead.
- Authors keep writing plain Markdown images or `{% image %}`; do not hand-write `srcset` or add
  an image CDN. Every image must end up with dimensions or a CSS `aspect-ratio` box (as card
  thumbnails do) so it reserves its space before it loads. Links to originals are rewritten to
  the largest variant, never the multi-megabyte source.

### CJK webfonts: subset per page, swapped without shift
- `scripts/fonts.js` subsets a serif CJK font per page to exactly the characters that page
  uses (by weight, chosen by the post's `lang:`), encodes WOFF2, and emits `@font-face` rules
  with `unicode-range`. List pages share one small subset of category/tag names and the title.
  Source fonts are pinned by version and SHA-256; keep them pinned when changing fonts.
- The faces cover only characters that every CJK font sets 1 em wide, never spaces or Latin
  text, so they are never a line's primary font: line heights come from the Latin face, and
  swapping from the system CJK font to the webfont moves nothing.
- The font CSS starts as `media="print"` and is enabled (with preloads) only after both first
  contentful paint and `load`, so fonts never sit on the LCP path. Keep that order, and keep the
  shift-free property when switching fonts or ranges: re-check CLS on a Chinese and a Japanese
  post.

### Math and code: rendered at build time
- KaTeX renders to MathML at build time (`_config.yml`), and highlight.js runs at build time
  with colors in the theme stylesheet. Pages ship no math or highlighting CSS, fonts or JS.

### Layout stability
- Anything that can change size after first paint must reserve its space up front: images
  (above), comments (`min-height`), card thumbnails (`aspect-ratio`), and controls whose labels
  differ by page or language. Pagination is the reference: the older/newer buttons share a
  `min-width` in a `1fr auto 1fr` grid and the page counter uses `tabular-nums`, so the bar
  does not shift between pages or languages.
- UI chrome uses the site language (`t()` helper) rather than the post's language, so the
  persistent sidebar and top bar do not reflow when a post in another language opens.

### Caching
- Fingerprinted `/js/`, `/css/`, `/img/` and `/fonts/` URLs are served `immutable` for a year
  (`_headers` in `scripts/content.js`). Anything added under those paths must have a
  content hash in its name; unhashed files go elsewhere with a short cache lifetime.
