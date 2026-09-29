// Kill-switch service worker: si disinstalla, pulisce le cache, non
// manda più messaggi di reload ai client. Niente più navigazioni
// forzate che facevano perdere form aperti.
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
