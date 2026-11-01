// AMM Finder — çevrimdışı önbellek (yalnızca http/https üzerinde çalışır)
const V = 'amm-finder-v13';
const CORE = ['./', 'index.html', 'background.jpg', 'manifest.webmanifest', 'icons/icon-192.png', 'icons/icon-512.png', 'icons/favicon.svg'];

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

// Önbellek varsa ANINDA önbellekten verir, arkada güncelini indirir (yavaş/zayıf bağlantıda bekleme yok).
// Dosya güncellenmişse sayfaya haber verir ("Yeni veri indirildi, yenilemek için dokunun").
const notify = () => self.clients.matchAll().then(cs => cs.forEach(c => c.postMessage({type: 'updated'})));
self.addEventListener('fetch', e => {
  const r = e.request;
  if (r.method !== 'GET' || new URL(r.url).origin !== location.origin) return;
  e.respondWith((async () => {
    const c = await caches.open(V);
    const hit = await c.match(r, {ignoreSearch: true});
    const refresh = async ms => {
      const ctrl = new AbortController(), t = setTimeout(() => ctrl.abort(), ms);
      try {
        const res = await (r.mode === 'navigate' ? fetch(r, {signal: ctrl.signal}) : fetch(r.url, {cache: 'no-cache', signal: ctrl.signal}));
        if (res && res.ok) {
          const sig = x => x && (x.headers.get('etag') || x.headers.get('last-modified') || x.headers.get('content-length'));
          const a = sig(hit), b = sig(res);
          await c.put(r, res.clone());
          if (hit && a && b && a !== b) await notify();
        }
        return res;
      } finally { clearTimeout(t); }
    };
    if (hit) { e.waitUntil(refresh(20000).catch(() => {})); return hit; }
    try { return await refresh(10000); } catch (err) { throw err; }
  })());
});
