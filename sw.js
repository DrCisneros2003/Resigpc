/*  ResiGPC · Service Worker (v2)
 *
 *  QUÉ CAMBIÓ Y POR QUÉ:
 *  La versión anterior guardaba index.html en caché y SIEMPRE lo servía desde ahí.
 *  Eso hacía que quien tuviera la app instalada se quedara con una versión vieja
 *  para siempre, aunque tú subieras una nueva a GitHub.
 *
 *  Ahora se usan dos estrategias distintas:
 *   - La APP (index.html y la navegación): primero se busca en la red. Si hay internet
 *     el alumno siempre recibe la última versión que subiste. Si no hay internet,
 *     se usa la copia guardada y la app sigue funcionando sin conexión.
 *   - Los ARCHIVOS FIJOS (iconos, manifiesto): primero la caché, porque casi nunca
 *     cambian y así la app abre al instante.
 *
 *  El nombre del caché cambió a v2, lo que borra automáticamente el caché viejo
 *  de todos los usuarios la primera vez que abran la app con conexión.
 */

const CACHE = "resigpc-v2";
const CORE = ["./", "./index.html", "./manifest.json", "./icon-192.png", "./icon-512.png"];

self.addEventListener("install", e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(CORE)).catch(() => {}));
  self.skipWaiting();
});

self.addEventListener("activate", e => {
  e.waitUntil(
    caches.keys()
      .then(k => Promise.all(k.filter(x => x !== CACHE).map(x => caches.delete(x))))
      .then(() => self.clients.claim())
  );
});

// Permite que la app pida al service worker que se actualice de inmediato
self.addEventListener("message", e => {
  if (e.data === "actualizar") self.skipWaiting();
});

function esLaApp(req, url) {
  return req.mode === "navigate" ||
         url.pathname.endsWith("/") ||
         url.pathname.endsWith("/index.html");
}

self.addEventListener("fetch", e => {
  const req = e.request;
  if (req.method !== "GET") return;

  const url = new URL(req.url);
  if (url.origin !== location.origin) return; // no tocar Supabase ni el Tutor

  // La app: primero la red, con la caché como respaldo sin conexión
  if (esLaApp(req, url)) {
    e.respondWith(
      fetch(req)
        .then(resp => {
          const copia = resp.clone();
          caches.open(CACHE).then(c => c.put("./index.html", copia)).catch(() => {});
          return resp;
        })
        .catch(() => caches.match("./index.html").then(hit => hit || caches.match("./")))
    );
    return;
  }

  // Archivos fijos: primero la caché
  e.respondWith(
    caches.match(req).then(hit => hit || fetch(req).then(resp => {
      const copia = resp.clone();
      caches.open(CACHE).then(c => c.put(req, copia)).catch(() => {});
      return resp;
    }).catch(() => caches.match("./index.html")))
  );
});
