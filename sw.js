/* =====================================================
   SERVICE WORKER - MI APP PERSONAL
   Este archivo hace que la app funcione sin internet.
   El navegador lo ejecuta en segundo plano.
===================================================== */

const VERSION_CACHE = 'mi-app-v1';

/* Lista de archivos que se guardan para usar sin internet */
const ARCHIVOS_CACHE = [
  '/',
  '/index.html',
  '/manifest.json',
  '/css/main.css',
  '/css/components.css',
  '/js/app.js',
  '/js/db.js',
  '/js/router.js',
  '/js/modules/dashboard.js',
  '/js/modules/agenda.js',
  '/js/modules/tareas.js',
  '/js/modules/notas.js',
  '/js/modules/finanzas.js',
  '/js/modules/datos.js',
  '/js/modules/contactos.js',
  '/js/modules/conversor.js',
  '/js/modules/ordenar.js',
  '/pages/agenda.html',
  '/pages/tareas.html',
  '/pages/notas.html',
  '/pages/finanzas.html',
  '/pages/datos.html',
  '/pages/contactos.html',
  '/pages/conversor.html',
  '/pages/ordenar.html',
  '/libs/chart.min.js',
  '/libs/xlsx.min.js'
];

/* Cuando se instala: guarda todos los archivos en caché */
self.addEventListener('install', (evento) => {
  evento.waitUntil(
    caches.open(VERSION_CACHE).then((cache) => {
      return cache.addAll(ARCHIVOS_CACHE.filter(url => !url.includes('libs')));
    })
  );
  self.skipWaiting();
});

/* Cuando se activa: elimina cachés viejos */
self.addEventListener('activate', (evento) => {
  evento.waitUntil(
    caches.keys().then((claves) => {
      return Promise.all(
        claves
          .filter(clave => clave !== VERSION_CACHE)
          .map(clave => caches.delete(clave))
      );
    })
  );
  self.clients.claim();
});

/* Cuando se pide un recurso: primero busca en caché, luego en red */
self.addEventListener('fetch', (evento) => {
  if (evento.request.method !== 'GET') return;

  evento.respondWith(
    caches.match(evento.request).then((respuestaCache) => {
      if (respuestaCache) {
        return respuestaCache; /* Devuelve desde caché (funciona sin internet) */
      }
      /* Si no está en caché, busca en internet */
      return fetch(evento.request).then((respuestaRed) => {
        if (!respuestaRed || respuestaRed.status !== 200) {
          return respuestaRed;
        }
        /* Guarda en caché para la próxima vez */
        const copiaRespuesta = respuestaRed.clone();
        caches.open(VERSION_CACHE).then((cache) => {
          cache.put(evento.request, copiaRespuesta);
        });
        return respuestaRed;
      }).catch(() => {
        /* Sin internet y sin caché: muestra la página principal */
        return caches.match('/index.html');
      });
    })
  );
});
