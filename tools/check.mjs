// Post-build sanity checks for the generated site in dist/ (run by `bun run build:cloudflare`).
import fs from 'node:fs';
import path from 'node:path';

const dist = path.resolve('dist');
const errors = [];
const must = ['index.html', '404.html', 'search.json', 'rss-all.xml', 'sitemap.xml', '_headers', '_redirects', 'robots.txt', 'search/index.html', 'all-archives/index.html'];
for (const f of must) if (!fs.existsSync(path.join(dist, f))) errors.push(`missing ${f}`);

const walk = dir => fs.readdirSync(dir, { withFileTypes: true }).flatMap(e => e.isDirectory() ? walk(path.join(dir, e.name)) : [path.join(dir, e.name)]);
const files = walk(dist);
const html = files.filter(f => f.endsWith('.html'));
const exists = url => fs.existsSync(path.join(dist, decodeURIComponent(url.split(/[?#]/)[0]))) ||
  fs.existsSync(path.join(dist, decodeURIComponent(url.split(/[?#]/)[0]), 'index.html'));

for (const file of html) {
  const text = fs.readFileSync(file, 'utf8');
  if (/<html/i.test(text) && !/<style>[^<]{1000,}<\/style>/.test(text) && !text.includes('http-equiv="refresh"')) errors.push(`${path.relative(dist, file)}: inline stylesheet missing`);
  for (const [, url] of text.matchAll(/(?:\s(?:src|href)="|\.src=')(\/(?:js|css|img)\/[^"']+)["']/g)) {
    if (!exists(url)) errors.push(`${path.relative(dist, file)}: broken asset ${url}`);
  }
}
JSON.parse(fs.readFileSync(path.join(dist, 'search.json'), 'utf8'));

if (errors.length) {
  console.error(errors.slice(0, 50).join('\n'));
  console.error(`\n${errors.length} problem(s) found.`);
  process.exit(1);
}
console.log(`Checked ${html.length} HTML pages and ${files.length} files: OK`);
