// Shared markup for the build-time HTML and client-side navigation renderers.
// Keep route content structure here; browser-only behavior belongs in app.js.
export const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, character => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
}[character]));

export const formatDate = value => value
  ? new Date(value).toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric', timeZone: 'UTC' })
  : '';

const routeHref = route => `${route === '/' ? '/' : route.replace(/\/+$/, '') + '/'}`;
export const ARTICLE_BODY_CLASS = 'article-body';
export const renderArticleBody = html => `<div class="${ARTICLE_BODY_CLASS}">${html}</div>`;

export function renderCategoryLink(category) {
  return `<a class="category" href="/categories/${encodeURIComponent(category)}">${escapeHtml(category)}</a>`;
}

export function renderPostRow(post, { titleHtml = null } = {}) {
  const title = titleHtml ?? escapeHtml(post.title);
  return `<div class="row"><time class="date" datetime="${escapeHtml(post.date)}">${escapeHtml(formatDate(post.date))}</time><a href="${escapeHtml(routeHref(post.path))}">${title}</a></div>`;
}

export function renderPostCard(post, { priority = false, cardSizes = '' } = {}) {
  const image = post.image
    ? `<a href="${escapeHtml(routeHref(post.path))}" class="preview-images"><img class="progressive sharp" src="${escapeHtml(post.image)}" srcset="${escapeHtml(post.imageSrcset)}" sizes="${escapeHtml(cardSizes)}" data-preview="${escapeHtml(post.imagePreview)}" width="${escapeHtml(post.imageWidth)}" height="${escapeHtml(post.imageHeight)}" loading="${priority ? 'eager' : 'lazy'}" fetchpriority="${priority ? 'high' : 'auto'}" decoding="async" alt="${escapeHtml(post.title)}"></a>`
    : '';
  return `<article class="post-card"><div class="meta"><time datetime="${escapeHtml(post.date)}">${escapeHtml(formatDate(post.date))}</time><span>·</span>${renderCategoryLink(post.category)}</div><h2><a href="${escapeHtml(routeHref(post.path))}">${escapeHtml(post.title)}</a></h2>${image}<p>${escapeHtml(String(post.excerpt ?? '').slice(0, 165))}…</p></article>`;
}

export function renderArticleHead(post) {
  const showCategory = post.post ?? Boolean(post.category);
  const category = showCategory && post.category ? `<span>·</span>${renderCategoryLink(post.category)}` : '';
  return `<div class="article-head"><div class="meta"><time datetime="${escapeHtml(post.date)}">${escapeHtml(formatDate(post.date))}</time>${category}</div><h1 tabindex="-1">${escapeHtml(post.title)}</h1></div>`;
}

export function renderPostTags(post) {
  return post.tags?.length
    ? `<div class="post-tags" aria-label="Tags">${post.tags.map(tag => `<a class="post-tag" href="/tags/${encodeURIComponent(tag)}/">#${escapeHtml(tag)}</a>`).join('')}</div>`
    : '';
}

export function renderRelatedPost(post, posts) {
  if (!post.post) return '';
  const ranked = posts.filter(candidate => candidate.path !== post.path)
    .map(candidate => ({ post: candidate, overlap: candidate.tags.filter(tag => post.tags.includes(tag)).length }))
    .sort((a, b) => b.overlap - a.overlap
      || Number(b.post.category === post.category) - Number(a.post.category === post.category)
      || b.post.date.localeCompare(a.post.date)
      || a.post.path.localeCompare(b.post.path));
  const related = ranked[0]?.post;
  if (!related) return '';
  const tag = post.tags.find(value => related.tags.includes(value));
  const label = tag ? `Other post with #${tag}` : 'Other post';
  return `<aside class="related-post" aria-label="${escapeHtml(label)}"><span class="related-label">${escapeHtml(label)}</span><h2><a href="${escapeHtml(routeHref(related.path))}">${escapeHtml(related.title)}</a></h2><p>${escapeHtml(related.firstSentence)}</p></aside>`;
}

export function renderSectionHeading(title) {
  return `<div class="section-heading"><h1 tabindex="-1">${escapeHtml(title)}</h1></div>`;
}

export function renderYearHeading(year) {
  return `<h2 class="year-title">${escapeHtml(year)}</h2>`;
}

export function renderTaxonomyCloud(posts, kind) {
  const counts = new Map();
  for (const post of posts) {
    for (const value of kind === 'tags' ? post.tags : [post.category]) {
      counts.set(value, (counts.get(value) || 0) + 1);
    }
  }
  const chips = [...counts].sort((a, b) => b[1] - a[1])
    .map(([name, count]) => `<a class="chip" href="/${kind}/${encodeURIComponent(name)}/">${escapeHtml(name)}<small>${count}</small></a>`)
    .join('');
  return `<div class="chips">${chips}</div>`;
}

export function renderBrowseArchivesLink() {
  return '<a class="chip" href="/all-archives/">Browse all entries</a>';
}
