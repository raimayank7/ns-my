const CACHE = 'ns-my-64a17d59a7';
const SHELL = ["/", "/assets/base.css?v=e37d94d8d0", "/assets/doc.css?v=87ab455124", "/assets/i18n.js?v=3b13e9647c", "/assets/store.js?v=eb98e624a1", "/assets/core.js?v=41851ad4ee", "/assets/my.js?v=ea483dee39", "/vault.html"];
self.addEventListener('install', e => { e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting())); });
self.addEventListener('activate', e => { e.waitUntil(caches.keys().then(k => Promise.all(k.filter(n => n.startsWith('ns-') && n !== CACHE).map(n => caches.delete(n)))).then(() => self.clients.claim())); });
self.addEventListener('fetch', e => {
  const r = e.request, u = new URL(r.url);
  if (r.method !== 'GET') return;
  if (u.origin !== location.origin) {
    if (/fonts\.(googleapis|gstatic)\.com|cdnjs\.cloudflare\.com|assets\.niveshsahayak\.in/.test(u.host))
      e.respondWith(caches.match(r).then(m => m || fetch(r).then(res => { const c = res.clone(); caches.open(CACHE).then(x => x.put(r, c)); return res; })));
    return;
  }
  if (r.mode === 'navigate' || u.pathname.endsWith('.html') || u.pathname.endsWith('/')) {
    e.respondWith(fetch(r).then(res => { const c = res.clone(); caches.open(CACHE).then(x => x.put(r, c)); return res; })
      .catch(() => caches.match(r).then(m => m || caches.match('/'))));
    return;
  }
  e.respondWith(caches.match(r, { ignoreSearch: false }).then(m => m || fetch(r).then(res => { if (res.ok) { const c = res.clone(); caches.open(CACHE).then(x => x.put(r, c)); } return res; })));
});
