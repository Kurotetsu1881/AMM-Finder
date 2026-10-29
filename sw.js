// AMM Finder — çevrimdışı önbellek (yalnızca http/https üzerinde çalışır)
const V = 'amm-finder-v1';
const CORE = ['./', 'index.html', 'background.jpg', 'manifest.webmanifest', 'icon-192.png', 'icon-512.png'];

self.addEventListener('install', e => {
  e.waitUntil((async () => {
    const c = await caches.open(V);
    await Promise.allSettled(CORE.map(u => c.add(u)));
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', e => {
  e.waitUntil((async () => {
    const ks = await caches.keys();
    await Promise.all(ks.filter(k => k !== V).map(k => caches.delete(k)));
    await self.clients.claim();
  })());
});

// Önce ağ (güncel veri), ağ yoksa/yavaşsa önbellek
self.addEventListener('fetch', e => {
  const r = e.request;
  if (r.method !== 'GET' || new URL(r.url).origin !== location.origin) return;
  e.respondWith((async () => {
    const c = await caches.open(V);
    try {
      let res;
      if (r.mode === 'navigate') res = await fetch(r);
      else {
        const ctrl = new AbortController();
        const t = setTimeout(() => ctrl.abort(), 8000);
        try { res = await fetch(r.url, {cache: 'no-cache', signal: ctrl.signal}); } finally { clearTimeout(t); }
      }
      if (res && res.ok) c.put(r, res.clone());
      return res;
    } catch (err) {
      const m = await c.match(r, {ignoreSearch: true});
      if (m) return m;
      throw err;
    }
  })());
});
