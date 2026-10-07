/* global hexo */
'use strict';

// Content helpers, tag plugins kept from Tranquilpeak, and small generators
// (search index, per-language feeds, Cloudflare Pages headers/redirects, 404).

const { escapeHTML, stripHTML } = require('hexo-util');

const langOf = item => String(item.lang || hexo.config.language?.[0] || 'en').trim().toLowerCase();

const plain = html => stripHTML(String(html || '')
  .replace(/<math[\s\S]*?<\/math>/gi, ' ')
  .replace(/<(script|style|template)[\s\S]*?<\/\1>/gi, ' ')
  .replace(/<\/(p|div|li|h\d|blockquote|pre|tr|section|figure)>/gi, ' $&'))
  .replace(/&nbsp;/g, ' ').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"')
  .replace(/&#39;/g, "'").replace(/&amp;/g, '&')
  .replace(/\s+/g, ' ').trim();

// Cloudflare Pages builds every pushed branch as a preview; only the production branch should be indexed.
// Cloudflare already sends `X-Robots-Tag: noindex` on preview URLs, this makes the build itself say so too.
const productionBranch = process.env.PRODUCTION_BRANCH || 'master';
const isPreview = process.env.CF_PAGES === '1' && !!process.env.CF_PAGES_BRANCH && process.env.CF_PAGES_BRANCH !== productionBranch;
hexo.extend.helper.register('is_preview_build', () => isPreview);

// ---------- tag plugins used by existing posts ----------

// {% alert [classes] %}markdown{% endalert %}
hexo.extend.tag.register('alert', (args, content) => {
  const classes = args.filter(a => /^[\w-]+$/.test(a)).join(' ');
  return `<div class="alert ${classes}">${hexo.render.renderSync({ text: content, engine: 'markdown' })}</div>`;
}, { ends: true });

// {% lyrics %}lyric lines\n---\nmarkdown note\n===\nnext row…{% endlyrics %}
// Two columns: lyrics on the left (line breaks kept), commentary on the right; stacked on narrow screens.
// Rows are separated by a line of `===`, a row's lyrics and note by a line of `---` (the note is optional).
hexo.extend.tag.register('lyrics', (args, content) => {
  const rows = content.trim().split(/^[ \t]*===[ \t]*$/m).map(row => {
    const [lyric, ...note] = row.split(/^[ \t]*---[ \t]*$/m);
    const lines = lyric.trim().split(/\r?\n/).map(l => hexo.render.renderSync({ text: l.trim(), engine: 'markdown' })
      .trim().replace(/^<p>([\s\S]*)<\/p>$/, '$1'));
    const body = note.join('---').trim();
    return `<div class="lyrics-row"><p class="lyrics-text">${lines.join('<br>')}</p>` +
      (body ? `<div class="lyrics-note">${hexo.render.renderSync({ text: body, engine: 'markdown' })}</div>` : '') + '</div>';
  });
  return `<div class="lyrics">${rows.join('')}</div>`;
}, { ends: true });

// {% image [classes] [group:name] /path/to/image [thumbnail] [width] [height] [title text] %}
hexo.extend.tag.register('image', args => {
  args = [...args];
  const classes = [];
  while (args.length > 1 && /^[\w-]+$/.test(args[0]) && !/\.\w{2,5}$/.test(args[0])) classes.push(args.shift());
  if (/^group:/.test(args[0] || '')) args.shift();
  const original = args.shift();
  let thumb = '';
  if (args.length && /^(https?:|\/|\.{0,2}\/?[\w-]+\/).*\.\w{2,5}$/.test(args[0])) thumb = args.shift();
  const sizes = [];
  while (args.length && /^\d+(\.\d+)?(px|%)?$/.test(args[0])) sizes.push(args.shift());
  const title = args.join(' ');
  const style = sizes.length ? ` style="${sizes[0] ? `width:${sizes[0]};` : ''}${sizes[1] ? `height:${sizes[1]};` : ''}"` : '';
  const alt = escapeHTML(title);
  const img = `<img src="${escapeHTML(thumb || original)}" alt="${alt}"${style}>`;
  const cls = classes.filter(c => c !== 'fancybox' && c !== 'clear' && c !== 'nocaption').join(' ');
  const caption = title && !classes.includes('nocaption') ? `<figcaption>${alt}</figcaption>` : '';
  return `<figure class="figure ${cls}"><a class="zoom" href="${escapeHTML(original)}">${img}</a>${caption}</figure>`;
});

// ---------- excerpts, photo diary entries ----------

hexo.extend.filter.register('before_post_render', data => {
  if (data.layout !== 'photo-diary') return data;

  // Markdown treats a single newline as the same paragraph. Separate standalone photos
  // from the following caption/copy automatically so diary authors don't need a blank line.
  data.content = data.content.replace(
    /(<!--\s*entry\s*-->)([\s\S]*?)(<!--\s*\/entry\s*-->)/g,
    (_, open, entry, close) => open + entry.replace(
      /^([ \t]*!\[.*\]\([^\r\n]*\)[ \t]*)(\r?\n)(?=[ \t]*\S)/gm,
      (_, image, newline) => image + newline + newline
    ) + close
  );
  return data;
});

hexo.extend.filter.register('after_post_render', data => {
  // Tranquilpeak's `<!-- excerpt -->`: the text above becomes the excerpt and is removed from the post.
  const marker = /<!-- ?excerpt ?-->/;
  if (marker.test(data.content)) {
    const i = data.content.search(marker);
    data.excerpt = data.content.slice(0, i).trim();
    data.content = data.content.slice(i).replace(marker, '').trim();
  }
  // Photo diary: <!-- entry --> ... <!-- /entry -->
  data.content = data.content
    .replace(/<!--\s*entry\s*-->/g, '<section class="diary-entry">')
    .replace(/<!--\s*\/entry\s*-->/g, '</section>');
  return data;
});

hexo.extend.helper.register('plain_excerpt', (post, length = 180) => {
  const text = plain(post.description || post.excerpt || post.content);
  if (text.length <= length) return text;
  const cut = text.slice(0, length);
  return cut.replace(/[\s,.;:!?，。；：！？、]+\S*$/, '') + '…';
});

hexo.extend.helper.register('reading_minutes', post => {
  const text = plain(post.content);
  const cjk = (text.match(/[぀-ヿ㐀-鿿가-힯]/g) || []).length;
  const words = text.replace(/[぀-ヿ㐀-鿿가-힯]/g, ' ').split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.round(cjk / 400 + words / 220));
});

