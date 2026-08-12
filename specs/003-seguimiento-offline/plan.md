# Implementation Plan: Seguimiento diario y funcionamiento offline

**Branch**: `003-seguimiento-offline` | **Date**: 2026-08-10 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/003-seguimiento-offline/spec.md`

## Summary

Calendario mensual de avistamientos en la ficha de cada mascota (tres estados
—visto / revisado y no estaba / sin registro— proyectados en memoria a partir
de una sola consulta por mes, nunca pregenerados) más un control de marcado
del día de hoy operable con una mano, y una PWA instalable con service worker
(Serwist) que sirve el último contenido cacheado sin conexión. El marcado de
"hoy" funciona sin conexión mediante una cola en IndexedDB que se sincroniza
sola contra `rpc('mark_sighting', ...)` —ya existente, idempotente— al
recuperar señal; corregir un día pasado desde el calendario requiere conexión
(Clarifications, spec.md). No se toca el esquema: `sightings`, `mark_sighting`
y las políticas RLS ya están aplicados. La única pieza de infraestructura que
esta feature agrega a rutas ya existentes (`/`, `/mascotas/[slug]`) es mover
el renderizado condicional por sesión de servidor a cliente, porque un
service worker que cachea HTML no puede servir un documento cuyo contenido
depende de quién lo pidió (research.md §1).

## Technical Context

**Language/Version**: TypeScript 5.x (strict) sobre Next.js 15 (App Router), Node.js 20 LTS

**Primary Dependencies**: `next`, `react`/`react-dom`, `@supabase/ssr` +
`@supabase/supabase-js` (ya instalados) — más, nuevos para esta feature:
`@serwist/next` + `serwist` (service worker, reemplaza `next-pwa` sin
mantener), `idb` (wrapper delgado sobre IndexedDB para la cola offline,
research.md §3). Sin librería de fechas: un módulo propio (`src/lib/dates.ts`)
resuelve el cálculo de fecha local UTC-3 y la comparación de strings
`YYYY-MM-DD` (research.md §2).

**Storage**: Supabase Postgres ya aplicado — tabla `sightings`, función
`mark_sighting(p_pet_id, p_seen, p_date, p_note)`, políticas
`sightings_public_read` / `sightings_admin_write` (`petdex-schema.sql`).
**Sin migraciones nuevas.** El único almacenamiento nuevo de esta feature es
del lado del cliente: IndexedDB para la cola de avistamientos pendientes
(research.md §3) y el cache del service worker (research.md §5) — ninguno de
los dos vive en Supabase ni requiere cambios de esquema.

**Testing**: Vitest — unitarios para el módulo de fechas (cambio de día en
UTC-3, research.md §2), el cálculo de racha con los tres estados, la
deduplicación de la cola offline por clave `{pet_id}:{seen_on}` y la
clasificación de errores de sincronización transitorio/permanente
(research.md §4); `fake-indexeddb` como entorno de IndexedDB en Node para
esos tests (research.md §3). Playwright con `context.setOffline(true/false)`
para el flujo completo: marcar sin conexión → volver a estar online →
verificar sincronización con la fecha correcta (research.md §7).

**Target Platform**: Web responsive instalable como PWA (`display: standalone`),
desplegada en Vercel; mobile-first (375/768/1024/1440). El control de marcado
es el elemento más usado de toda la app — vive en la zona alcanzable con el
pulgar en mobile.

**Project Type**: Aplicación web de un solo proyecto (Next.js), extiende la
misma app de las features 1 y 2. Se agrega la pieza de infraestructura que
esas features dejaron implícitamente pendiente: hacer que el HTML de las
rutas públicas no dependa de la sesión (research.md §1), condición previa
para poder cachearlo con un service worker.

**Performance Goals**: Marcar el día de hoy con una sola acción táctil en
menos de 5 segundos desde que se abre la ficha (SC-001). Contenido ya visitado
visible en menos de 2 segundos al abrir la app sin conexión (SC-005). El
100% de los avistamientos marcados sin conexión se sincronizan solos al
recuperar señal (SC-006).

**Constraints**: Solo `NEXT_PUBLIC_SUPABASE_URL` y `NEXT_PUBLIC_SUPABASE_ANON_KEY`
en runtime — sin variables nuevas; el service worker y la cola offline
corren enteramente en el navegador, sin secretos propios. Sin service role
key en ningún punto. El marcado de "hoy" —online u offline— llama siempre a
`rpc('mark_sighting', ...)` desde el cliente de navegador (nunca una Server
Action ni un insert armado a mano, research.md §6); RLS es la única garantía
de que solo una sesión admin puede escribir, tanto si el request sale al
tocar el botón como si sale de la cola al reconectar. Nunca cachear
peticiones a `*/auth/v1/**` (research.md §5). Nunca `skipWaiting()` en
silencio (research.md §5).

**Scale/Scope**: Escala de barrio (decenas de mascotas, cientos de días de
historial por mascota como máximo). 2 rutas públicas existentes modificadas
para des-acoplar su HTML de la sesión (`/`, `/mascotas/[slug]`); ~10 módulos
nuevos entre calendario, cola offline y service worker; sin rutas nuevas.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

Constitución v1.1.0 (ver `.specify/memory/constitution.md`).

| Principio | Evaluación |
|---|---|
| I. Los permisos viven en la base de datos | PASS. El marcado —con o sin conexión— siempre termina en `rpc('mark_sighting', ...)`, ejecutado con `security invoker`, contra la política `sightings_admin_write`. La cola offline no es un bypass: es solo un buffer client-side que reintenta el mismo RPC; si la sesión expiró mientras el dispositivo estaba sin conexión, el RPC falla con `42501` al reconectar, se clasifica como error permanente (research.md §4) y se avisa a la administradora (FR-023/024) — la base rechaza igual que si hubiera estado online. Sin service role key en ningún punto. |
| II. Minimalismo visual (Swiss Style) | PASS. Los tres estados del calendario (y el cuarto, "pendiente") se distinguen por forma/ícono además de color (FR-003, SC-002), con los íconos de Lucide ya en uso; sin paleta nueva — reutiliza `--color-accent` para el estado activo/pendiente (research.md §8). |
| III. Mobile-first, una sola mano | PASS. El control de marcado usa un objetivo táctil grande en la zona del pulgar (research.md §8); es el requisito explícito del pedido y el gesto más frecuente de la app. |
| IV. Ninguna imagen depende de una URL que expira | PASS, sin cambios — esta feature no sube fotos nuevas. La estrategia CacheFirst del service worker para `pet-photos` cachea la misma URL pública permanente que ya se usa hoy (research.md §5), nunca una signed URL. |
| V. El esquema es la fuente de verdad | PASS. Sin migraciones; `src/types/database.ts` ya tiene `sightings` y `mark_sighting` generados (verificado en research.md §0) — no se edita a mano ni hace falta `gen:types`. |
| VI. Degradación offline | PASS — es el objetivo central de esta feature. Requiere, como condición previa, que el HTML de `/` y `/mascotas/[slug]` deje de depender de la sesión (research.md §1); sin ese cambio, cachear esas páginas violaría la garantía de acceso de escritura del Principio I al filtrar la interfaz de administración a un dispositivo sin sesión activa. |
| Stack y Alcance | PASS. Next.js App Router + TypeScript + Tailwind + shadcn/ui + Supabase, sin variables de entorno nuevas. Calendario de avistamientos y PWA con degradación offline están explícitamente dentro del alcance v1. |
| Flujo de Desarrollo y Cumplimiento | PASS. `mark_sighting` se sigue usando vía `rpc()`, nunca un insert a mano (regla explícita del pedido); tres estados nunca colapsados a dos; fecha local UTC-3 calculada en el cliente y pasada explícita como `p_date`, nunca el default de la función. |

No hay violaciones que requieran la tabla de Complexity Tracking. El refactor
de `app/page.tsx` / `app/mascotas/[slug]/page.tsx` (research.md §1) no es una
excepción al principio VI sino la condición para cumplirlo sin abrir una
fuga en el principio I.

## Project Structure

### Documentation (this feature)

```text
specs/003-seguimiento-offline/
├── plan.md               # This file (/speckit-plan command output)
├── research.md           # Phase 0 output (/speckit-plan command)
├── data-model.md         # Phase 1 output (/speckit-plan command)
├── quickstart.md         # Phase 1 output (/speckit-plan command)
├── contracts/            # Phase 1 output (/speckit-plan command)
└── tasks.md              # Phase 2 output (/speckit-tasks command - NOT created by /speckit-plan)
```

### Source Code (repository root)

```text
app/
├── layout.tsx                          # Existente — monta <SessionProvider>, <OfflineSyncProvider>, <SyncFailureBanner> y <UpdateAvailableBanner> (research.md §1, §3, §5)
├── page.tsx                            # Existente — el botón "alta" se mueve a <AdminOnly> client-side (research.md §1)
├── manifest.ts                         # Nuevo — MetadataRoute.Manifest (research.md §5)
├── sw.ts                               # Nuevo — fuente del service worker (Serwist, research.md §5)
└── mascotas/
    └── [slug]/
        └── page.tsx                     # Existente — agrega <SightingCalendar> y <MarkTodayControl>; botón "Editar" pasa a <AdminOnly>

middleware.ts                            # Existente — sin cambios (las rutas de escritura ya están protegidas)

src/
├── types/
│   └── database.ts                     # Existente — ya incluye sightings/mark_sighting, sin cambios (Principio V)
├── lib/
│   ├── dates.ts                        # Nuevo — únicas funciones que usan Date; todo lo demás opera sobre strings YYYY-MM-DD (research.md §2)
│   ├── sightings.ts                    # Nuevo — lectura: getSightingsForMonth(), proyección del mes, computeStreak() (research.md §2)
│   ├── validation/
│   │   └── (sin schema nuevo — mark_sighting no tiene formulario, solo dos botones)
│   ├── errors.ts                       # Existente — mapPostgresError() ya cubre 42501; se reutiliza en la cola offline
│   └── offline/
│       ├── db.ts                       # Nuevo — apertura de la base IndexedDB con `idb` (research.md §3)
│       ├── queue.ts                    # Nuevo — enqueue/list/remove sobre el store pending_sightings, clave {pet_id}:{seen_on}
│       ├── sync.ts                     # Nuevo — syncPendingSightings(), dispara en online/visibilitychange/mount
│       ├── sync-errors.ts              # Nuevo — classifySyncError(): transitorio vs permanente (research.md §4)
│       ├── events.ts                   # Nuevo — EventTarget mínimo para que la UI reaccione a cambios de la cola sin poll
│       └── last-loaded.ts              # Nuevo — getLastLoadedAt(): lee el header Date de la respuesta ya cacheada por el service worker (Cache Storage API, sin duplicar el timestamp en localStorage), para <OfflineBanner> (FR-018)
├── hooks/
│   ├── use-session.ts                  # Nuevo — sesión leída client-side (onAuthStateChange), reemplaza el getUser() server-side condicional (research.md §1)
│   ├── use-pending-sighting.ts         # Nuevo — estado (confirmado/pendiente/fallido) del día de hoy para una mascota
│   ├── use-online-status.ts            # Nuevo — navigator.onLine + eventos online/offline, para el banner de "sin conexión"
│   └── use-sw-update.ts                # Nuevo — detecta un service worker nuevo en espera, ofrece recargar (research.md §5)
└── components/
    ├── auth/
    │   ├── session-provider.tsx        # Nuevo — única suscripción a getSession()/onAuthStateChange, expone el contexto que useSession() lee (research.md §1)
    │   ├── session-nav-link.tsx        # Existente — pasa a Client Component sobre useSession() (research.md §1)
    │   └── admin-only.tsx               # Nuevo — envoltorio client-side que oculta children sin sesión, reemplaza los `{user && ...}` server-side
    ├── milestone-timeline.tsx          # Existente — su prop isAdmin ya no llega desde el servidor: se resuelve con useSession().isAuthenticated (research.md §1)
    ├── pet-detail.tsx                   # Existente — <Image unoptimized> para que la foto matchee la regla CacheFirst (research.md §5)
    ├── pet-card.tsx                     # Existente — ídem
    ├── sightings/
    │   ├── sighting-calendar.tsx       # Nuevo — grilla mensual + navegación a meses anteriores (Client Component, fetch vía browser client)
    │   ├── day-cell.tsx                # Nuevo — un día: estado (visto/revisado/sin registro) × pendiente, ícono + forma distintiva (FR-003)
    │   ├── month-summary.tsx           # Nuevo — total del mes + racha
    │   ├── mark-today-control.tsx      # Nuevo — el control de un toque (FR-010/011), encola en IndexedDB si no hay red
    │   └── past-day-dialog.tsx         # Nuevo — corrección de un día pasado desde el calendario, requiere conexión (FR-014)
    └── offline/
        ├── offline-sync-provider.tsx   # Nuevo — monta los tres disparadores de syncPendingSightings() (online/visibilitychange/mount), research.md §3
        ├── offline-banner.tsx          # Nuevo — "sin conexión, mostrando datos de las HH:mm" (FR-018)
        ├── sync-failure-banner.tsx     # Nuevo — aviso global de falla permanente + descartar (FR-023/024), suscrito a sighting-sync-failed, visible sin importar la pantalla actual
        └── update-available-banner.tsx # Nuevo — aviso de service worker nuevo + botón recargar (research.md §5)

public/
└── icons/
    ├── icon-192.png                    # Nuevo — manifiesto PWA
    ├── icon-512.png                    # Nuevo
    └── apple-touch-icon.png            # Nuevo — 180×180, iOS

.github/
└── workflows/
    └── keep-supabase-awake.yml         # Nuevo — select trivial cada 3 días (research.md §9)

README.md                                # Nuevo — instala/corre el proyecto; documenta la deuda técnica del ping (research.md §9)

tests/
├── unit/
│   ├── dates.test.ts                   # Nuevo — límite de día UTC-3 (22:00 local no debe caer en el día siguiente)
│   ├── streak.test.ts                  # Nuevo — racha con visto/revisado/sin registro combinados, cortada por registered_on
│   ├── offline-queue.test.ts           # Nuevo — dedup por clave, sobrescritura, fake-indexeddb
│   └── sync-errors.test.ts             # Nuevo — 42501 y FK violation → permanente; TypeError de red → transitorio
└── e2e/
    └── offline-sighting.spec.ts        # Nuevo — setOffline(true) → marcar → estado pendiente visible → setOffline(false) → confirmado con fecha correcta
```

**Structure Decision**: Se mantiene el proyecto único de Next.js de las
features 1 y 2. La única modificación a rutas existentes es hacer que
`/` y `/mascotas/[slug]` (las dos rutas públicas que deben seguir sirviendo
contenido sin conexión) rendericen el mismo HTML sin importar la sesión,
moviendo el chequeo de sesión a un hook client-side (`useSession`) detrás de
un envoltorio (`<AdminOnly>`) — el resto de las rutas protegidas por
`middleware.ts` (alta/edición de mascota, hitos) no cambian, porque no forman
parte del alcance offline de esta feature. El calendario y el control de
marcado se agregan como componentes nuevos dentro de la ficha existente, no
como una ruta aparte, siguiendo el mismo criterio de la feature 2 (todo lo
que se usa "parado en la calle" vive en la pantalla que ya se está mirando).
