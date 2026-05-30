const CACHE_NAME = 'tale-weaver-v1';
const urlsToCache = [
  '/',
  '/index.html',
  '/manifest.json'
];

// Install event - cache assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(urlsToCache))
  );
});

// Fetch event - network first for JS/CSS, cache-first for other assets
self.addEventListener('fetch', (event) => {
  const url = event.request.url;
  
  // Always use network for source code to prevent stale cache issues
  if (url.includes('/src/') || 
      url.includes('/node_modules/') || 
      url.includes('/@vite') || 
      url.includes('/@react-refresh') ||
      url.endsWith('.js') || 
      url.endsWith('.css')) {
    event.respondWith(fetch(event.request));
    return;
  }
  
  // Cache-first for other assets
  event.respondWith(
    caches.match(event.request)
      .then((response) => {
        if (response) {
          return response;
        }
        return fetch(event.request);
      })
  );
});

// Activate event - cleanup old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
});
