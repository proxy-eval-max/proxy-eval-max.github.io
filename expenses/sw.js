// Just enough service worker to be installable and to open with no signal.
//
// Network-first, always. A cache-first shell on GitHub Pages is how you end up
// shipping a fix that nobody receives for a week; here the network wins whenever
// it answers, and the cache is only a fallback. Firestore's own persistence
// handles the data — this only covers the shell.

const CACHE = "whose-turn-v1";
const SHELL = [
  "./",
  "./index.html",
  "./css/styles.css",
  "./icon.svg",
  "./manifest.json",
];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (e) => {
  e.waitUntil((async () => {
    for (const key of await caches.keys()) if (key !== CACHE) await caches.delete(key);
    await self.clients.claim();
  })());
});

self.addEventListener("fetch", (e) => {
  const { request } = e;
  // Only our own static files. Firebase and the font CDN handle themselves, and
  // caching an auth or Firestore response would be a genuinely bad idea.
  if (request.method !== "GET") return;
  if (new URL(request.url).origin !== self.location.origin) return;

  e.respondWith((async () => {
    try {
      const fresh = await fetch(request);
      const cache = await caches.open(CACHE);
      cache.put(request, fresh.clone());
      return fresh;
    } catch {
      const hit = await caches.match(request);
      if (hit) return hit;
      // A navigation with nothing cached for that exact URL still gets the shell.
      if (request.mode === "navigate") {
        const shell = await caches.match("./index.html");
        if (shell) return shell;
      }
      throw new Error("offline");
    }
  })());
});
