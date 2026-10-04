/* global __SNOW_URL__, __GISCUS_CSS__ */
// nir — client enhancements. The site works without JS; this adds seamless navigation,
// search with highlighting, lazy comments and the snow easter egg.

const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
const body = document.body;
const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)');
const esc = s => s.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const reEsc = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
let main = $('#main');

// Run `fn` once the visitor first interacts (third-party embeds wait for this,
// so a page load alone never pulls them in).
const interacted = new Promise(resolve => {
  const events = ['pointerdown', 'keydown', 'wheel', 'touchstart'];
  const done = () => { events.forEach(e => removeEventListener(e, done, true)); resolve(); };
  events.forEach(e => addEventListener(e, done, { capture: true, passive: true }));
});

/* ---------------- menu drawer ---------------- */
const sidebar = $('#sidebar');
const scrim = $('.scrim');
const menuBtn = $('[data-open-menu]');
function setMenu(open) {
  if (open) sidebar.classList.add('seen');
  body.classList.toggle('menu-open', open);
  menuBtn?.setAttribute('aria-expanded', String(open));
  if (open) {
    scrim.hidden = false;
    sidebar.setAttribute('aria-modal', 'true');
    requestAnimationFrame(() => $('.nav-link', sidebar)?.focus({ preventScroll: true }));
  } else {
    sidebar.removeAttribute('aria-modal');
    setTimeout(() => { if (!body.classList.contains('menu-open')) scrim.hidden = true; }, 300);
  }
}
menuBtn?.addEventListener('click', () => setMenu(true));
document.addEventListener('click', e => { if (e.target.closest('[data-close-menu]')) setMenu(false); });

function markActiveNav() {
  const path = location.pathname.replace(/index\.html$/, '');
  for (const a of $$('[data-nav]')) {
    const nav = a.dataset.nav;
    const on = nav === '/' ? (path === '/' || /^\/page\/\d+\/?$/.test(path)) : path.startsWith(nav);
    a.classList.toggle('active', on);
    if (on) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current');
  }
}

/* ---------------- seamless navigation ---------------- */
const pages = new Map();
const progress = $('.route-progress');

function eligible(a, e) {
  if (!a || !a.href || a.target || a.hasAttribute('download') || a.dataset.noPjax != null) return false;
  if (e && (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.defaultPrevented)) return false;
  const url = new URL(a.href, location.href);
  if (url.origin !== location.origin) return false;
  if (/\.(?!html?$)[a-z0-9]{2,5}$/i.test(url.pathname)) return false; // feeds, images, files
  return true;
}

function fetchPage(href) {
  const key = href.split('#')[0];
  if (!pages.has(key)) {
    if (pages.size > 40) pages.delete(pages.keys().next().value);
    pages.set(key, fetch(key, { credentials: 'same-origin' }).then(async r => {
      if (!(r.headers.get('content-type') || '').includes('text/html')) throw new Error('not html');
      return { html: await r.text(), url: r.url };
    }).catch(err => { pages.delete(key); throw err; }));
  }
  return pages.get(key);
}

// Prefetch on intent (hover / touch / keyboard focus).
let hoverTimer;
const intent = e => {
  const a = e.target.closest?.('a');
  if (!eligible(a)) return;
  clearTimeout(hoverTimer);
  hoverTimer = setTimeout(() => fetchPage(a.href).catch(() => {}), e.type === 'mouseover' ? 60 : 0);
};
document.addEventListener('mouseover', intent, { passive: true });
document.addEventListener('touchstart', intent, { passive: true });
document.addEventListener('focusin', intent);

