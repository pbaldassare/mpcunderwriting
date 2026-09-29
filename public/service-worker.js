// Alias di /sw.js — vedi public/sw.js. Kill-switch silenzioso, nessun reload forzato.
const cleanup = async () => {
  try {
    await self.clients.claim();
    const names = await caches.keys();
    await Promise.all(names.map((n) => caches.delete(n)));
    await self.registration.unregister();
  } catch {
    // best effort
  }
};

self.addEventListener("install", (event) => event.waitUntil(self.skipWaiting()));
self.addEventListener("activate", (event) => event.waitUntil(cleanup()));
self.addEventListener("fetch", (event) => {
  event.respondWith(fetch(event.request, { cache: "no-store" }));
});
