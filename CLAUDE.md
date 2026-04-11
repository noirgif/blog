# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a personal blog built with Hexo (v7.3.0), using the Tranquilpeak theme. The blog is multilingual (English and Chinese) and deployed to GitHub Pages at nir.moe and noirgif.github.io.

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

### Deployment
```bash
# Deploy to GitHub Pages (configured for git@github.com:noirgif/noirgif.github.io)
hexo deploy
# or shorthand
hexo d

# Generate and deploy
hexo g -d
```

### Search Indexing
```bash
# Index posts on Algolia search
hexo algolia
```

### Theme Development
The theme is located in `themes/tranquilpeak/` (see `themes/tranquilpeak/CLAUDE.md` for detail). Prefer **pnpm** in that directory; the theme repo ships `pnpm-lock.yaml`:
```bash
cd themes/tranquilpeak
pnpm install
pnpm start              # Dev build + Grunt watch
pnpm run grunt -- build # One-shot dev build (Grunt `build`)
pnpm run build          # Production build (Grunt `buildProd`; minified assets)
```

## Architecture

### Directory Structure
- `source/_posts/` - Published blog posts (Markdown files)
- `source/_drafts/` - Draft posts not yet published
- `source/_data/` - Per-language configuration files (`config_en.yml`, `config_zh-cn.yml`)
- `scaffolds/` - Templates for new posts, pages, drafts, and diary entries
- `themes/tranquilpeak/` - The Tranquilpeak theme (customized fork)
- `public/` - Generated static files (git-ignored)

### Multilingual Support
The blog uses `hexo-multilingual` plugin for i18n support. Language-specific configurations are in:
- `source/_data/config_en.yml` - English configuration
- `source/_data/config_zh-cn.yml` - Chinese configuration

Posts can specify language in their front matter. The main site language is configured in `_config.yml` with `language: [en, zh-cn]`.

### Content Features
- **Math support**: KaTeX and MathJax are configured for mathematical equations
- **Search**: Algolia search integration with app ID "4VZ5FRVLMP"
- **Comments**: Disqus integration (shortname: noirina-moe)
- **Custom tags**: The theme provides custom tags for images, videos, alerts, tabbed code blocks, and more (in `themes/tranquilpeak/scripts/tags/`)

### Theme Customization
The Tranquilpeak theme is customized with:
- Custom helpers in `themes/tranquilpeak/scripts/helpers/`
- Custom filters in `themes/tranquilpeak/scripts/filters/`
- Custom tags for enhanced content formatting
- Theme configuration in `themes/tranquilpeak/_config.yml`

### Rendering
- **Markdown**: Uses `hexo-renderer-markdown-it` with plugins for footnotes and abbreviations
- **Syntax highlighting**: Uses highlight.js (v11.10.0)
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
- The theme has custom snow effect JavaScript (attributed to soul-plus theme)
- Image assets should use CDN for better performance (as recommended in theme config)
- Favicon is `neptune.ico`, cover image is `cover.jpg`