document.addEventListener('click', e => {
  const a = e.target.closest('a');
  if (a?.dataset.action === 'search' && !e.metaKey && !e.ctrlKey) { e.preventDefault(); setMenu(false); openSearch(); return; }
  if (!eligible(a, e)) return;
  const url = new URL(a.href);
  if (url.pathname === location.pathname && url.search === location.search) {
    if (url.hash) return; // in-page anchor: let the browser handle it
    e.preventDefault();
    if (a.dataset.highlight) {
      clearHits();
      history.replaceState({ ...history.state, highlight: a.dataset.highlight }, '');
      highlightPage(a.dataset.highlight);
      return;
    }
    window.scrollTo({ top: 0, behavior: reduceMotion.matches ? 'auto' : 'smooth' });
    return;
  }
  e.preventDefault();
  navigate(url, { highlight: a.dataset.highlight });
});

window.addEventListener('popstate', e => {
  navigate(new URL(location.href), { push: false, scroll: e.state?.scroll ?? 0 });
});
const saveScroll = () => history.replaceState({ ...history.state, scroll: scrollY }, '');
window.addEventListener('pagehide', saveScroll);

let navId = 0;
async function navigate(url, { push = true, scroll = 0, highlight = null } = {}) {
  const id = ++navId;
  const slow = setTimeout(() => { progress.className = 'route-progress run'; }, 120);
  let page;
  try {
    page = await fetchPage(url.href);
  } catch {
    location.assign(url.href);
    return;
  }
  if (id !== navId) return;
  const doc = new DOMParser().parseFromString(page.html, 'text/html');
  const next = doc.getElementById('main');
  if (!next) { location.assign(url.href); return; }
  if (push) {
    saveScroll();
    history.pushState({ scroll: 0, highlight }, '', url.href);
  }
  // Leaving a page where the sidebar was on screen: keep its images while it slides away.
  if (!body.classList.contains('page-post')) sidebar.classList.add('seen');
  const swap = () => {
    clearHits();
    setMenu(false);
    document.title = doc.title;
    document.documentElement.lang = doc.documentElement.lang;
    const keep = [...body.classList].filter(c => c.startsWith('snow-'));
    body.className = doc.body.className;
    body.classList.add(...keep);
    for (const sel of ['meta[name="description"]', 'link[rel="canonical"]', 'meta[property="og:title"]', 'meta[property="og:description"]', 'meta[property="og:url"]', 'meta[property="og:type"]']) {
      const from = $(sel, doc.head), to = $(sel);
      if (from && to) for (const attr of ['content', 'href']) if (from.hasAttribute(attr)) to.setAttribute(attr, from.getAttribute(attr));
    }
    const css = $('style[data-page-css]', doc.head), mine = $('style[data-page-css]');
    if (css && mine && css.textContent !== mine.textContent) mine.textContent = css.textContent;
    main.replaceWith(next);
    main = next;
    markActiveNav();
    const target = url.hash && document.getElementById(decodeURIComponent(url.hash.slice(1)));
    if (target) target.scrollIntoView(); else window.scrollTo(0, scroll);
    initPage(highlight || history.state?.highlight);
  };
  if (document.startViewTransition && !reduceMotion.matches) {
    await document.startViewTransition(swap).updateCallbackDone.catch(() => {});
  } else {
    swap();
    next.classList.add('swap-in');
  }
  clearTimeout(slow);
  if (progress.classList.contains('run')) progress.className = 'route-progress done';
  main.focus({ preventScroll: true });
}

/* ---------------- search ---------------- */
let index;
const loadIndex = () => index ??= fetch('/search.json').then(r => r.json()).then(list => list.map(e => ({
  ...e, lt: e.t.toLowerCase(), lx: e.x.toLowerCase(), lg: [...e.g, ...e.c].join(' ').toLowerCase()
}))).catch(err => { index = undefined; throw err; });

const termsOf = q => [...new Set(q.toLowerCase().trim().split(/\s+/).filter(Boolean))].slice(0, 8);
const termRegex = terms => new RegExp(terms.sort((a, b) => b.length - a.length).map(reEsc).join('|'), 'gi');

function count(text, term, max = 25) {
  let n = 0, i = text.indexOf(term);
  while (i !== -1 && n < max) { n++; i = text.indexOf(term, i + term.length); }
  return n;
}

