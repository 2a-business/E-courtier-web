/* Service Worker E-Courtier — mode hors ligne partiel.
 * Mis en cache : coquille de l'application, ressources statiques versionnées, et réponses
 * publiques de recherche / fiches d'annonces SANS en-tête Authorization (affichées hors ligne).
 * Jamais mis en cache : authentification, justificatifs, paiements, contrats, visites,
 * administration, assistant, ni aucune requête authentifiée ou non-GET. */
const VERSION = "ec-v1";
const SHELL = `${VERSION}-shell`;
const STATIC = `${VERSION}-static`;
const DATA = `${VERSION}-public-data`;
const PUBLIC_API = [/\/api\/v1\/search\/listings\/?$/, /\/api\/v1\/search\/locations\/?$/, /\/api\/v1\/listings\/[0-9a-f-]{36}\/?$/, /\/api\/v1\/amenities\/?$/];
const NEVER = [/\/api\/v1\/(auth|verification|transactions|contracts|visits|admin|assistant|notifications|reports)\b/, /\/private/];
const MAX_DATA_ENTRIES = 60;

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(SHELL).then((c) => c.addAll(["/", "/favicon.svg", "/manifest.webmanifest", "/hero-dakar-sm.jpg"])).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => !k.startsWith(VERSION)).map((k) => caches.delete(k)))).then(() => self.clients.claim()),
  );
});

async function trim(cacheName) {
  const cache = await caches.open(cacheName);
  const keys = await cache.keys();
  for (const key of keys.slice(0, Math.max(0, keys.length - MAX_DATA_ENTRIES))) await cache.delete(key);
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (NEVER.some((r) => r.test(url.pathname))) return;
  if (request.headers.has("Authorization")) return;

  // Données publiques : réseau d'abord, cache en secours (hors ligne).
  if (PUBLIC_API.some((r) => r.test(url.pathname))) {
    event.respondWith(
      fetch(request)
        .then((res) => {
          if (res.ok) {
            const copy = res.clone();
            caches.open(DATA).then((c) => c.put(request, copy)).then(() => trim(DATA));
          }
          return res;
        })
        .catch(() => caches.match(request).then((hit) => hit || Response.error())),
    );
    return;
  }
  if (url.origin !== self.location.origin) return;

  // Ressources versionnées (hash dans le nom) et photos publiques : cache d'abord.
  if (url.pathname.startsWith("/assets/") || url.pathname.startsWith("/media/listings/")) {
    event.respondWith(
      caches.match(request).then((hit) => hit || fetch(request).then((res) => {
        if (res.ok) caches.open(STATIC).then((c) => c.put(request, res.clone()));
        return res;
      })),
    );
    return;
  }
  // Navigation : réseau d'abord, coquille en secours.
  if (request.mode === "navigate") {
    event.respondWith(fetch(request).catch(() => caches.match("/")));
  }
});
