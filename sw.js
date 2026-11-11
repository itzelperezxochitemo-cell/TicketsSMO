const VERSION = 'tickets-v13';
const CASCARA = [
  './', './index.html', './styles.css', './manifest.webmanifest',
  './js/catalog.js', './js/raci.js', './js/config.js', './js/db.js', './js/sync.js', './js/tickets.js', './js/server-local.js', './js/server-supabase.js', './js/ui.js', './js/view-lista.js', './js/view-nuevo.js', './js/view-extra.js', './js/view-login.js', './js/app.js',
  './icons/icon.svg', './icons/icon-192.png', './icons/icon-512.png'
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(VERSION).then((c) => c.addAll(CASCARA)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((claves) => Promise.all(claves.filter((k) => k !== VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) return;

  if (req.mode === 'navigate') {
    e.respondWith(caches.match('./index.html').then((r) => r || fetch(req)));
    return;
  }

  e.respondWith(
    caches.match(req).then((enCache) => {
      const red = fetch(req).then((resp) => {
        if (resp && resp.ok) { const copia = resp.clone(); caches.open(VERSION).then((c) => c.put(req, copia)); }
        return resp;
      }).catch(() => enCache);
      return enCache || red;
    })
  );
});

self.addEventListener('message', (e) => {
  if (e.data === 'saltar-espera') self.skipWaiting();
});
