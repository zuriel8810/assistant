const CACHE_NAME = 'ella-assistant-v1';
const ASSETS = [
  './',
  './index.html',
  './styles.css',
  './app.js',
  './memory.js',
  './ai.js',
  './manifest.json',
  './icons/icon-192.png',
  './icons/icon-512.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
      );
    })
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  // Pass through external API calls directly
  if (event.request.url.includes('api.anthropic.com') ||
      event.request.url.includes('api.openai.com') ||
      event.request.url.includes('openrouter.ai') ||
      event.request.method !== 'GET') {
    return;
  }
  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      return cachedResponse || fetch(event.request).catch(() => cachedResponse);
    })
  );
});