function runSearch(entries, q) {
  const terms = termsOf(q);
  if (!terms.length) return { terms, hits: [] };
  const hits = [];
  for (const e of entries) {
    let score = 0;
    for (const t of terms) {
      const inTitle = e.lt.includes(t), inTags = e.lg.includes(t), n = count(e.lx, t);
      if (!inTitle && !inTags && !n) { score = -1; break; }
      score += inTitle * 12 + inTags * 6 + Math.min(n, 12);
    }
    if (score > 0) hits.push({ e, score });
  }
  hits.sort((a, b) => b.score - a.score || b.e.d.localeCompare(a.e.d));
  return { terms, hits: hits.slice(0, 40) };
}

function mark(text, re) {
  let out = '', last = 0;
  text.replace(re, (m, i) => { out += esc(text.slice(last, i)) + '<mark>' + esc(m) + '</mark>'; last = i + m.length; return m; });
  return out + esc(text.slice(last));
}

function snippet(e, terms, re) {
  let at = -1;
  for (const t of terms) { const i = e.lx.indexOf(t); if (i !== -1 && (at === -1 || i < at)) at = i; }
  if (at === -1) return mark(e.x.slice(0, 140) + (e.x.length > 140 ? '…' : ''), re);
  const start = Math.max(0, at - 50), end = Math.min(e.x.length, at + 140);
  return (start ? '…' : '') + mark(e.x.slice(start, end), re) + (end < e.x.length ? '…' : '');
}

function bindSearch(input, results, onPick) {
  let selected = -1, timer;
  const items = () => $$('.result', results);
  const select = i => {
    const list = items();
    selected = Math.max(-1, Math.min(i, list.length - 1));
    list.forEach((el, n) => el.setAttribute('aria-selected', String(n === selected)));
    list[selected]?.scrollIntoView({ block: 'nearest' });
  };
  const render = async () => {
    const q = input.value;
    if (!q.trim()) { results.classList.remove('note'); results.innerHTML = ''; return; }
    let entries;
    try { entries = await loadIndex(); } catch { results.classList.add('note'); results.dataset.note = 'Search is unavailable offline.'; results.innerHTML = ''; return; }
    if (q !== input.value) return;
    const { terms, hits } = runSearch(entries, q);
    selected = -1;
    if (!hits.length) {
      results.classList.add('note');
      results.dataset.note = `${results.dataset.empty} “${q.trim()}”`;
      results.innerHTML = '';
      return;
    }
    results.classList.remove('note');
    const re = termRegex([...terms]);
    results.innerHTML = hits.map(({ e }) => `<a class="result" role="option" aria-selected="false" href="${esc(e.u)}" data-highlight="${esc(q.trim())}">
      <span class="result-title">${mark(e.t, re)}</span>
      <span class="result-meta">${[e.d, ...e.c, ...e.g.map(g => '#' + g)].filter(Boolean).map(s => mark(s, re)).join(' · ')}</span>
      <span class="result-snippet">${snippet(e, terms, re)}</span></a>`).join('');
  };
  input.addEventListener('input', () => { clearTimeout(timer); timer = setTimeout(render, 70); onPick?.input?.(input.value); });
  input.addEventListener('keydown', e => {
    if (e.key === 'ArrowDown') { e.preventDefault(); select(selected + 1); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); select(selected - 1); }
    else if (e.key === 'Enter') {
      e.preventDefault();
      (items()[Math.max(selected, 0)])?.click();
    }
  });
  results.addEventListener('click', e => { if (e.target.closest('.result')) onPick?.pick?.(); });
  return render;
}

