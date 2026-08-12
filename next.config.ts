import type { NextConfig } from "next"
import withSerwistInit from "@serwist/next"

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "owfxiyhqnkuquagsxbid.supabase.co",
        pathname: "/storage/v1/object/public/**",
      },
    ],
  },
}

const withSerwist = withSerwistInit({
  swSrc: "app/sw.ts",
  swDest: "public/sw.js",
  // register: true (default) alcanza — @serwist/next inyecta el registro
  // del service worker solo, sin un componente propio.
  // reloadOnOnline recargaría toda la app apenas vuelve la señal; el sync
  // de la cola offline (User Story 5) ya reacciona al evento `online` por su
  // cuenta, sin recargar la página (quickstart.md Validación 4).
  reloadOnOnline: false,
  // Un service worker activo bajo `next dev` intercepta el propio tráfico
  // de Fast Refresh — se comprobó que rompe el submit de formularios (el
  // click handler de React deja de dispararse y el navegador cae a un
  // submit nativo por GET). quickstart.md ya recomienda `next build && next
  // start` para probar caché/PWA de forma realista; acá se vuelve
  // obligatorio, no solo recomendado.
  disable: process.env.NODE_ENV === "development",
  // /offline (app/offline/page.tsx) es el fallback de app/sw.ts para FR-017
  // — precachePrerendered (default) no produjo ningún .html de App Router
  // para precachear en esta versión, así que se agrega a mano. `revision`
  // es un cache-bust manual: subirlo cuando cambie el contenido de esa
  // página (no tiene un hash de build propio, a diferencia de los chunks
  // JS/CSS).
  additionalPrecacheEntries: [{ url: "/offline", revision: "1" }],
})

export default withSerwist(nextConfig)
