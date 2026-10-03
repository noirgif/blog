import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import { promisify } from 'node:util';
import { brotliCompress, gzip } from 'node:zlib';

const root = path.resolve('dist');
const info = JSON.parse(await fs.readFile(path.join(root, 'build-info.json'), 'utf8'));
const base = info.basePath, port = Number(process.env.PORT || 4173);
const compressBrotli = promisify(brotliCompress), compressGzip = promisify(gzip);
const mime = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.json': 'application/json', '.ndjson': 'application/x-ndjson', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.avif': 'image/avif', '.png': 'image/png', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.woff': 'font/woff', '.ttf': 'font/ttf', '.xml': 'application/xml', '.txt': 'text/plain; charset=utf-8' };

http.createServer(async (req, res) => {
  try {
    let pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
    if (base) {
      if (pathname === base) { res.writeHead(302, { Location: base + '/' }); res.end(); return; }
      if (!pathname.startsWith(base + '/')) throw Error('Not found');
      pathname = pathname.slice(base.length);
    }
    const file = path.resolve(root, '.' + pathname);
    if (file !== root && !file.startsWith(root + path.sep)) throw Error('Not found');
    const stat = await fs.stat(file), entry = stat.isDirectory() ? path.join(file, 'index.html') : file;
    let data = await fs.readFile(entry);
    const immutable = /^\/(?:static|media|data|vendor\/katex-[\d.]+)\//.test(pathname);
    const headers = {
      'Content-Type': mime[path.extname(entry)] || 'application/octet-stream',
      'Cache-Control': immutable ? 'public, max-age=31536000, immutable' : 'public, max-age=0, must-revalidate',
      ETag: 'W/"' + crypto.createHash('sha256').update(data).digest('hex').slice(0, 16) + '"',
      Vary: 'Accept-Encoding',
    };
    if (/^\/static\/giscus-[a-f0-9]+\.css$/.test(pathname)) headers['Access-Control-Allow-Origin'] = '*';
    if (req.headers['if-none-match'] === headers.ETag) { res.writeHead(304, headers); res.end(); return; }
    if (/\.(html|css|js|json|ndjson|xml|svg)$/.test(entry)) {
      const accepts = req.headers['accept-encoding'] || '';
      if (/\bbr\b/.test(accepts)) { data = await compressBrotli(data); headers['Content-Encoding'] = 'br'; }
      else if (/\bgzip\b/.test(accepts)) { data = await compressGzip(data); headers['Content-Encoding'] = 'gzip'; }
    }
    headers['Content-Length'] = data.length;
    res.writeHead(200, headers); res.end(req.method === 'HEAD' ? undefined : data);
  } catch {
    res.writeHead(404, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-cache' });
    res.end(await fs.readFile(path.join(root, '404.html')).catch(() => Buffer.from('Not found')));
  }
}).listen(port, '0.0.0.0', () => console.log(`Preview: http://localhost:${port}${base}/`));