const dialog = $('#search-dialog');
const dialogInput = $('.search-input', dialog);
const renderDialog = bindSearch(dialogInput, $('.search-results', dialog), { pick: () => dialog.close() });
function openSearch() {
  if (!dialog.open) dialog.showModal();
  dialogInput.select();
  loadIndex().catch(() => {});
}
$('[data-close-search]', dialog).addEventListener('click', () => dialog.close());
dialog.addEventListener('click', e => { if (e.target === dialog) dialog.close(); });
document.addEventListener('keydown', e => {
  const typing = /^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement?.tagName) || document.activeElement?.isContentEditable;
  if ((e.key === 'k' && (e.metaKey || e.ctrlKey)) || (e.key === '/' && !typing)) { e.preventDefault(); openSearch(); }
  else if (e.key === 'Escape' && body.classList.contains('menu-open')) setMenu(false);
});

/* ---------------- highlight search matches inside a page ---------------- */
let hitsBar = null;
function clearHits() {
  hitsBar?.remove();
  hitsBar = null;
  for (const m of $$('mark.hit')) {
    const parent = m.parentNode;
    m.replaceWith(document.createTextNode(m.textContent));
    parent.normalize();
  }
}

function highlightPage(query) {
  const terms = termsOf(query || '');
  const scope = $$('.post-title, .post-content', main);
  if (!terms.length || !scope.length) return;
  const re = termRegex(terms);
  const marks = [];
  for (const root of scope) {
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
      acceptNode: n => n.parentElement.closest('script, style, math, mark') ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT
    });
    const nodes = [];
    while (walker.nextNode()) nodes.push(walker.currentNode);
    for (const node of nodes) {
      const text = node.nodeValue;
      re.lastIndex = 0;
      if (!re.test(text)) continue;
      const frag = document.createDocumentFragment();
      let last = 0;
      text.replace(re, (m, i) => {
        frag.append(text.slice(last, i));
        const el = document.createElement('mark');
        el.className = 'hit';
        el.textContent = m;
        frag.append(el);
        marks.push(el);
        last = i + m.length;
        return m;
      });
      frag.append(text.slice(last));
      node.replaceWith(frag);
    }
  }
  if (!marks.length) return;
  let current = 0;
  const go = i => {
    marks[current]?.classList.remove('current');
    current = (i + marks.length) % marks.length;
    marks[current].classList.add('current');
    marks[current].scrollIntoView({ block: 'center', behavior: reduceMotion.matches ? 'auto' : 'smooth' });
    counter.textContent = `${current + 1} / ${marks.length}`;
  };
  hitsBar = document.createElement('div');
  hitsBar.className = 'hits';
  hitsBar.setAttribute('role', 'status');
  hitsBar.innerHTML = `<span><b></b> · “${esc(query.trim())}”</span>
    <button class="icon-btn" type="button" aria-label="Previous match"><svg class="icon" viewBox="0 0 24 24"><path d="m5 15 7-7 7 7"/></svg></button>
    <button class="icon-btn" type="button" aria-label="Next match"><svg class="icon" viewBox="0 0 24 24"><path d="m5 9 7 7 7-7"/></svg></button>
    <button class="icon-btn" type="button" aria-label="Clear highlights"><svg class="icon" viewBox="0 0 24 24"><path d="M6 6l12 12M18 6 6 18"/></svg></button>`;
  const counter = $('b', hitsBar);
  const [prev, nextBtn, close] = $$('button', hitsBar);
  prev.onclick = () => go(current - 1);
  nextBtn.onclick = () => go(current + 1);
  close.onclick = () => { clearHits(); history.replaceState({ ...history.state, highlight: null }, ''); };
  body.append(hitsBar);
  requestAnimationFrame(() => go(0));
}

