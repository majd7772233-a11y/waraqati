const CACHE_PREFIX = "waraqati-shell-";
const CACHE_NAME = `${CACHE_PREFIX}v1`;
const APP_ROOT = new URL("./", self.registration.scope).toString();

self.addEventListener("install", event => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME);
    await cache.add(APP_ROOT);
    const shell = await cache.match(APP_ROOT);
    if (shell) {
      const html = await shell.text();
      const assetPaths = [...html.matchAll(/(?:src|href)="([^"]+\\.(?:js|css|webmanifest)(?:\\?[^"]*)?)"/g)].map(match => new URL(match[1], APP_ROOT).toString());
      await Promise.all(assetPaths.map(async asset => {
        try { await cache.add(asset); } catch { /* One optional asset must not prevent installation. */ }
      }));
    }
    await self.skipWaiting();
  })());
});

self.addEventListener("activate", event => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(key => key.startsWith(CACHE_PREFIX) && key !== CACHE_NAME).map(key => caches.delete(key)));
    await self.clients.claim();
  })());
});

self.addEventListener("fetch", event => {
  const request = event.request;
  if (request.method !== "GET" || new URL(request.url).origin !== self.location.origin) return;
  event.respondWith((async () => {
    const cache = await caches.open(CACHE_NAME);
    const url = new URL(request.url);
    const isNavigation = request.mode === "navigate";
    if (isNavigation) {
      try {
        const response = await fetch(request);
        if (response.ok) await cache.put(APP_ROOT, response.clone());
        return response;
      } catch {
        return (await cache.match(APP_ROOT)) || Response.error();
      }
    }
    const cached = await cache.match(request);
    if (cached) return cached;
    try {
      const response = await fetch(request);
      if (response.ok && (url.pathname.includes("/assets/") || url.pathname.endsWith(".webmanifest"))) {
        await cache.put(request, response.clone());
      }
      return response;
    } catch {
      return cached || Response.error();
    }
  })());
});
