# Contract: Service worker (Serwist) y sesión client-side

## Precondición: HTML público independiente de la sesión

Antes de que cualquier estrategia de caché de este documento pueda aplicarse
a `/` o `/mascotas/[slug]`, esas rutas deben devolver el mismo documento sin
importar quién las pida (research.md §1). El contrato de esa precondición:

```ts
// src/components/auth/session-provider.tsx — única suscripción, montada en app/layout.tsx
// src/hooks/use-session.ts — useContext() sobre lo que expone SessionProvider
function useSession(): { isAuthenticated: boolean; loading: boolean }
// Lee supabase.auth.getSession() al montar + se suscribe a onAuthStateChange.
// loading=true hasta la primera resolución — <AdminOnly> no renderiza nada
// (ni el estado "sin sesión") mientras loading es true, para no mostrar un
// parpadeo de "sin controles" antes de confirmar que efectivamente no hay
// sesión. isAuthenticated, no isAdmin: mismo criterio que el código actual
// (`{user && ...}`) y que la feature 002 fijó a propósito — no hay chequeo
// de membresía en `admins` del lado del cliente, RLS es quien distingue
// una cuenta autorizada al momento de escribir (research.md §1).
```

```tsx
// src/components/auth/admin-only.tsx
"use client"
function AdminOnly({ children }: { children: React.ReactNode }): JSX.Element | null
// Server Components de app/page.tsx y app/mascotas/[slug]/page.tsx dejan de
// llamar supabase.auth.getUser() para decidir qué renderizar. El botón
// "Editar", el enlace "Agregar hito" y el link "Iniciar sesión" / botón de
// logout de session-nav-link.tsx pasan a vivir dentro de <AdminOnly> /
// useSession(), evaluados en el navegador después de hidratar.
```

**Garantía que este contrato debe sostener**: una request a
`/mascotas/labrador-del-parque` con sesión admin activa nunca devuelve HTML
de servidor que un visitante sin sesión no recibiría. Se verifica en
`tests/e2e/anonymous-visibility.spec.ts` (ya existente de la feature 2,
extendido) por **ausencia de contenido**, no por comparación byte a byte
—una comparación exacta es frágil ante cualquier diferencia incidental
(timestamps, ids generados, whitespace de build): se hace un fetch
autenticado (con la cookie de sesión admin) contra esas dos rutas y se
asserta que el HTML devuelto por el servidor, antes de hidratar, no contiene
ningún string exclusivo de administración ("Editar", "Agregar hito", "Cerrar
sesión").

## Registro y alcance

```ts
// next.config.ts
import withSerwistInit from "@serwist/next"

const withSerwist = withSerwistInit({
  swSrc: "app/sw.ts",
  swDest: "public/sw.js",
})

export default withSerwist(nextConfig)
```

```ts
// app/sw.ts
import { defaultCache } from "@serwist/next/worker"
import { Serwist } from "serwist"

const serwist = new Serwist({
  precacheEntries: self.__SW_MANIFEST,
  skipWaiting: false,       // nunca automático — ver "Actualizaciones" abajo
  clientsClaim: true,
  navigationPreload: true,
  runtimeCaching: [
    // ver tabla de estrategias, research.md §5
  ],
})

self.addEventListener("message", (event) => {
  if (event.data?.type === "SKIP_WAITING") self.skipWaiting()
})

serwist.addEventListeners()
```

## Estrategias por grupo de ruta

Ver la tabla completa en research.md §5. Resumen del contrato que cada grupo
debe cumplir:

| Grupo | Estrategia | Debe garantizar |
|---|---|---|
| Shell (JS/CSS de build) | Precache | Disponible sin conexión desde la primera visita exitosa, sin depender de haber visitado una URL específica. |
| `pet-photos` (Storage) | `CacheFirst`, `maxEntries: 200`, `maxAgeSeconds: 30 días` | Requiere `<Image unoptimized>` (research.md §5) para que la request matchee la URL de Storage. Una foto ya vista no vuelve a pedirse por red; el límite es explícito y documentado (no un recorte silencioso). |
| `*/rest/v1/**`, solo `GET` (datos) | `NetworkFirst`, `networkTimeoutSeconds: 3` | Con conexión, siempre el dato más fresco; sin conexión (o con timeout), lo último cacheado. El POST de `mark_sighting` nunca pasa por acá. |
| `*/auth/v1/**` | **Ninguna entrada — nunca se cachea** | Un intento de login/refresh de sesión jamás recibe una respuesta vieja. |
| `/`, `/mascotas/[slug]` (documento + payload RSC) | `NetworkFirst`, `matchOptions: { ignoreSearch: true }` | Solo válido bajo la precondición de HTML sin sesión de más arriba; `ignoreSearch` evita que el hash de `?_rsc=` de la navegación client-side fragmente la caché por build (research.md §5). |
| Rutas protegidas (`/login`, `/mascotas/nueva`, `/mascotas/*/editar`, `/mascotas/*/hitos/**`) | Sin entrada (siempre red) | Fuera del alcance offline de esta feature; no deben quedar cacheadas por accidente por ninguna regla genérica. |

## Actualizaciones

```ts
// src/hooks/use-sw-update.ts
function useSwUpdate(): { updateAvailable: boolean; reload: () => void }
// Se suscribe a navigator.serviceWorker.ready → registration.addEventListener
// ("updatefound", ...) → el nuevo worker instalado dispara updateAvailable.
// reload() hace postMessage({ type: "SKIP_WAITING" }) al worker en espera y
// escucha controllerchange para recién ahí hacer location.reload().
```

**Contrato**: ningún usuario pierde trabajo en curso por una actualización
silenciosa. Un service worker nuevo instalado nunca toma control hasta que
`reload()` se invoca explícitamente desde `<UpdateAvailableBanner>`.

## Manifiesto (`app/manifest.ts`)

```ts
import type { MetadataRoute } from "next"

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "PetDex",
    short_name: "PetDex",
    display: "standalone",
    theme_color: "#2563EB",
    background_color: "#FAFAFA",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
  }
}
```

`apple-touch-icon` se referencia aparte, en `app/layout.tsx`
(`metadata.icons.apple = "/icons/apple-touch-icon.png"`) — iOS no lee
`manifest.json` para el ícono de instalación a pantalla de inicio.
