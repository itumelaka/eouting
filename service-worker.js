const CACHE_NAME = "eouting-cache-v1.4.1";

const APP_SHELL_ASSETS = [
  "./",
  "./index.html",
  "./assets/style.css?v=1.4.1",
  "./assets/app.js?v=1.4.1",
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
        APP_SHELL_ASSETS.map((asset) => cache.add(asset).catch(() => null))
      ))
      .then(() => self.skipWaiting())
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
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") {
    return;
  }

  const requestUrl = new URL(event.request.url);

  if (event.request.mode === "navigate" || requestUrl.pathname.endsWith("/index.html")) {
    event.respondWith(networkFirst(event.request, "./index.html"));
    return;
  }

  if (isFreshAsset_(requestUrl)) {
    event.respondWith(networkFirst(event.request));
    return;
  }

  event.respondWith(staleWhileRevalidate(event.request));
});

function isFreshAsset_(url) {
  return (
    url.pathname.endsWith("/assets/app.js") ||
    url.pathname.endsWith("/assets/style.css") ||
    url.pathname.endsWith("/service-worker.js") ||
    url.pathname.endsWith("/manifest.json")
  );
}

async function networkFirst(request, fallbackUrl) {
  const cache = await caches.open(CACHE_NAME);

  try {
    const response = await fetch(request);
    if (response && response.ok) {
      cache.put(request, response.clone());
    }
    return response;
  } catch (error) {
    return (await cache.match(request)) ||
      (fallbackUrl ? await cache.match(fallbackUrl) : null) ||
      new Response("Offline", { status: 504, statusText: "Offline" });
  }
}

async function staleWhileRevalidate(request) {
  const cache = await caches.open(CACHE_NAME);
  const cachedResponse = await cache.match(request);
  const networkResponsePromise = fetch(request)
    .then((response) => {
      if (response && response.ok) {
        cache.put(request, response.clone());
      }
      return response;
    })
    .catch(() => null);

  return cachedResponse ||
    await networkResponsePromise ||
    new Response("Offline", { status: 504, statusText: "Offline" });
}
