/* V8.4: GitHub Pages subpath-safe and offline-friendly service worker. */
const VERSION = 'daily-books-v8-4';
const ROOT = new URL('./', self.registration.scope);
const HOME = new URL('index.html', ROOT).href;
const SHELL = [
  'index.html', 'css/styles.css', 'js/app.js',
  'manifest.webmanifest', 'assets/icon-192.png', 'assets/icon-512.png'
].map(path => new URL(path, ROOT).href);

self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const cache = await caches.open(VERSION);
    // One missing optional asset must not break the entire PWA installation.
    await Promise.allSettled(SHELL.map(url => cache.add(new Request(url, {cache:'reload'}))));
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(key => key.startsWith('daily-books-') && key !== VERSION)
      .map(key => caches.delete(key)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin || !url.href.startsWith(ROOT.href)) return;

  if (request.mode === 'navigate') {
    event.respondWith((async () => {
      try {
        const response = await fetch(request);
        if (!response.ok) throw new Error('Navigation HTTP ' + response.status);
        const cache = await caches.open(VERSION);
        cache.put(HOME, response.clone()).catch(() => {});
        return response;
      } catch (_) {
        return (await caches.match(HOME)) ||
          new Response('<!doctype html><html lang="zh-Hant"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>每日一本好書</title><body style="font:20px system-ui;padding:24px"><h1>📚 每日一本好書</h1><p>目前沒有網路，也沒有可用的首頁快取。請連線後重新開啟 App。</p></body></html>',
            {headers:{'Content-Type':'text/html; charset=utf-8'}});
      }
    })());
    return;
  }

  // Return matching files only; never serve index.html instead of JS or CSS.
  event.respondWith((async () => {
    const cached = await caches.match(request, {ignoreSearch: true});
    const network = fetch(request).then(response => {
      if (response.ok && response.type !== 'opaque') {
        caches.open(VERSION).then(cache => cache.put(request, response.clone())).catch(() => {});
      }
      return response;
    });
    return cached || network;
  })());
});
