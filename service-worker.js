const CACHE_NAME = "eouting-itu-v1";

const CORE_ASSETS = [
  "./",
  "./index.html",
  "./assets/style.css",
  "./assets/app.js",
  "./assets/pwa-logo.png",
  "./assets/eouting-header-logo.png",
  "./assets/icons/icon-192.png",
  "./assets/icons/icon-512.png",
  "./assets/icons/maskable-512.png",
  "./manifest.json"
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => Promise.all(
        CORE_ASSETS.map((asset) => (
          cache.add(asset).catch(() => null)
        ))
      ))
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((cacheNames) => Promise.all(
        cacheNames
          .filter((cacheName) => cacheName !== CACHE_NAME)
          .map((cacheName) => caches.delete(cacheName))
      ))
  );
});

self.addEventListener("fetch", (event) => {
  if (event.request.mode === "navigate") {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          const responseCopy = response.clone();
          caches.open(CACHE_NAME)
            .then((cache) => cache.put("./index.html", responseCopy));
          return response;
        })
        .catch(() => caches.match("./index.html"))
    );
    return;
  }

  event.respondWith(
    caches.match(event.request)
      .then((cachedResponse) => cachedResponse || fetch(event.request))
  );
});
