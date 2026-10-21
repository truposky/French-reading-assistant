/* Margen offline shell: only same-origin application assets are cached. */
const CACHE = 'margen-shell-v1';
self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    const root = new URL('./', self.registration.scope);
    const response = await fetch(root);
    if (!response.ok) throw new Error('Cannot precache app shell');
    const html = await response.clone().text();
    await cache.put(root, response);
    const assets = [...html.matchAll(/(?:src|href)="(\.\/assets\/[^"?]+|assets\/[^"?]+)"/g)]
      .map(m => new URL(m[1], root));
    await Promise.allSettled(assets.map(url => cache.add(url)));
    await self.skipWaiting();
  })());
});
self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(k => k !== CACHE && k.startsWith('margen-shell-')).map(k => caches.delete(k)));
    await self.clients.claim();
  })());
});
self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin || !url.pathname.startsWith(new URL(self.registration.scope).pathname)) return;
  event.respondWith((async () => {
    const cached = await caches.match(request);
    if (cached) return cached;
    try {
      const response = await fetch(request);
      if (response.ok && (url.pathname.includes('/assets/') || url.pathname.endsWith('.webmanifest') || url.pathname.endsWith('.svg'))) {
        const cache = await caches.open(CACHE);
        await cache.put(request, response.clone());
      }
      return response;
    } catch (error) {
      return (await caches.match(new URL('./', self.registration.scope))) ?? Response.error();
    }
  })());
});
