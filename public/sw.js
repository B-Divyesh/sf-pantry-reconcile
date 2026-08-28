const VERSION = 'pantry-v5';
const SHELL = ['/offline.html', '/manifest.webmanifest', '/icons/icon.svg', '/icons/icon-192.png', '/icons/icon-512.png'];

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(VERSION);
    await cache.addAll(SHELL);
    const root = await fetch('/', { cache: 'reload' });
    const html = await root.clone().text();
    await cache.put('/', root);
    const appAssets = [...html.matchAll(/(?:src|href|srcset)="(\/assets\/[^"]+)"/g)].map((match) => match[1]);
    await cache.addAll(appAssets);
  })());
});
self.addEventListener('activate', (event) => {
  event.waitUntil(Promise.all([
    caches.keys().then((keys) => Promise.all(keys.filter((key) => key !== VERSION).map((key) => caches.delete(key)))),
    self.clients.claim(),
  ]));
});
self.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') self.skipWaiting();
});
self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;
  if (event.request.mode === 'navigate') {
    event.respondWith(fetch(event.request).then((response) => {
      const copy = response.clone();
      caches.open(VERSION).then((cache) => cache.put('/', copy));
      return response;
    }).catch(() => caches.match('/').then((response) => response || caches.match('/offline.html'))));
    return;
  }
  event.respondWith((async () => {
    const cache = await caches.open(VERSION);
    const cached = await cache.match(url.pathname, { ignoreVary: true });
    if (cached) return cached;
    const response = await fetch(event.request);
    if (response.ok && ['script', 'style', 'font', 'image'].includes(event.request.destination)) await cache.put(url.pathname, response.clone());
    return response;
  })());
});
