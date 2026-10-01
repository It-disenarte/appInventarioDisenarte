// Network-first: la app siempre intenta datos frescos. Se guarda en caché solo la
// "cáscara" (páginas y estáticos) para que abra sin conexión; /api nunca se cachea,
// así los datos del inventario no quedan guardados en el dispositivo.
const CACHE = 'inventario-v5';
const SHELL = ['/', '/login', '/manifest.json', '/favicon.svg', '/favicon.ico', '/icono-192.png', '/icono-512.png', '/icono-512-maskable.png', '/apple-touch-icon.png?v=2', '/textura.jpg'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).catch(() => {}));
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))));
  self.clients.claim();
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  const url = new URL(req.url);
  if (req.method !== 'GET' || url.origin !== self.location.origin || url.pathname.startsWith('/api/')) return;

  e.respondWith(
    fetch(req)
      .then((res) => {
        if (res.ok) { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(req, copy)); }
        return res;
      })
      .catch(async () => {
        const cached = await caches.match(req);
        if (cached) return cached;
        if (req.mode === 'navigate') return (await caches.match('/')) || new Response('Sin conexión', { status: 503 });
        return new Response('', { status: 503 });
      })
  );
});
