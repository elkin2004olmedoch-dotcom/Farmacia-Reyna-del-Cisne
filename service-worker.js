'use strict';

const CACHE_NAME = 'farmacia-reina-shell-v2';
const APP_FILES = [
  'index.html', 'catalogo.html', 'robots.txt', 'service-worker.js',
  'data/productos.json', 'data/productos-local.js',
  'js/storage.js', 'js/cart.js', 'js/repo.js', 'js/view.js',
  'js/validation.js', 'js/form.js', 'js/app.js', 'js/offline.js',
  'assets/styles.css', 'assets/accesibilidad.css',
  'assets/vendor/bootstrap-grid.min.css', 'assets/vendor/fonts.css',
  'assets/fonts/fuente-1.ttf', 'assets/fonts/fuente-2.ttf', 'assets/fonts/fuente-3.ttf',
  'assets/fonts/fuente-4.ttf', 'assets/fonts/fuente-5.ttf', 'assets/fonts/fuente-6.ttf',
  'assets/images/logo-reina-del-cisne.png', 'assets/images/farmacia-fachada-reina.png',
  'assets/images/farmacia-5.jpg', 'assets/images/farmacia-6.jpg', 'assets/images/farmacia-7.jpg',
  'assets/images/farmacia-8.jpg', 'assets/images/farmacia-9.jpg', 'assets/images/producto-vitaminas.jpg',
  'assets/images/producto-solar-eucerin.png', 'assets/images/producto-botiquin.jpg',
  'assets/images/producto-bebe-pigeon.png',
  'assets/images/producto-tabletas-blister.svg', 'assets/images/producto-medicamento-liquido.svg',
  'assets/images/producto-generico-referencia.svg', 'assets/images/producto-frasco-tabletas.svg',
  'assets/images/producto-alcohol-antiseptico.svg', 'assets/images/producto-gasas-esteriles.svg',
  'assets/images/producto-venda-elastica.svg', 'assets/images/producto-curitas-adhesivas.svg',
  'assets/images/producto-termometro-digital.svg', 'assets/images/producto-mascarillas.svg',
  'assets/images/producto-solucion-salina.svg', 'assets/images/producto-gel-antibacterial.svg',
  'assets/images/producto-algodon.svg', 'assets/images/producto-toallitas-bebe.svg'
];

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME);
    const urls = APP_FILES.map((file) => new URL(file, self.registration.scope).href);
    await cache.addAll(urls);
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter((key) => key.startsWith('farmacia-reina-shell-') && key !== CACHE_NAME)
      .map((key) => caches.delete(key)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  const url = new URL(request.url);
  if (request.method !== 'GET' || url.origin !== self.location.origin
    || !url.pathname.startsWith(new URL(self.registration.scope).pathname)) return;

  if (request.mode === 'navigate') {
    event.respondWith((async () => {
      const cache = await caches.open(CACHE_NAME);
      try {
        const response = await fetch(request);
        if (response.ok) await cache.put(request, response.clone());
        return response;
      } catch (_) {
        return await cache.match(request, { ignoreSearch: true })
          || await cache.match(new URL('index.html', self.registration.scope).href)
          || new Response('La página aún no se ha guardado para uso sin conexión. Conéctate y vuelve a abrirla.', {
            status: 503, headers: { 'Content-Type': 'text/plain; charset=utf-8' }
          });
      }
    })());
    return;
  }

  event.respondWith((async () => {
    const cached = await caches.match(request);
    if (cached) return cached;
    try { return await fetch(request); }
    catch (_) { return new Response('', { status: 503 }); }
  })());
});