/* ---------------- comments (giscus), loaded when approached ---------------- */
let commentsObserver;
function setupComments() {
  commentsObserver?.disconnect();
  const section = $('.comments', main);
  if (!section) return;
  interacted.then(() => { if (section.isConnected) observeComments(section); });
}
function observeComments(section) {
  commentsObserver?.disconnect();
  commentsObserver = new IntersectionObserver(entries => {
    if (!entries.some(e => e.isIntersecting)) return;
    commentsObserver.disconnect();
    const d = section.dataset;
    const status = $('.comments-status', section);
    const s = document.createElement('script');
    s.src = 'https://giscus.app/client.js';
    s.async = true;
    s.crossOrigin = 'anonymous';
    const attrs = {
      repo: d.repo, 'repo-id': d.repoId, category: d.category, 'category-id': d.categoryId,
      mapping: d.mapping, strict: '0', 'reactions-enabled': '1', 'emit-metadata': '0',
      'input-position': 'top', lang: d.lang, loading: 'lazy',
      theme: new URL(__GISCUS_CSS__, location.origin).href
    };
    for (const [k, v] of Object.entries(attrs)) s.setAttribute('data-' + k, v);
    s.onload = () => { status.hidden = true; };
    s.onerror = () => { status.textContent = status.dataset.failed; };
    section.append(s);
  }, { rootMargin: '300px 0px' });
  commentsObserver.observe(section);
}

/* ---------------- reading progress ---------------- */
const topbar = $('.topbar');
let ticking = false;
function updateProgress() {
  ticking = false;
  const article = $('.post-content', main);
  if (!body.classList.contains('page-post') || !article) return;
  const rect = article.getBoundingClientRect();
  const total = rect.height - innerHeight * 0.6;
  const p = total > 0 ? Math.min(1, Math.max(0, -rect.top / total)) : 1;
  topbar.style.setProperty('--read', p.toFixed(4));
}
addEventListener('scroll', () => { if (!ticking) { ticking = true; requestAnimationFrame(updateProgress); } }, { passive: true });

/* ---------------- image lightbox ---------------- */
let lightbox;
document.addEventListener('click', e => {
  const a = e.target.closest('.prose a');
  if (!a || !a.querySelector('img') || e.metaKey || e.ctrlKey) return;
  const href = a.getAttribute('href') || '';
  if (!/\.(webp|jpe?g|png|gif|avif)$/i.test(href)) return;
  e.preventDefault();
  if (!lightbox) {
    lightbox = document.createElement('dialog');
    lightbox.className = 'lightbox';
    lightbox.innerHTML = '<img alt="">';
    lightbox.addEventListener('click', () => lightbox.close());
    body.append(lightbox);
  }
  const img = lightbox.firstChild;
  img.src = href;
  img.alt = a.querySelector('img').alt;
  lightbox.showModal();
});

/* ---------------- snow (loaded on demand) ---------------- */
document.addEventListener('click', e => {
  const btn = e.target.closest('[data-snow]');
  if (!btn) return;
  const r = btn.getBoundingClientRect();
  import(__SNOW_URL__).then(m => m.snow(r.left + r.width / 2, r.top + r.height / 2));
});

/* ---------------- analytics, after the first interaction ---------------- */
if (body.dataset.cfBeacon) {
  interacted.then(() => {
    const s = document.createElement('script');
    s.defer = true;
    s.src = 'https://static.cloudflareinsights.com/beacon.min.js';
    s.dataset.cfBeacon = JSON.stringify({ token: body.dataset.cfBeacon, spa: true });
    document.head.append(s);
  });
}

/* ---------------- per page setup ---------------- */
function initPage(highlight) {
  setupComments();
  topbar.style.setProperty('--read', '0'); // measured on scroll only, never during load
  if (highlight) highlightPage(highlight);
  const searchPage = $('[data-search-page]', main);
  if (searchPage) {
    const input = $('.search-input', searchPage);
    const render = bindSearch(input, $('.search-results', searchPage), {
      input: v => history.replaceState(history.state, '', v.trim() ? '?q=' + encodeURIComponent(v.trim()) : location.pathname)
    });
    input.value = new URLSearchParams(location.search).get('q') || '';
    render();
    input.focus();
  }
}

// Start-up work waits until the first frame is painted, so it never forces an early layout.
requestAnimationFrame(() => setTimeout(() => {
  history.scrollRestoration = 'manual';
  markActiveNav();
  if (history.state?.scroll) window.scrollTo(0, history.state.scroll);
  initPage(history.state?.highlight);
}));
