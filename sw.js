// AMM Finder — çevrimdışı önbellek (yalnızca http/https üzerinde çalışır)
const V = 'amm-finder-v15';
const CORE = ['./', 'index.html', 'background.jpg', 'manifest.webmanifest', 'icons/icon-192.png', 'icons/icon-512.png', 'icons/favicon.svg', 'icons/logo.svg'];

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
const sha = async x => {
  const ab = await x.clone().arrayBuffer();
  const h = new Uint8Array(await crypto.subtle.digest('SHA-256', ab));
  return ab.byteLength + ':' + h.join(',');
};
const differs = async (a, b) => { try { return (await sha(a)) !== (await sha(b)); } catch (e) { return false; } };
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
        if (res && res.status === 200) {
          // Yalnızca İÇERİK gerçekten değiştiyse haber ver (başlıklar/ETag farkları yanlış alarm üretiyordu)
          const changed = !hit || await differs(hit, res);
          if (changed) { await c.put(r, res.clone()); if (hit) await notify(); }
        }
        return res;
      } finally { clearTimeout(t); }
    };
    if (hit) { e.waitUntil(refresh(20000).catch(() => {})); return hit.clone(); }
    try { return await refresh(10000); } catch (err) { throw err; }
  })());
});
