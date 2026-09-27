#!/usr/bin/env node
/**
 * Minimal dependency-free static server for the production build.
 * Used by the Playwright `webServer` configuration and for manual review.
 *
 * Usage: node scripts/serve-dist.mjs [port]
 */

import { createServer } from 'node:http';
import { readFile, stat, realpath } from 'node:fs/promises';
import { extname, join, normalize, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(fileURLToPath(new URL('../dist/', import.meta.url)));
const PORT = Number(process.argv[2] || process.env.PORT || 4174);

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.woff2': 'font/woff2',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.txt': 'text/plain; charset=utf-8',
};

/** Block path traversal outside ROOT. */
function safeJoin(root, urlPath) {
  const decoded = decodeURIComponent(urlPath.split('?')[0]);
  const target = normalize(join(root, decoded));
  if (target !== root && !target.startsWith(root + sep)) {
    return null;
  }
  return target;
}

const server = createServer(async (req, res) => {
  try {
    const urlPath = req.url === '/' ? '/index.html' : req.url;
    let target = safeJoin(ROOT, urlPath);

    if (!target) {
      res.writeHead(403);
      res.end('Forbidden');
      return;
    }

    let info = null;
    try {
      info = await stat(target);
    } catch {
      info = null;
    }

    // Single-page-app fallback for navigation requests.
    if ((!info || info.isDirectory()) && req.headers.accept?.includes('text/html')) {
      target = join(ROOT, 'index.html');
      info = null;
    }

    // Defence in depth: refuse symlinks that resolve outside ROOT.
    const real = await realpath(target).catch(() => null);
    if (!real || (real !== ROOT && !real.startsWith(ROOT + sep))) {
      res.writeHead(404, { 'X-Content-Type-Options': 'nosniff' });
      res.end('Not found');
      return;
    }

    const body = await readFile(real);
    res.writeHead(200, {
      'Content-Type': TYPES[extname(real)] || 'application/octet-stream',
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
    });
    res.end(body);
  } catch {
    res.writeHead(404, { 'X-Content-Type-Options': 'nosniff' });
    res.end('Not found');
  }
});

server.listen(PORT, () => {
  console.log(`Serving dist/ at http://localhost:${PORT}`);
});
