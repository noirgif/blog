# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a personal blog built with Hexo (v8), using the in-repo `themes/nir` theme (a lightweight reimagining of the old Tranquilpeak look). The blog is multilingual (English and Chinese) and deployed to GitHub Pages at nir.moe and noirgif.github.io.

## Common Commands

### Development
```bash
# Generate static files
hexo generate
# or shorthand
hexo g

# Start local server (default: http://localhost:4000)
hexo server
# or shorthand
hexo s

# Clean generated files and cache
hexo clean

# Create a new post
hexo new "Post Title"

# Create a new draft
hexo new draft "Draft Title"

# Publish a draft (moves from _drafts to _posts)
hexo publish "Draft Title"
```

### Deployment (legacy GitHub Pages)
```bash
# Deploy to GitHub Pages (configured for git@github.com:noirgif/noirgif.github.io)
hexo deploy
# or shorthand
hexo d

# Generate and deploy
hexo g -d
```

### Cloudflare Pages build
```bash
bun install --frozen-lockfile && bun run build:cloudflare   # hexo clean + generate into dist/ + tools/check.mjs
```
Use **bun** (lockfile `bun.lock`). Output directory is `dist/` (`public_dir` in `_config.yml`).

## Architecture

### Directory Structure
- `source/_posts/` - Published blog posts (Markdown files)
- `source/_drafts/` - Draft posts not yet published
- `source/_data/` - Per-language configuration files (`config_en.yml`, `config_zh-cn.yml`)
- `scaffolds/` - Templates for new posts, pages, drafts, and diary entries
- `themes/nir/` - The site theme
- `tools/check.mjs` - Post-build sanity checks
- `dist/` - Generated static files (git-ignored)

### Multilingual Support
The blog uses `per-post `lang:` front matter for i18n (feeds at `/en/rss.xml`, `/zh-cn/rss.xml`). Language-specific configurations are in:
- `source/_data/config_en.yml` - English configuration
- `source/_data/config_zh-cn.yml` - Chinese configuration

Posts can specify language in their front matter. The main site language is configured in `_config.yml` with `language: [en, zh-cn]`.

### Content Features
- **Math support**: KaTeX and MathJax are configured for mathematical equations
- **Search**: local, client-side over `/search.json` (generated at build time), with match highlighting
- **Comments**: giscus (GitHub Discussions of noirgif/blog)
- **Custom tags**: `{% image %}` and `{% alert %}` (in `themes/nir/scripts/content.js`); KaTeX renders to MathML at build time

### Theme (`themes/nir`)
- `layout/` — EJS templates; `layout/_partial/` for sidebar, topbar, cards, comments, search dialog
- `assets/` — `style.css` (minified and inlined into every page), `app.js` (PJAX navigation with View Transitions, search, giscus, lightbox), `snow.js` (loaded on demand), `giscus.css`
- `scripts/assets.js` — esbuild minification + fingerprinted URLs (`/js/*.<hash>.js`), `t()`/`icon()` helpers
- `scripts/fonts.js` — serif CJK webfonts: per-page subsets (`/fonts/`) of Clear Han Serif with Noto Serif CJK SC Black as its bold (Chinese) or Noto Serif CJK JP (`lang: ja-jp`), chosen by post `lang:`, loaded after first paint; source fonts are downloaded once (pinned + checksummed) into `.cache/fonts`
- `scripts/images.js` — build-time WebP variants (`/img/v/`) for local images and `<img>` rewriting (srcset, width/height, lazy loading); cached in `.cache/images`
- `scripts/content.js` — `alert`/`image` tags, excerpt and photo-diary filters, `search.json`, per-language feeds, `_headers`, `_redirects`, `404.html`, `robots.txt`
- `_config.yml` — menu, avatar/cover, giscus settings; `languages/` — UI strings

### Rendering
- **Markdown**: Uses `hexo-renderer-markdown-it` with plugins for footnotes and abbreviations
- **Syntax highlighting**: highlight.js at build time (colors in the theme stylesheet)
- **Asset post folder**: Enabled (`post_asset_folder: true`) - each post can have its own asset folder

### Content Generation
- Index: 5 posts per page
- Archives: 3 posts per page (yearly and monthly views enabled)
- Categories/Tags: 5 posts per page
- RSS feed: Available at `/rss-all.xml` (20 posts limit)

### Deployment Configuration
The site deploys to:
- Primary: GitHub repository `git@github.com:noirgif/noirgif.github.io` (master branch)
- Uses `hexo-deployer-git` plugin
- Cloudflare Pages badge indicates possible Cloudflare Pages deployment as well

## Important Notes

- The blog posts are primarily in Chinese and English
- Scaffolds include templates for `post`, `page`, `draft`, and `diary`
- The snow easter egg (`themes/nir/assets/snow.js`) descends from the soul-plus/Tranquilpeak snow script
- Local images are optimized automatically; no CDN needed
- Favicon is `themes/nir/source/favicon.ico`, cover/avatar are in `themes/nir/source/img/`
