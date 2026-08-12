// Fuente del service worker (Serwist, contracts/service-worker.md).
// Typecheckeado aparte, con tsconfig.worker.json (lib "webworker", sin
// "dom") — mezclar "webworker" y "dom" en el mismo programa de `tsc` rompe
// los globals (`window`, `document`, etc.) del resto de la app. `npm run
// typecheck` corre los dos programas. No usa
// `defaultCache` de @serwist/next/worker a propósito: esa lista incluye una
// regla catch-all `!sameOrigin → NetworkFirst` que cachearía cualquier
// origen cruzado, incluido `*/auth/v1/**` — exactamente lo que este archivo
// tiene prohibido (research.md §5, "nunca cachear peticiones a auth/v1").
// Cada regla de acá es explícita y acotada por su cuenta.

import type { PrecacheEntry, SerwistGlobalConfig } from "serwist"
import { CacheableResponsePlugin, CacheFirst, ExpirationPlugin, NetworkFirst, Serwist } from "serwist"

declare global {
  interface WorkerGlobalScope extends SerwistGlobalConfig {
    __SW_MANIFEST: (PrecacheEntry | string)[] | undefined
  }
}

declare const self: ServiceWorkerGlobalScope

// Serwist's RegExpRoute solo acepta un RegExp "pelado" como matcher si
// matchea desde el índice 0 de la URL completa en requests cross-origin
// (si no, lo descarta en silencio — así quedaban vacías pet-photos-cache y
// petdex-data-cache, verificado a mano). Con un matcher función en vez de
// RegExp no aplica esa restricción: se evalúa contra `url` ya parseada.
const SUPABASE_HOST_PATTERN = /\.supabase\.co$/

// "/mascotas/nueva" tiene la misma forma de path que "/mascotas/{slug}"
// pero es una ruta protegida (alta de mascota) — se excluye a mano.
const PET_DETAIL_PATTERN = /^\/mascotas\/[^/]+$/
const RESERVED_PET_PATH = "/mascotas/nueva"

const serwist = new Serwist({
  precacheEntries: self.__SW_MANIFEST,
  skipWaiting: false, // nunca automático — <UpdateAvailableBanner> lo dispara a mano
  clientsClaim: true,
  navigationPreload: true,
  runtimeCaching: [
    {
      matcher: ({ url }) =>
        SUPABASE_HOST_PATTERN.test(url.hostname) &&
        url.pathname.startsWith("/storage/v1/object/public/pet-photos/"),
      handler: new CacheFirst({
        cacheName: "pet-photos-cache",
        plugins: [
          // <Image unoptimized> pide la foto cross-origin sin `crossorigin`,
          // así que el browser la fetchea en modo "no-cors" — la respuesta
          // que ve el service worker es "opaque" (status 0). Sin este
          // plugin, la regla de cacheable-response por default de Serwist
          // descarta cualquier respuesta que no sea 200 y CacheFirst nunca
          // llega a escribir nada en la caché (se verificó vacía sin esto).
          new CacheableResponsePlugin({ statuses: [0, 200] }),
          new ExpirationPlugin({
            maxEntries: 200,
            maxAgeSeconds: 30 * 24 * 60 * 60,
          }),
        ],
      }),
    },
    {
      matcher: ({ url }) =>
        SUPABASE_HOST_PATTERN.test(url.hostname) && url.pathname.startsWith("/rest/v1/"),
      method: "GET",
      handler: new NetworkFirst({
        cacheName: "petdex-data-cache",
        networkTimeoutSeconds: 3,
      }),
    },
    {
      // / y /mascotas/[slug] — documento HTML de una carga completa y el
      // payload RSC de una navegación client-side (research.md §5,
      // "Navegación client-side y RSC"). matchOptions.ignoreSearch evita
      // que el hash `?_rsc=` fragmente la caché por build.
      matcher: ({ sameOrigin, url }) => {
        if (!sameOrigin) return false
        if (url.pathname === "/") return true
        if (url.pathname === RESERVED_PET_PATH) return false
        return PET_DETAIL_PATTERN.test(url.pathname)
      },
      handler: new NetworkFirst({
        cacheName: "petdex-pages-cache",
        networkTimeoutSeconds: 3,
        matchOptions: { ignoreSearch: true },
      }),
    },
    // */auth/v1/** deliberadamente sin ninguna regla: al no matchear nada,
    // la request va directo a red, siempre — nunca una sesión vieja
    // cacheada. Cualquier otra ruta (/login, /mascotas/*/editar,
    // /mascotas/*/hitos/**) tampoco matchea ninguna regla de arriba: quedan
    // fuera del alcance offline por diseño, sin necesidad de una regla
    // explícita de exclusión.
  ],
  // FR-017: sin conexión y sin ese contenido cacheado, nunca una pantalla en
  // blanco ni el error crudo del navegador — /offline se agrega a mano al
  // manifest de precache vía additionalPrecacheEntries (next.config.ts):
  // precachePrerendered (default de @serwist/next) no encontró ningún .html
  // de App Router para precachear en esta combinación de versiones
  // (verificado leyendo public/sw.js generado — 0 entradas .html pese al
  // build estático), así que ninguna página offline quedaría disponible en
  // el primer uso sin conexión (spec.md Edge Cases, "la app se abre sin
  // conexión ... sin ningún contenido cacheado todavía") sin este agregado
  // explícito.
  fallbacks: {
    entries: [
      {
        url: "/offline",
        matcher: ({ request }) => request.destination === "document",
      },
    ],
  },
})

self.addEventListener("message", (event) => {
  if (event.data?.type === "SKIP_WAITING") self.skipWaiting()
})

serwist.addEventListeners()
