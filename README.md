# Goddess Unknown — static Markdown blog

A static reimagining of [nir.moe](https://nir.moe), using Markdown posts from [noirgif/blog](https://github.com/noirgif/blog). The illustrated sidebar retracts while reading a post and returns on other pages, including Back/Forward navigation. In portrait on mobile, a compact header replaces the cover panel, and a menu button opens navigation, the profile, and social links. Landscape phones use the desktop-style side layout, with a sidebar that scrolls independently so all links remain accessible. The desktop sidebar scrolls when the window is short. Continuous navigation remains: clear the old reading area, update the URL, fetch static content, and reveal it as it arrives. Responsive WebP images load natively; images inserted during navigation reveal over tiny previews without replacing an already-rendered image.

Every route has a complete `index.html` generated at build time. Reading posts and following links works without JavaScript. JavaScript adds in-place navigation, search, and progressive image reveals. There is no application server, database, or runtime API.

## Write a post

Requires Node.js 22 or newer.

```sh
bun install --frozen-lockfile
bun run new "A new thought"
```

This creates `source/_posts/a-new-thought.md`. Edit it:

```markdown
---
title: A new thought
date: 2026-10-02 19:30:00
category: diary
tags:
  - life
  - programming
---

Write normal Markdown here.

## A heading

![A photograph](/assets/image/my-photo.jpg)
```

Put local images in `public/assets/image/` and reference them normally in Markdown. **No manual thumbnail step is needed.** Every build automatically generates responsive WebP article images and tiny previews. The first available local image in each published post also gets cropped homepage thumbnails at multiple widths; the browser chooses the appropriate size for its viewport and pixel density. Full article images are not cropped. The first homepage preview is eager-loaded with high priority, while later images load lazily. External images are allowed, but new remote images are displayed directly and do not automatically receive generated variants unless a local copy is already available. Builds never download external content.

Dates without a timezone are interpreted as UTC, matching the migrated timestamps. Explicit `Z` or numeric timezone offsets are supported.

Use a stable filename for the URL: `example.md` becomes `/posts/example/`. Set `slug: another-name` or `permalink: posts/another-name` to override it. Renaming a title leaves the URL unchanged.

```sh
bun run build
bun run check
bun run preview
```

The preview command serves the current build at `http://localhost:4173/`. After editing, rebuild and refresh. Deploy only `dist/`.

### Drafts

```sh
bun run new "An unfinished thought" --draft
```

Files in `source/_drafts/`, posts with `draft: true`, and posts with `published: false` are excluded. Move a draft into `source/_posts/` and remove `draft: true` to publish it. Unpublished Markdown is not copied into the deployed output.

### Photo diaries and existing Hexo posts

The migrated posts retain the original `source/_posts/*.md` writing format. `category` and `categories`, scalar or array `tags`, language metadata, numeric titles, and Hexo excerpt markers are supported. Existing `quote`, `blockquote`, `image`, `img`, `katex`, `codeblock`, `alert`, `raw`, and `iframe` tags are converted during the build.

For a photo diary, use `layout: photo-diary` and group photographs and captions with `<!-- entry -->` and `<!-- /entry -->`, as in `source/_posts/alaska.md`. New posts can use standard Markdown instead.

This project uses its own small static build script, rather than Hexo plugins or themes. Arbitrary Hexo plugins are not supported. Embedded post scripts are removed. The original source repository is not modified.

## Deploy to Cloudflare Pages (primary)

Use Cloudflare Pages **build system v3** and set:

| Setting | Value |
| --- | --- |
| Root directory | Repository root |
| Build command | `bun install --frozen-lockfile && bun run build:cloudflare` |
| Build output directory | `dist` |
| `BUN_VERSION` | `1.4.2` |
| `NODE_VERSION` | `24` |
| `BASE_PATH` | Empty |
| `SITE_URL` | `https://nir.moe` for the production domain, or leave unset to use `CF_PAGES_URL` |

The `.node-version` file records Node 22. The build copies `others/_redirects` into `dist/_redirects`, preserving the RSS redirects from your original repository.

The original Hexo/Tranquilpeak workflow builds the legacy site and publishes `public`. This reimagined project keeps the Markdown writing format but uses its own generator, so use the build command above and publish `dist`. It is a separate project, not a drop-in Tranquilpeak theme.

Connect this repository to your existing Pages project or upload a built `dist` folder. No Pages Functions are needed.

### Free plan only

No paid Cloudflare features are required or configured. The output uses static Pages hosting only: no Functions, Workers, R2, D1, Cloudflare Images, or image transformations. `sharp` optimizes images during the build. `bun run check` enforces a maximum of 20,000 deployed files and 25 MiB per asset, the Pages Free limits. The free account also has 500 builds per month, one concurrent build, and a 20-minute build timeout. See [Cloudflare Pages limits](https://developers.cloudflare.com/pages/platform/limits/) and [build system versions](https://developers.cloudflare.com/pages/configuration/build-image/).

## Deploy to GitHub Pages (optional)

1. Put this project's files in your GitHub repository, including `.github/workflows/pages.yml` and its lockfile.
2. In **Settings → Pages → Build and deployment**, choose **GitHub Actions**.
3. Push to `main` or `master`, or run **Publish static blog to GitHub Pages** from the Actions tab.

The workflow installs dependencies, builds, checks all generated routes, and deploys `dist/`. It reads the Pages URL and base path automatically. A project site such as `https://noirgif.github.io/blog/` gets `/blog` URLs; an account site or a custom domain gets root URLs. No SPA redirects or 404 routing workaround is required.

To check the project-path build locally:

```sh
BASE_PATH=/blog SITE_URL=https://noirgif.github.io bun run build
bun run check
bun run preview
```

Open `http://localhost:4173/blog/`. Then run `bun run build` again to restore a root-path build.

## Deploy to Netlify

Connect the repository to Netlify. The included `netlify.toml` sets:

- Build command: `bun run build && bun run check`
- Publish directory: `dist`
- Node.js: `22`
- Base path: root

Netlify supplies its site URL at build time. You can override `SITE_URL` for a custom canonical URL. For manual deployment, build locally and upload the contents of `dist/`.

No serverless functions or catch-all redirects are used. Each deep link has its own static HTML file.

## Configure and customize

- `site.config.json`: title, author, description, cover, avatar, homepage post count, optional canonical URL, and base path.
- `source/_posts/`: Markdown articles.
- `source/about/index.md`, `source/links/index.md`: Markdown pages. Add another `source/page-name/index.md` for another static page.
- `public/`: source image assets.
- `theme/index.html`: shared page shell and navigation.
- `theme/style.css`: styles.
- `theme/app.js`: optional browser enhancements.
- `scripts/build.mjs`: Markdown-to-HTML generation, archives, tags, categories, RSS, sitemap, minification, and content-hashed assets.
- `scripts/images.mjs`: automatic responsive article images, cropped card thumbnails, sidebar variants, and tiny previews.
- `scripts/check.mjs`: generated routes, responsive image widths, content hashes, loading priorities, and local asset checks.
- `dist/`: generated deployable files. Do not edit these by hand.

Set `SITE_URL` (origin only, such as `https://nir.moe`) to generate canonical links and `sitemap.xml`. RSS is generated on every build; setting `SITE_URL` makes its links absolute. `BASE_PATH` overrides `site.config.json`'s `basePath`.

### Loading and caching

The initial page is complete static HTML with minified styles inlined, so rendering does not wait for a stylesheet request or navigation data. DM Sans and Playfair Display are self-hosted Latin-only variable fonts with `font-display: optional`; Chinese text uses system fonts. Font licenses are included in `dist/licenses/`. KaTeX styles load only on math pages, including when navigating to them without a full reload.

Navigation fetches a small metadata manifest on demand. The full-text search index is downloaded only when Search is opened, and reused for subsequent searches. Initial pages never replace their real images with tiny previews.

Generated media, JavaScript, fonts, and JSON/NDJSON have content-hashed URLs. `dist/_headers` enables one-year immutable caching for those assets on Cloudflare Pages and Netlify; HTML keeps the hosting platform's normal revalidation behavior. GitHub Pages controls its own HTTP cache headers. The preview server supports Brotli/gzip, ETags, and the same asset-versus-HTML cache policy. Production compression is supplied by the static host.

The Sites publication uses `.openai/hosting.json`. That manifest is unnecessary for GitHub Pages or Netlify and is omitted from the portable download.

## Credits

Words by NoirGif, under [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/) unless individually specified. Cover illustration by [swd3e2](https://twitter.com/swd3e22). Image rights remain with their respective owners. The original source attribution remains in the site footer.

The Alaska source references `img_1766735192363.jpg`, which is absent from the original repository. The generated page shows an unavailable-image notice rather than a broken image.

Search accepts a word or phrase and highlights matching titles, paragraphs, and tags. Each post ends with one related entry, ranked by shared tags, then category and date when tags do not overlap. Its preview is the first sentence. Portrait pages retain a compact sticky return bar; landscape phones retain the scrollable side navigation.