// First local image of a post, used as the card thumbnail on list pages.
hexo.extend.helper.register('post_thumb', post => {
  if (post.thumbnailImage) return post.thumbnailImage;
  const m = String(post.content || '').match(/<img\b[^>]*?\ssrc="(\/[^"/][^"]*|assets\/[^"]+)"/i);
  return m ? (m[1].startsWith('/') ? m[1] : hexo.config.root + m[1]) : null;
});

hexo.extend.helper.register('page_lang', function (page) {
  const lang = langOf(page || {});
  return lang === 'zh-cn' ? 'zh-CN' : lang === 'ja-jp' ? 'ja' : lang;
});

// ---------- generators ----------

hexo.extend.generator.register('nir-search', locals => {
  const root = hexo.config.root;
  const entries = locals.posts.sort('-date').map(p => ({
    t: p.title || '',
    u: root + p.path,
    d: p.date.format('YYYY-MM-DD'),
    g: p.tags.map(t => t.name),
    c: p.categories.map(c => c.name),
    x: plain(p.content)
  }));
  for (const p of locals.pages.toArray()) {
    if (p.layout && p.layout !== 'page') continue;
    if (!['about/', 'links/'].some(s => p.path.startsWith(s))) continue;
    entries.push({ t: p.title || '', u: root + p.path.replace(/index\.html$/, ''), d: '', g: [], c: [], x: plain(p.content) });
  }
  return { path: 'search.json', data: JSON.stringify(entries) };
});

hexo.extend.generator.register('nir-lang-feeds', locals => {
  const url = hexo.config.url.replace(/\/$/, '');
  const xml = s => String(s).replace(/[<>&"']/g, c => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&apos;' }[c]));
  return ['en', 'zh-cn'].map(lang => {
    const posts = locals.posts.sort('-date').filter(p => langOf(p) === lang).limit(20);
    const items = posts.map(p => `<item><title>${xml(p.title)}</title><link>${xml(url + '/' + p.path)}</link><guid>${xml(url + '/' + p.path)}</guid><pubDate>${p.date.toDate().toUTCString()}</pubDate><description>${xml(p.content)}</description></item>`).join('');
    return {
      path: `${lang}/rss.xml`,
      data: `<?xml version="1.0" encoding="UTF-8"?><rss version="2.0"><channel><title>${xml(hexo.config.title)} (${lang})</title><link>${xml(url + '/')}</link><description>${xml(hexo.config.description || '')}</description>${items}</channel></rss>`
    };
  });
});

hexo.extend.generator.register('nir-platform', () => {
  const immutable = 'Cache-Control: public, max-age=31536000, immutable';
  return [
    { path: '404.html', layout: ['404'], data: { title: '404', type: '404', __404: true } },
    { path: 'search/index.html', layout: ['search'], data: { title: 'Search', type: 'search', comments: false } },
    {
      path: '_headers',
      data: [
        '/*',
        '  X-Content-Type-Options: nosniff',
        '  Referrer-Policy: strict-origin-when-cross-origin',
        '  Strict-Transport-Security: max-age=31536000; includeSubDomains',
        '  Cross-Origin-Opener-Policy: same-origin-allow-popups',
        '  X-Frame-Options: SAMEORIGIN',
        // Previews are noindex everywhere; production is noindex only on its *.pages.dev alias (nir.moe is canonical).
        ...(isPreview ? ['  X-Robots-Tag: noindex'] : ['https://:project.pages.dev/*', '  X-Robots-Tag: noindex']),
        '/js/*', '  ' + immutable,
        '/css/*', '  ' + immutable, '  Access-Control-Allow-Origin: *',
        '/img/*', '  ' + immutable,
        '/fonts/*', '  ' + immutable,
        '/assets/*', '  Cache-Control: public, max-age=604800',
        '/favicon.ico', '  Cache-Control: public, max-age=604800',
        ''
      ].join('\n')
    },
    {
      path: '_redirects',
      data: ['/rss.xml /rss-all.xml 301', '/rss2.xml /rss-all.xml 301', '/atom.xml /rss-all.xml 301', ''].join('\n')
    },
    { path: 'robots.txt', data: `User-agent: *\nAllow: /\n\nSitemap: ${hexo.config.url.replace(/\/$/, '')}/sitemap.xml\n` }
  ];
});
