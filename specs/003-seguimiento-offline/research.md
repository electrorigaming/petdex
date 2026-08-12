# Research: Seguimiento diario y funcionamiento offline

## §0. Verificación del esquema existente

`petdex-schema.sql` y `src/types/database.ts` ya incluyen todo lo que esta
feature necesita del lado de la base — se verificó antes de escribir este
plan, no se genera nada nuevo:

- Tabla `sightings(id, pet_id, seen_on date, seen boolean, note, created_at)`,
  `unique(pet_id, seen_on)` — la ausencia de fila ya es "sin registro" a nivel
  de esquema.
- Trigger `sightings_no_future` — rechaza `seen_on > current_date` en la base,
  no solo en la UI (defensa en profundidad para FR-015).
- Función `mark_sighting(p_pet_id, p_seen, p_date, p_note)` — upsert
  idempotente vía `on conflict (pet_id, seen_on) do update`, `security
  invoker` (research.md §6 explica por qué esto importa para la cola offline).
- Políticas `sightings_public_read` (cualquiera lee) y `sightings_admin_write`
  (`for all to authenticated using/with check is_admin()`).
- `pets.registered_on` — ya es el límite inferior del calendario (FR-005).

**Decisión**: cero migraciones. Todo el trabajo de esta feature es de
aplicación (Next.js) y de cliente (IndexedDB, service worker).

## §1. HTML que no depende de la sesión

**Problema**: `app/page.tsx` y `app/mascotas/[slug]/page.tsx` son Server
Components que llaman `supabase.auth.getUser()` y renderizan condicionalmente
(`{user && <Link href=".../editar">Editar</Link>}`, `isAdmin` pasado como
prop a `MilestoneTimeline`). Esto significa que el HTML que Next.js devuelve
hoy ya es distinto según quién lo pida. Mientras la única capa de caché era
el propio navegador (sin service worker), eso no era un problema: cada
request vuelve a pasar por el servidor, que vuelve a chequear la sesión.

Un service worker cambia esa garantía. Si se cachea la respuesta HTML de
`/mascotas/labrador-del-parque` con una estrategia `NetworkFirst` (research.md
§5) para que quede disponible sin conexión, la respuesta cacheada es la que
_esa sesión particular_ recibió en el último fetch exitoso. Un mismo
dispositivo puede pasar de tener sesión admin a no tenerla (logout, expiración
de token) sin que el service worker lo sepa — y sin conexión, no hay forma de
revalidar. El resultado: un visitante sin sesión ve un botón "Editar" que no
va a funcionar (RLS lo va a rechazar si logra ejecutar algo, Principio I no
se rompe), pero la experiencia queda rota y potencialmente confusa, exacto lo
que este plan debe evitar.

**Decisión**: mover todo el chequeo de sesión que afecta el HTML de `/` y
`/mascotas/[slug]` de Server Component a Client Component. El servidor
siempre devuelve el mismo documento —el de "sin sesión"— para esas dos rutas;
la sesión se resuelve en el navegador, después de hidratar, y decide ahí si
mostrar los controles de administración.

`<SessionProvider>` (montado una sola vez en `app/layout.tsx`) hace la única
suscripción a `supabase.auth.getSession()` + `onAuthStateChange` de toda la
app y la expone por contexto; `useSession()` es simplemente `useContext(...)`
sobre ese valor — evita que cada componente que necesita saber si hay sesión
(`<AdminOnly>`, `<MarkTodayControl>`, `<PastDayDialog>`, `SessionNavLink`)
abra su propia suscripción por separado. Un envoltorio `<AdminOnly>`
reemplaza los `{user && ...}` actuales.

