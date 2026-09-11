const CACHE = 'inventario-v1';
self.addEventListener('install', (e) => { self.skipWaiting(); });
self.addEventListener('activate', (e) => { self.clients.claim(); });
self.addEventListener('fetch', (e) => {
  // Network-first: la app siempre necesita datos frescos de la BD.
  e.respondWith(fetch(e.request).catch(() => caches.match(e.request)));
});
