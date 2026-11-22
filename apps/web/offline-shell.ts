import type { Plugin } from 'vite';
import { readdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { createHash } from 'node:crypto';

export function offlineShell(): Plugin {
  let outDir = '';
  return {
    name: 'agritwin-offline-shell',
    apply: 'build',
    configResolved(config) {
      outDir = resolve(config.root, config.build.outDir);
    },
    async closeBundle() {
      const files = (await readdir(resolve(outDir, 'assets'))).filter((name) =>
        /\.(js|css|woff2?|svg|png)$/.test(name),
      );
      const urls = ['/index.html', ...files.map((name) => `/assets/${name}`)];
      const version = createHash('sha256')
        .update(await readFile(resolve(outDir, 'index.html')))
        .digest('hex')
        .slice(0, 12);
      await writeFile(
        resolve(outDir, 'sw.js'),
        `
const CACHE = 'agritwin-shell-${version}';
const FILES = ${JSON.stringify(urls)};
self.addEventListener('install', event => { event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(FILES)).then(() => self.skipWaiting())); });
self.addEventListener('activate', event => { event.waitUntil((async () => {
  const keys = (await caches.keys()).filter(key => key.startsWith('agritwin-shell-') && key !== CACHE);
  await Promise.all(keys.slice(0, -1).map(key => caches.delete(key)));
  await self.clients.claim();
})()); });
self.addEventListener('fetch', event => {
  const request = event.request, url = new URL(request.url);
  // Never cache API responses, account data, weather, or third-party map tiles here.
  if (request.method !== 'GET' || url.origin !== self.location.origin || url.pathname.startsWith('/api/') || url.pathname.startsWith('/socket.io/')) return;
  if (request.mode === 'navigate') {
    event.respondWith(fetch(request).catch(() => caches.open(CACHE).then(cache => cache.match('/index.html'))));
  } else if (FILES.includes(url.pathname) || url.pathname.startsWith('/assets/')) {
    event.respondWith(caches.match(url.pathname).then(cached => cached || fetch(request)));
  }
});
`,
      );
    },
  };
}