El hook expone `isAuthenticated`, no `isAdmin` — a propósito, mismo criterio
que ya usa el código actual (`{user && ...}`) y que la feature 002 fijó
explícitamente (`contracts/auth-flow.md` de esa feature: "no hay forma de
saber de antemano si es admin sin intentar escribir"). `<AdminOnly>` sigue
mostrando sus controles a cualquier sesión autenticada, sin verificar
membresía en `admins` de antemano; sigue siendo la política RLS, evaluada
recién al escribir, la que efectivamente distingue una cuenta autorizada de
una que no lo es (Principio I). Este plan no cambia ese comportamiento, solo
lo mueve de dónde se evalúa.

```tsx
// src/components/auth/admin-only.tsx
"use client"
export function AdminOnly({ children }: { children: React.ReactNode }) {
  const { isAuthenticated } = useSession()
  if (!isAuthenticated) return null
  return <>{children}</>
}
```

**Costo aceptado**: un destello donde el botón "Editar" no está durante el
primer render (hasta que `useSession()` resuelve), incluso con sesión activa.
Es preferible al riesgo de servir la interfaz de administración a quien no
tiene sesión — y es exactamente el mismo patrón que ya usa `SessionNavLink`
hoy salvo que corría en el servidor; ahora corre en el cliente.

**Fuera de este cambio**: `/login`, `/mascotas/nueva`, `/mascotas/[slug]/editar`,
`/mascotas/[slug]/hitos/**` — protegidas por `middleware.ts`, no forman parte
del alcance offline de esta feature (FR-014/User Story 3: corregir requiere
conexión) y no se precachean ni se sirven `NetworkFirst`.

**Alternativas consideradas**:
- *No cambiar nada, excluir esas dos rutas del caché del service worker*:
  descartada — son exactamente las rutas que la Clarification y FR-017
  piden que sigan disponibles sin conexión (cuadrícula y fichas visitadas).
- *Partial Prerendering (PPR) de Next.js* para servir un shell estático y
  streamear la parte de sesión: descartada por ahora — es experimental en la
  versión de Next.js ya instalada (15.1.3) y resolvería el problema de
  rendimiento, no el de fondo: el HTML final que el navegador termina
  recibiendo seguiría variando por sesión, que es justo lo que no se puede
  cachear como si fuera universal.

## §2. Fechas: módulo propio, strings de punta a punta

**Problema**: `current_date` en Postgres es UTC; el barrio opera en UTC-3.
Si se omite pasar `p_date` explícito a `mark_sighting`, un avistamiento
marcado a las 22:00 hora local (01:00 UTC del día siguiente) quedaría
registrado con la fecha equivocada. Además, convertir `date` de Postgres a
`Date` de JavaScript y de vuelta introduce corrimientos de zona horaria
silenciosos (`new Date("2026-08-10")` se interpreta como medianoche UTC, no
medianoche local).

**Decisión**: un único módulo, `src/lib/dates.ts`, es el único lugar del
proyecto que instancia `Date`. Todo lo demás —queries, la cola offline, el
cálculo de racha, las props de los componentes— opera sobre strings
`YYYY-MM-DD` y los compara lexicográficamente (funciona porque el formato es
de ancho fijo y de mayor a menor magnitud).

```ts
// src/lib/dates.ts
const LOCAL_OFFSET_HOURS = -3 // UTC-3 fijo — el barrio no observa horario de verano

export function todayLocal(): string {
  const now = new Date()
  const local = new Date(now.getTime() + LOCAL_OFFSET_HOURS * 3600_000)
  return local.toISOString().slice(0, 10)
}

export function isFuture(dateStr: string): boolean {
  return dateStr > todayLocal()
}

export function compareDates(a: string, b: string): -1 | 0 | 1 { /* comparación de strings */ }
export function addDays(dateStr: string, delta: number): string { /* vía Date interno, string in/out */ }
export function startOfMonth(dateStr: string): string
export function daysInMonthRange(year: number, month: number): string[] // todos los YYYY-MM-DD del mes
export function monthLabel(year: number, month: number): string // "agosto 2026"
```

Cada función recibe y devuelve `string`; `Date` nunca sale del módulo. Se
testea explícitamente el caso límite: marcar a las 22:00 hora local (01:00
UTC del día siguiente) debe devolver la fecha de hoy, no la de mañana
(`tests/unit/dates.test.ts`, mockeando `Date` con un instante fijo cerca de
la medianoche UTC).

**Alternativas consideradas**:
- `date-fns` / `date-fns-tz`: descartada — el proyecto no maneja múltiples
  zonas horarias ni recurrencias; un offset fijo de 3 horas y comparación de
  strings cubre el 100% del caso de uso con cero dependencias nuevas.
- Calcular la fecha local en el servidor (Server Action) en vez del cliente:
  descartada — el pedido original es explícito: "la fecha local se calcula
  siempre en el cliente", porque el reloj y la percepción de "hoy" que
  importan son los del teléfono de la administradora en la calle, no los del
  servidor (que además podría estar en otra zona horaria, típicamente UTC en
  Vercel).

## §3. Cola offline: IndexedDB con `idb`

**Alcance**: solo el marcado del día de hoy (User Story 1/5) pasa por la
cola. Corregir un día pasado desde el calendario (User Story 3) requiere
conexión — si falla, se muestra un error y no se encola (Clarifications,
spec.md).

**Decisión**: un store de IndexedDB, `pending_sightings`, usando `idb`
(wrapper de ~1 KB sobre la API nativa con Promesas en vez de callbacks —
la razón de no usar `indexedDB` a mano: el código de manejo de errores y
transacciones a mano es considerablemente más largo y más fácil de dejar mal,
para un beneficio nulo en un store tan simple).

```ts
// src/lib/offline/db.ts
type PendingSighting = {
  key: string          // `${petId}:${seenOn}` — ver más abajo
  petId: string
  seenOn: string        // YYYY-MM-DD, capturado con todayLocal() al marcar, nunca al sincronizar
  seen: boolean          // true = visto, false = revisado y no estaba
  queuedAt: string       // ISO timestamp, solo para mostrar "hace X" en la UI, no se envía al RPC
  status: "pending" | "syncing" | "failed"
  failureReason: string | null
}
```

**Clave de la cola**: `{pet_id}:{seen_on}`, exactamente como la restricción
`unique(pet_id, seen_on)` de la tabla. `enqueueSighting()` hace `put()` (no
`add()`): marcar el mismo día dos veces sin conexión sobrescribe la entrada
en vez de encolar dos envíos, igual que `mark_sighting` hace upsert en el
servidor (FR-022). Como `mark_sighting` es idempotente sobre esa misma clave,
reintentar un envío que en realidad ya llegó al servidor —por ejemplo, se
sincronizó pero la respuesta se perdió por un corte de red— no duplica nada:
el segundo intento simplemente vuelve a hacer upsert sobre la misma fila.

**Disparadores de sincronización** (nunca Background Sync API — no existe en
Safari/iOS, y el caso de uso principal es un teléfono en la calle):
1. Evento `online` en `window`.
2. Evento `visibilitychange` cuando `document.visibilityState === "visible"`
   (cubre volver a abrir la app después de tenerla en background sin haber
   disparado `online`, común en iOS cuando Safari suspende el listener).
3. Un intento al montar `<OfflineSyncProvider>` en `app/layout.tsx` (cubre
   abrir la app ya con conexión y una cola pendiente de la sesión anterior).

Los tres llaman a la misma función, `syncPendingSightings()`
(`src/lib/offline/sync.ts`), que no hace nada si `navigator.onLine` es falso
o si la cola está vacía — así los tres disparadores pueden solaparse sin
duplicar trabajo.

**Persistencia entre sesiones de la app**: IndexedDB sobrevive a cerrar la
app o el navegador (a diferencia de una variable en memoria) — cubre el edge
case de "la administradora marca sin conexión y cierra la app antes de
reconectar" (spec.md, Edge Cases). Se pierde solo si se desinstala la app o
se borran los datos del sitio, aceptado explícitamente en spec.md
(Assumptions).

**Alternativas consideradas**:
- `localStorage`: descartada — límite de tamaño más estrecho y compartido con
  cualquier otro uso futuro de ese origen, y obliga a serializar/parsear JSON
  a mano sin ninguna ventaja sobre IndexedDB para este caso.
- Background Sync API: descartada explícitamente en el pedido — sin soporte
  en Safari/iOS.
- Cola en memoria (Zustand/Context) sin persistencia: descartada — no
  sobrevive a cerrar la app, que es exactamente el edge case más probable de
  "sin conexión en la calle, se guarda el celular en el bolsillo".

## §4. Clasificación de errores: transitorio vs. permanente

**Regla** (ya fijada en la Clarification de spec.md): un error es permanente
si el servidor respondió con un rechazo explícito; es transitorio si no hubo
respuesta en absoluto (sin conexión, timeout, request que ni siquiera salió).

```ts
// src/lib/offline/sync-errors.ts
export type SyncErrorKind = "transient" | "permanent"

export function classifySyncError(error: unknown): SyncErrorKind {
  // Un error de red (fetch falla antes de llegar al servidor) no trae `code`
  // — es un TypeError ("Failed to fetch") o el objeto de error de red propio
  // del cliente de Supabase. Cualquier respuesta con `code` significa que el
  // servidor sí respondió, aunque sea para rechazar.
  const code = (error as { code?: string })?.code
  return code ? "permanent" : "transient"
}
```

Los dos casos concretos que se van a ver en la práctica son `42501` (la
política `sightings_admin_write` rechaza — la sesión expiró o nunca fue
admin) y una violación de clave foránea (`23503` — la mascota fue eliminada
mientras el dispositivo estaba sin conexión); ambos traen `code`, así que
caen en "permanent" con la misma regla, sin necesitar una lista cerrada de
códigos. `mapPostgresError()` (`src/lib/errors.ts`, ya existente) se
reutiliza para el mensaje que ve la administradora — se le agrega el mensaje
para `23503` si no está cubierto.

**Sobre una entrada "failed"**: no se reintenta sola nunca más
(`syncPendingSightings()` la salta). Queda visible con su motivo de falla y
un control para descartarla (FR-024); si la administradora quiere volver a
intentarlo, vuelve a tocar el control de marcado, lo que hace `put()` sobre
la misma clave y la deja en `pending` de nuevo — no hay un botón de
"reintentar" separado, es deliberado (Clarifications, spec.md).

**Alternativas consideradas**:
- Lista cerrada de códigos permanentes (`42501`, `23503`, `22007`, ...):
  descartada a favor de la regla general "hubo respuesta ⇒ permanente" —
  más simple, más difícil de dejar un código nuevo sin clasificar, y es
  exactamente lo que la Clarification de spec.md pidió.
- Límite de reintentos por tiempo/cantidad para transitorios: no se
  implementa — los tres disparadores (online, visibilitychange, mount) ya
  acotan naturalmente la frecuencia; no hay un loop de reintento activo que
  necesite un techo.

## §5. Service worker con Serwist

**Decisión**: `@serwist/next` (no `next-pwa`, sin mantenimiento desde 2023).
`app/sw.ts` es la fuente del service worker; `next.config.ts` se envuelve con
`withSerwistInit` de `@serwist/next`.

**Precache**: el shell de la aplicación (JS/CSS de build) vía el manifiesto
que Serwist inyecta automáticamente (`self.__SW_MANIFEST`). No se precachea
HTML de rutas — las páginas se sirven `NetworkFirst` en runtime (más abajo),
porque precachear una página fija en build time no tiene sentido para
contenido que cambia por mascota.

**Runtime caching** (`runtimeCaching` en la config de Serwist):

| Patrón | Estrategia | Notas |
|---|---|---|
| `https://*.supabase.co/storage/v1/object/public/pet-photos/**` | `CacheFirst` | Cache `pet-photos-cache`, `expiration: { maxEntries: 200, maxAgeSeconds: 30 días }` (límite explícito — se documenta acá, no se trunca sin avisar). Requiere el cambio de "fotos sin optimizar" descripto abajo; de lo contrario esta regla no matchea ninguna request real. |
| `https://*.supabase.co/rest/v1/**`, método `GET` únicamente | `NetworkFirst` | Cache `petdex-data-cache`, `networkTimeoutSeconds: 3`. Cubre la cuadrícula (`pets_overview`), la ficha y el calendario. **No incluye `/rest/v1/rpc/mark_sighting`**: ese POST nunca pasa por ninguna estrategia de caché — va directo a red, y su éxito/fracaso lo interpreta exclusivamente `classifySyncError` (research.md §4), no el service worker. |
| `https://*.supabase.co/auth/v1/**` | **Sin entrada — excluido explícitamente** | `NetworkOnly` de hecho, al no matchear ninguna regla de caché; nunca debe responder con una sesión vieja cacheada. |
| `/` y `/mascotas/[slug]` (documento HTML **y** el payload RSC de la navegación client-side) | `NetworkFirst`, cache key normalizado | Ver "Navegación client-side y RSC" abajo — es la parte más fácil de dejar rota en silencio. |
| Cualquier otra ruta (`/login`, `/mascotas/nueva`, `/mascotas/*/editar`, `/mascotas/*/hitos/**`) | Sin entrada (red) | Requieren conexión por diseño; no forman parte del alcance offline. |

### Fotos sin optimizar: la regla de caché tiene que matchear la request real

`pet-detail.tsx` y `pet-card.tsx` ya usan `next/image` con `remotePatterns`
apuntando al bucket de Supabase (`next.config.ts`). En producción eso hace
que el navegador pida `/_next/image?url=<storage-url-encodeada>&w=...&q=...`
—una URL propia de Next, con un ancho distinto por breakpoint del `srcset`—,
nunca la URL de `pet-photos` directamente. La regla `CacheFirst` de la tabla
de arriba matchea la URL de Storage; si no se cambia nada más, esa regla
nunca se activa y `FR-017` ("fichas visitadas y sus fotos") queda sin cumplir
sin que ningún test lo note hasta que alguien lo prueba sin conexión.

**Decisión**: las fotos de mascota pasan a `<Image src={pet.photoUrl}
unoptimized ... />` en ambos componentes. La solicitud resultante es
exactamente la URL pública permanente ya guardada en `photo_url` —la misma
que la regla `CacheFirst` espera, y la misma URL que el Principio IV ya exige
que sea permanente. Se pierde el redimensionado/conversión automática de
Next por breakpoint, pero la compresión del lado del cliente ya reduce cada
foto a 1600px/WebP antes de subir (Principio IV) — el margen que quedaba
para la optimización on-the-fly de Next era chico, y a cambio la regla de
caché queda simple y verificable (una URL por foto, no N variantes por
breakpoint que además cambian de nombre en cada rebuild). Alternativa
descartada: mantener `next/image` optimizado y matchear `/_next/image` en la
regla de caché — funciona, pero cada foto genera varias entradas de caché
(una por ancho servido) y complica el límite explícito de `maxEntries`; se
prefiere la opción que deja una URL = una entrada de caché.

### Navegación client-side y RSC

Un click en una tarjeta de la cuadrícula navega del lado del cliente: el
router de Next.js pide el payload RSC de `/mascotas/[slug]` con un query
param `?_rsc=<hash>` que cambia en cada build — **no** la misma URL que pide
una carga completa (recargar la página, o abrir el link directo). Una regla
de caché que matchee por URL exacta trataría esas dos requests como
recursos distintos, y una `?_rsc=<hash>` de un build anterior nunca vuelve a
matchear después de un deploy.

**Decisión**: la regla de `NetworkFirst` para `/` y `/mascotas/[slug]` usa
`matchOptions: { ignoreSearch: true }` (o el equivalente de Serwist/Workbox
para construir la clave de caché ignorando query params) — así la entrada
cacheada de una mascota es una sola, sin importar si se llegó por navegación
completa o por click desde la cuadrícula, y sobrevive a que el hash de
`_rsc` cambie entre deploys. La respuesta `no-store` que Next agrega por
`export const revalidate = 0` no es un obstáculo: esa cabecera solo le habla
a la caché HTTP del navegador, no al service worker — Serwist intercepta el
`fetch` y decide cachear por su cuenta, independientemente de
`Cache-Control`. Se verifica igual, a mano, en Validación 3 de
`quickstart.md`: entrar por click desde la cuadrícula (no solo recargando)
antes de desconectar la red.

**Actualizaciones**: nunca `skipWaiting()` automático a mitad de uso — un
service worker nuevo instalado queda "waiting" hasta que la administradora lo
acepta. `useSwUpdate()` escucha `registration.waiting` /
`controllerchange` y muestra `<UpdateAvailableBanner>` con un botón
"Recargar" que hace `postMessage({ type: "SKIP_WAITING" })` al worker en
espera; `app/sw.ts` escucha ese mensaje y llama `self.skipWaiting()` recién
ahí. Sin esto, un shell precacheado agresivamente dejaría a alguien en una
versión vieja para siempre, exactamente el riesgo que el pedido señala.

**Manifiesto** (`app/manifest.ts`, soportado nativamente por Next.js 15 vía
`MetadataRoute.Manifest`): íconos 192×192 y 512×512 (`public/icons/`),
`apple-touch-icon` de 180×180 referenciado desde `app/layout.tsx`
(`metadata.icons.apple`, iOS no lee el manifiesto para el ícono de instalación),
`display: "standalone"`, `theme_color: "#2563EB"` (el acento único del design
system), `background_color: "#FAFAFA"`.

**Alternativas consideradas**:
- `next-pwa`: descartada explícitamente en el pedido — sin mantenimiento.
- Workbox standalone (sin el wrapper de Next.js): descartada — `@serwist/next`
  ya integra el manifiesto de precache con el build de Next.js sin
  configuración manual adicional, y es lo que el pedido especifica.
- Cachear todo el catálogo de mascotas por adelantado (no solo lo visitado):
  descartada — contradice explícitamente la Assumption de spec.md ("el caché
  offline se limita a lo que la administradora ya visitó").

### "Desde cuándo" está desactualizado (FR-018)

`<OfflineBanner>` necesita mostrar desde cuándo es el contenido que se está
viendo. En vez de inventar un mecanismo propio (por ejemplo, grabar un
timestamp en `localStorage` cada vez que un fetch tiene éxito, que puede
desincronizarse de lo que el service worker efectivamente cacheó), se lee
directamente la cabecera `Date` de la respuesta ya cacheada: la Cache Storage
API es accesible tanto desde el service worker como desde la página, así que
`getLastLoadedAt()` (`src/lib/offline/last-loaded.ts`) hace
`caches.match(window.location.href)` y parsea `response.headers.get("date")`
— el dato ya existe en la respuesta HTTP que Serwist guardó, no hace falta
duplicarlo.

## §6. Marcar el día vía RPC directo del navegador, no Server Action

Las features 1 y 2 escriben con Server Actions (`src/lib/actions/*.ts`). Esta
feature usa en cambio el cliente de navegador (`src/lib/supabase/client.ts`)
llamando `supabase.rpc("mark_sighting", {...})` directamente desde
`<MarkTodayControl>` y desde la lógica de sincronización de la cola —
**mismo código en ambos casos**, la cola simplemente reintenta la misma
llamada.

**Por qué no una Server Action acá**: una Server Action es un POST HTTP al
propio servidor de Next.js; para que la cola offline pueda reintentar un
envío al recuperar señal, necesita poder distinguir "no hubo respuesta"
(reintentar) de "el servidor respondió con un rechazo" (permanente,
research.md §4) usando el código de error de Postgres tal cual lo expone
`supabase-js`. Envolver eso en una Server Action agregaría una capa de
serialización propia de Next.js sin aportar nada: `mark_sighting` corre
`security invoker`, así que la política RLS se evalúa contra la sesión de
quien llama sin importar si la llamada sale del servidor o del navegador —
el Principio I no distingue una cosa de la otra.

**Consistencia**: sigue siendo el mismo RPC ya existente, llamado de la
misma forma (`rpc()`, nunca un insert armado a mano) que ya usaría cualquier
Server Action; el cambio es solo desde dónde se dispara la llamada.

## §7. Testing de IndexedDB y del flujo offline

**Vitest**: el entorno configurado es `node` (`vitest.config.ts`), que no
tiene `indexedDB` global. Se agrega `fake-indexeddb` como dependencia de
desarrollo y se importa su parche (`import "fake-indexeddb/auto"`) en
`vitest.setup.ts`, exclusivamente para los tests que ejercitan
`src/lib/offline/*` — el resto de los tests unitarios no lo necesita.

**Playwright**: `context.setOffline(true)` simula sin conexión a nivel de
browser context (más realista que interceptar requests uno por uno, porque
también corta el propio fetch que dispararía un timeout en vez de un error
de red inmediato). El flujo de `tests/e2e/offline-sighting.spec.ts`:

1. Login como admin (reutiliza el bootstrap de sesión de la feature 2).
2. Abrir la ficha de una mascota, `setOffline(true)`.
3. Tocar "Visto" — verificar el estado visual "pendiente" (research.md §8).
4. `setOffline(false)`.
5. Esperar a que el estado pase a "confirmado" (poll corto, no `sleep` fijo).
6. Verificar contra la base (o recargando la página y leyendo el calendario)
   que la fecha registrada es la del paso 3, no la del paso 5.

## §8. Diseño del control de marcado y de los cuatro estados visuales

El control de "hoy" es el elemento más usado de la app: objetivo táctil de al
menos 48×48px (referencia WCAG 2.5.5/Material), ubicado en la parte inferior
de la ficha en mobile (zona alcanzable con el pulgar sin reacomodar la mano),
con feedback inmediato al tocar (optimista: el estado pendiente aparece antes
de esperar la respuesta de red, tanto online como offline — research.md §3
ya cuenta el día pendiente en el total/racha por la Clarification de spec.md).

El día de un calendario combina dos ejes independientes — valor (visto /
revisado y no estaba / sin registro) y confirmación (confirmado / pendiente)
— en 5 combinaciones visibles (sin registro no tiene variante pendiente):

| Estado | Forma/ícono (Lucide, ya en uso en el proyecto) | Color |
|---|---|---|
| Visto, confirmado | Círculo relleno con check | `--color-accent` |
| Visto, pendiente | Círculo relleno con check + badge de reloj | `--color-accent`, badge en `--color-muted-foreground` |
| Revisado y no estaba, confirmado | Círculo con borde y una X | `--color-secondary` |
| Revisado y no estaba, pendiente | Círculo con borde y una X + badge de reloj | `--color-secondary`, badge en `--color-muted-foreground` |
| Sin registro | Círculo vacío/punteado, sin ícono | `--color-border` |

Ningún par se distingue solo por tono de color (Principio II / FR-003 /
SC-002) — la forma (relleno vs. borde vs. punteado) y el ícono (check vs. X)
alcanzan para diferenciarlos en escala de grises.

**`prefers-reduced-motion`** (Principio II, ya vigente en el resto de la
app): el único movimiento que este flujo introduce es el feedback optimista
al tocar el control (el badge de "pendiente" aparece de inmediato) y el
cambio de estado al confirmar. Con `prefers-reduced-motion: reduce`, esa
transición se resuelve como un cambio instantáneo de estado (sin animación
de escala/opacidad), igual que el resto de los componentes ya construidos —
no es una excepción nueva a diseñar, solo aplicar la misma regla ya vigente
también acá.

## §9. Mantener despierta la base de datos

`CLAUDE.md` documenta esta acción como deuda técnica ya existente, pero no
hay ningún archivo bajo `.github/workflows/` en el repositorio — se crea
ahora como parte de esta feature. `keep-supabase-awake.yml`: cron
`0 0 */3 * *` (cada 3 días), un `curl` de `select` trivial contra
`pets_overview` con `NEXT_PUBLIC_SUPABASE_ANON_KEY` (segura de exponer en un
workflow: es la misma clave que ya viaja en el bundle del cliente):

```bash
curl -sf -o /dev/null -w "keep-alive: %{http_code}\n" \
  "$SUPABASE_URL/rest/v1/pets_overview?select=id&limit=1" \
  -H "apikey: $SUPABASE_ANON_KEY" \
  -H "Authorization: Bearer $SUPABASE_ANON_KEY"
```

`select=id&limit=1` (sintaxis real de PostgREST, no la forma que
`supabase-js` traduce internamente para `head: true`) trae como mucho una
fila de un solo campo — alcanza para contar como actividad sin pedir nada
que no se vaya a usar. `curl -f` hace que el workflow falle visiblemente si
la respuesta no es 2xx, en vez de reportar éxito con un ping roto. Se
documenta en un `README.md` nuevo en la raíz —no existía— como lo que es: un
workaround; la solución real sigue siendo el plan Pro de Supabase.
