/* global hexo */
'use strict';

// Minifies and fingerprints the theme's CSS/JS so they can be cached forever,
// and exposes helpers to reference (or inline) them from the layouts.

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const esbuild = require('esbuild');

const ASSET_DIR = path.join(hexo.theme_dir, 'assets');
const TARGET = ['chrome100', 'firefox100', 'safari15.4'];
const built = { css: {}, urls: {} };
const PAGE_CSS = { home: ['home'], list: ['list', 'home'], post: ['post'], page: ['post', 'list'], 'not-found': ['post'] };

const hash = data => crypto.createHash('sha256').update(data).digest('hex').slice(0, 10);

async function buildAssets() {
  const routes = [];
  built.urls = {};

  // Stylesheets are small enough to inline; this removes render-blocking requests.
  // `core` goes into every page, the rest only into the page types that use them.
  built.css = {};
  for (const name of ['core', 'home', 'list', 'post']) {
    const css = await esbuild.transform(fs.readFileSync(path.join(ASSET_DIR, 'css', name + '.css'), 'utf8'), {
      loader: 'css', minify: true, target: TARGET, legalComments: 'none'
    });
    built.css[name] = css.code.trim();
  }

  // app.js is built last so it can embed the fingerprinted URLs of the on-demand assets.
  for (const name of ['snow.js', 'giscus.css', 'app.js']) {
    const file = path.join(ASSET_DIR, name);
    const ext = path.extname(name).slice(1);
    const code = ext === 'js'
      ? (await esbuild.build({
        entryPoints: [file], bundle: true, write: false, format: 'esm', minify: true,
        target: TARGET, legalComments: 'none', platform: 'browser', external: ['/js/*'],
        define: {
          __SNOW_URL__: JSON.stringify(built.urls['snow.js'] || ''),
          __GISCUS_CSS__: JSON.stringify(built.urls['giscus.css'] || '')
        }
      })).outputFiles[0].text
      : (await esbuild.transform(fs.readFileSync(file, 'utf8'), { loader: 'css', minify: true, target: TARGET })).code;
    const url = `${ext}/${path.basename(name, '.' + ext)}.${hash(code)}.${ext}`;
    built.urls[name] = hexo.config.root + url;
    routes.push({ path: url, data: code });
  }
  return routes;
}

hexo.extend.generator.register('nir-assets', buildAssets);

hexo.extend.helper.register('inline_css', (kind = 'core') =>
  kind === 'core' ? built.css.core : (PAGE_CSS[kind] || []).map(k => built.css[k]).join(''));
hexo.extend.helper.register('asset', name => built.urls[name]);

// UI strings always use the site language, so the persistent chrome does not
// switch language when a post written in another language is opened.
hexo.extend.helper.register('t', function (key, ...args) {
  return hexo.theme.i18n.__(hexo.config.language?.[0] || 'en')(key, ...args);
});

// Inline SVG icons (no icon font, no extra request).
const ICONS = {
  home: '<path d="M3 11 12 3l9 8"/><path d="M5 9.5V21h5v-6h4v6h5V9.5"/>',
  bookmark: '<path d="M6 3h12v18l-6-4-6 4z"/>',
  tag: '<path d="M3 3h8l10 10-8 8L3 11z"/><circle cx="7.5" cy="7.5" r="1.5"/>',
  archive: '<rect x="3" y="4" width="18" height="4" rx="1"/><path d="M5 8v12h14V8M10 12h4"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/>',
  help: '<circle cx="12" cy="12" r="9"/><path d="M9.5 9.5a2.5 2.5 0 1 1 3.5 2.3c-.6.3-1 .9-1 1.6V14"/><path d="M12 17.5v.01"/>',
  link: '<path d="M10 14a4.5 4.5 0 0 0 6.4 0l3-3a4.5 4.5 0 0 0-6.4-6.4l-1 1"/><path d="M14 10a4.5 4.5 0 0 0-6.4 0l-3 3a4.5 4.5 0 0 0 6.4 6.4l1-1"/>',
  github: '<path d="M9 19c-4 1.3-4-2-6-2.5M15 21v-3.5c0-1 .1-1.4-.5-2 2.8-.3 5.5-1.4 5.5-6a4.7 4.7 0 0 0-1.3-3.2 4.3 4.3 0 0 0-.1-3.2s-1-.3-3.4 1.3a11.6 11.6 0 0 0-6.2 0C6.6 2.8 5.6 3.1 5.6 3.1a4.3 4.3 0 0 0-.1 3.2A4.7 4.7 0 0 0 4.2 9.5c0 4.6 2.7 5.7 5.5 6-.6.6-.6 1.2-.5 2V21"/>',
  rss: '<path d="M4 11a9 9 0 0 1 9 9M4 4a16 16 0 0 1 16 16"/><circle cx="5" cy="19" r="1"/>',
  menu: '<path d="M4 6h16M4 12h16M4 18h16"/>',
  close: '<path d="M6 6l12 12M18 6 6 18"/>',
  snow: '<path d="M12 2v20M3.3 7l17.4 10M3.3 17 20.7 7"/><path d="m9 4 3 2 3-2M9 20l3-2 3 2M4.2 10.5l3.4-.5-1-3.3M19.8 13.5l-3.4.5 1 3.3M4.2 13.5l3.4.5-1 3.3M19.8 10.5l-3.4-.5 1-3.3"/>',
  back: '<path d="M15 5 8 12l7 7"/>',
  next: '<path d="m9 5 7 7-7 7"/>',
  up: '<path d="m5 15 7-7 7 7"/>',
  down: '<path d="m5 9 7 7 7-7"/>'
};
hexo.extend.helper.register('icon', (name, cls = '') =>
  `<svg class="icon ${cls}" viewBox="0 0 24 24" aria-hidden="true" focusable="false">${ICONS[name] || ''}</svg>`);
