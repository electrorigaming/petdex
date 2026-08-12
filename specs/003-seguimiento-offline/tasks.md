---

description: "Task list template for feature implementation"
---

# Tasks: Seguimiento diario y funcionamiento offline

**Input**: Design documents from `/specs/003-seguimiento-offline/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/, quickstart.md — todos ya generados.

**Tests**: Incluidos — el pedido original de `/speckit.plan` pide explícitamente cobertura de Vitest (fechas, racha, cola offline, clasificación de errores) y Playwright (flujo offline), reflejado en `plan.md` §Testing.

**Organization**: Tareas agrupadas por historia de usuario (spec.md), en orden de prioridad P1→P5, para poder implementar y entregar cada una de forma independiente.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Puede ejecutarse en paralelo con otras tareas [P] de la misma fase (archivo distinto, sin depender de una tarea todavía incompleta)
- **[Story]**: Historia de usuario a la que pertenece (US1–US5, spec.md)
- Cada tarea incluye la ruta de archivo exacta

## Path Conventions

Proyecto único Next.js (App Router) — `app/`, `src/`, `tests/` en la raíz del repositorio, según `plan.md` §Project Structure. Sin variantes: no hay backend separado ni apps móviles.

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Dependencias nuevas que todo el resto de la feature necesita.

- [X] T001 Agregar `@serwist/next`, `serwist`, `idb` a `dependencies` y `fake-indexeddb` a `devDependencies` en `package.json`; correr `npm install`
- [X] T002 [P] Agregar el import de `fake-indexeddb/auto` en `vitest.setup.ts` (research.md §7 — necesario para los tests de `src/lib/offline/*` de la Fase 7, inofensivo para el resto)

**Checkpoint**: Dependencias instaladas, entorno de test listo para IndexedDB.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Infraestructura que usan las cinco historias — ninguna historia puede empezar antes de este checkpoint.

**⚠️ CRITICAL**: No avanzar a ninguna fase de historia sin completar esta.

- [X] T003 [P] Crear `src/lib/dates.ts` — `todayLocal()`, `isFuture()`, `compareDates()`, `addDays()`, `startOfMonth()`, `daysInMonthRange()`, `monthLabel()`; único módulo del proyecto que instancia `Date` (research.md §2)
- [X] T004 [P] Tests unitarios en `tests/unit/dates.test.ts` — incluir explícitamente el caso límite de las 22:00 hora local (01:00 UTC del día siguiente) devolviendo la fecha de hoy, no la de mañana (research.md §2)
- [X] T005 [P] Crear `src/components/auth/session-provider.tsx` — única suscripción a `supabase.auth.getSession()` + `onAuthStateChange` de toda la app, expuesta por contexto (research.md §1)
- [X] T006 Crear `src/hooks/use-session.ts` — `useContext()` sobre `SessionProvider`, expone `{ isAuthenticated, loading }` (no `isAdmin`: research.md §1) — depende de T005
- [X] T007 Crear `src/components/auth/admin-only.tsx` — oculta `children` mientras `loading` o `!isAuthenticated` — depende de T006
- [X] T008 Montar `<SessionProvider>` en `app/layout.tsx` — depende de T005

**Checkpoint**: Fundación lista — las historias de usuario pueden empezar.

---

## Phase 3: User Story 1 - Marcar el avistamiento de hoy (Priority: P1) 🎯 MVP

**Goal**: Control de un toque en la ficha de una mascota que registra el día de hoy como "visto" o "revisado y no estaba", con conexión, sin duplicar si se toca dos veces.

**Independent Test**: Con sesión de administradora en la ficha de una mascota, tocar "Visto" y verificar que queda registrado; tocar "Revisado y no estaba" y verificar que reemplaza el registro (no lo duplica).

### Tests for User Story 1

- [X] T009 [P] [US1] Integration test en `tests/integration/rls-sightings-write.test.ts` — `rpc('mark_sighting', ...)` con la anon key falla (`42501`); con una sesión admin de prueba (mismo bootstrap que `rls-pets-write.test.ts`) tiene éxito. No depende de ningún código nuevo de esta feature, solo del esquema ya aplicado — puede escribirse y correr antes que el resto de esta fase.

### Implementation for User Story 1

- [X] T010 [P] [US1] Crear `src/lib/sightings.ts` con `callMarkSighting()` — wrapper delgado sobre `supabase.rpc("mark_sighting", { p_pet_id, p_seen, p_date })` desde el cliente de navegador (`contracts/mark-sighting.md`); nunca un insert/update armado a mano. **Módulo client-safe a propósito** (mismo motivo que el comentario ya existente en `src/lib/milestones.ts`): `<MarkTodayControl>`, `<SightingCalendar>` y `<PastDayDialog>` son Client Components y lo importan como valor, no solo como tipo — este archivo no debe importar `src/lib/supabase/server.ts` ni ninguna función server-only (a diferencia de `src/lib/pets.ts`), porque arrastraría código de servidor al bundle de cliente. Usa siempre `src/lib/supabase/client.ts`.
- [X] T011 [US1] Crear `src/components/sightings/mark-today-control.tsx` — control de un toque, envuelto en `<AdminOnly>`, llama `callMarkSighting` con `todayLocal()`; objetivo táctil grande en la zona del pulgar, respeta `prefers-reduced-motion` (research.md §8); en esta fase, **solo online** — un fallo sin código de error se muestra como mensaje de "sin conexión", sin encolar todavía (la cola se agrega en la Fase 7/US5) — depende de T003, T007, T010
- [X] T012 [US1] Integrar `<MarkTodayControl>` en `app/mascotas/[slug]/page.tsx`, junto a `<PetDetail>` — depende de T011
- [X] T013 [US1] Extender `tests/e2e/admin-flow.spec.ts` con el flujo de marcado: tocar "Visto", verificar el registro; tocar "Revisado y no estaba", verificar que reemplaza (no duplica) — depende de T012

**Checkpoint**: User Story 1 funciona de punta a punta — MVP entregable (marcado online de "hoy").

---

## Phase 4: User Story 2 - Ver el calendario mensual de una mascota (Priority: P2)

**Goal**: Calendario mensual en la ficha con los tres estados distinguibles sin depender del color, total del mes y racha actual, navegable a meses anteriores, acotado por `registered_on` y hoy.

**Independent Test**: Con una mascota con días marcados en distintos estados, abrir su ficha sin sesión, ver los tres estados distinguibles, navegar a un mes anterior y verificar que el total y la racha coinciden con los datos cargados.

### Implementation for User Story 2

- [X] T014 [US2] Extender `src/lib/sightings.ts` con `getSightingsForMonth()` (una consulta por mes, rango `seen_on`) y `projectMonth()` (proyección en memoria a `CalendarDay[]`, incluyendo el parámetro `todayPendingValue: boolean | null` de la firma completa — `contracts/sightings-read.md` §"Bridge US2 → US5"). Se implementa la firma entera ahora; el único llamador que existe en esta fase (`<SightingCalendar>`, T019) le pasa siempre `null` — no depende de `PendingSighting` ni de `src/lib/offline/*`, que todavía no existen — depende de T010 (mismo archivo)
- [X] T015 [US2] Extender `src/lib/sightings.ts` con `getStreakWindow()` (consulta `[registered_on, hoy]` completa, sin tope — `contracts/sightings-read.md`) y `computeStreak()` puro con el mismo parámetro `todayPendingValue: boolean | null` (corta en "revisado_no_estaba", salta "sin_registro" sin cortar ni extender — `data-model.md`); el único llamador de esta fase (`<MonthSummary>`, T018) le pasa siempre `null` — depende de T014 (mismo archivo)
- [X] T016 [P] [US2] Tests unitarios en `tests/unit/streak.test.ts` — combinaciones de los tres estados, corte en `registered_on`, racha que cruza el límite de un mes
- [X] T017 [US2] Crear `src/components/sightings/day-cell.tsx` — un día: visto/revisado_no_estaba/sin_registro, forma + ícono además de color (FR-003/SC-002, research.md §8); acepta una prop `pending` (sin usar todavía — la activa la Fase 7/US5) — depende de T003
- [X] T018 [US2] Crear `src/components/sightings/month-summary.tsx` — total del mes visto + racha actual — depende de T015
- [X] T019 [US2] Crear `src/components/sightings/sighting-calendar.tsx` — grilla mensual, Client Component, fetch vía `src/lib/supabase/client.ts`, navegación a mes anterior/siguiente deshabilitada fuera de `[registered_on, hoy]` (FR-004/005) — depende de T014, T017
- [X] T020 [US2] Integrar `<SightingCalendar>` + `<MonthSummary>` en `app/mascotas/[slug]/page.tsx` (vía `<PetSightingsSection>`, que también coordina el refetch del calendario tras un marcado online exitoso de `<MarkTodayControl>` — necesario para quickstart.md Validación 1, no cubierto por ningún contrato explícito) — depende de T018, T019

**Checkpoint**: User Story 1 y 2 funcionan de forma independiente — calendario visible con datos correctos.

---

## Phase 5: User Story 3 - Cargar un día pasado olvidado (Priority: P3)

**Goal**: Desde el calendario, con conexión, registrar o corregir un día pasado; nunca un día futuro. Sin cola offline para este camino (Clarifications, spec.md).

**Independent Test**: Con sesión de administradora en el calendario, tocar un día pasado sin registro y marcarlo; verificar que aparece así; intentar tocar un día futuro y verificar que no ofrece ninguna acción.

### Implementation for User Story 3

- [X] T021 [US3] Crear `src/components/sightings/past-day-dialog.tsx` — elige visto/revisado y no estaba para un día pasado puntual, llama `callMarkSighting`; un fallo sin código de error muestra "sin conexión, intentá de nuevo" sin encolar (`contracts/mark-sighting.md`) — depende de T010
- [X] T022 [US3] Conectar el toque de un día pasado seleccionable en `<DayCell>`/`<SightingCalendar>` para abrir `<PastDayDialog>`; los días no seleccionables (futuros o anteriores a `registered_on`) no disparan nada (FR-004/005/014) — depende de T017, T019, T021
- [X] T023 [US3] Extender `tests/e2e/admin-flow.spec.ts` con el flujo de corrección de un día pasado desde el calendario, y una aserción de que un día futuro no es interactivo — depende de T022

**Checkpoint**: User Story 1, 2 y 3 funcionan de forma independiente.

---

## Phase 6: User Story 4 - Consultar la app sin conexión (Priority: P4)

**Goal**: PWA instalable; service worker (Serwist) que cachea el shell, las fotos y los datos ya visitados; `/` y `/mascotas/[slug]` sirven el mismo HTML sin importar la sesión (precondición de research.md §1); aviso de contenido desactualizado.

**Independent Test**: Con el celular en modo avión después de haber visitado la cuadrícula y al menos una ficha (por click, no solo recargando) con conexión, abrir la app instalada y confirmar que se sigue viendo ese contenido con el aviso de desactualización.

### Implementation for User Story 4

- [X] T024 [P] [US4] Convertir `src/components/auth/session-nav-link.tsx` a Client Component sobre `useSession()` (research.md §1) — depende de T006
- [X] T025 [US4] Reemplazar los `{user && ...}` server-side de `app/page.tsx` y `app/mascotas/[slug]/page.tsx` por `<AddPetButton>`/`<EditPetButton>` — no por `<AdminOnly>` envolviendo JSX armado por el Server Component: los children de un Client Component construidos por un padre Server Component se serializan igual en el payload RSC/HTML inicial aunque el cliente decida no renderizarlos (filtraba "Editar" a cualquier visitante, detectado por T027 al extender el test — ver comentario en `add-pet-button.tsx`/`edit-pet-button.tsx`) de `app/page.tsx` y `app/mascotas/[slug]/page.tsx` por `<AdminOnly>` (research.md §1) — depende de T007
- [X] T026 [US4] Actualizar `src/components/milestone-timeline.tsx`: la prop `isAdmin` se resuelve con `useSession().isAuthenticated` en el propio componente en vez de recibirla del servidor — depende de T006
- [X] T027 [US4] Extender `tests/e2e/anonymous-visibility.spec.ts`: fetch autenticado a `/` y `/mascotas/[slug]` y assert de que el HTML de servidor no contiene "Editar", "Agregar hito" ni "Cerrar sesión" antes de hidratar (`contracts/service-worker.md`) — depende de T024, T025, T026
- [X] T028 [P] [US4] Cambiar a `<Image unoptimized>` en `src/components/pet-detail.tsx` y `src/components/pet-card.tsx`, para que la request matchee la URL pública de Storage (research.md §5)
- [X] T029 [P] [US4] Generar íconos PWA en `public/icons/` — `icon-192.png`, `icon-512.png`, `apple-touch-icon.png` (180×180). Alcanza con un ícono sólido/mínimo en `--color-accent` (`#2563EB`) generado por script (por ejemplo con `sharp`/`canvas` o cualquier generador programático) — no requiere diseño gráfico manual; es un placeholder aceptable para esta feature, reemplazable después sin tocar el manifiesto
- [X] T030 [P] [US4] Crear `app/manifest.ts` — `display: "standalone"`, `theme_color: "#2563EB"`, `background_color: "#FAFAFA"`, íconos 192/512 (`contracts/service-worker.md`)
- [X] T031 [US4] Referenciar `apple-touch-icon.png` en `metadata.icons.apple` de `app/layout.tsx` — depende de T029
- [X] T032 [US4] Configurar `next.config.ts` con `withSerwistInit({ swSrc: "app/sw.ts", swDest: "public/sw.js" })` (`contracts/service-worker.md`)
- [X] T033 [US4] Crear `app/sw.ts` — no usa `defaultCache` de `@serwist/next/worker` (su catch-all `!sameOrigin` cachearía `*/auth/v1/**`, verificado leyendo su fuente); reglas explícitas propias en su lugar. Typecheck aislado en `tsconfig.worker.json` (lib `webworker`, sin `dom`) — mezclar libs en un solo programa de `tsc` rompía los globals DOM del resto de la app; `npm run typecheck` ahora corre ambos programas — precache del shell; `runtimeCaching`: `pet-photos` `CacheFirst` (`maxEntries: 200`, `maxAgeSeconds: 30 días`); `*/rest/v1/**` método `GET` únicamente `NetworkFirst` (`networkTimeoutSeconds: 3`), excluyendo el POST de `mark_sighting`; `*/auth/v1/**` sin entrada; `/` y `/mascotas/[slug]` `NetworkFirst` con `matchOptions: { ignoreSearch: true }`; listener de `message` para `SKIP_WAITING`, sin `skipWaiting` automático (`contracts/service-worker.md`) — depende de T028, T032
- [X] T034 [P] [US4] Crear `src/hooks/use-online-status.ts` — `navigator.onLine` + eventos `online`/`offline`
- [X] T035 [P] [US4] Crear `src/lib/offline/last-loaded.ts` — `getLastLoadedAt()` lee el header `Date` de la respuesta cacheada vía `caches.match(window.location.href)` (research.md §5, sin duplicar el timestamp en `localStorage`)
- [X] T036 [US4] Crear `src/components/offline/offline-banner.tsx` — "sin conexión, mostrando datos de las HH:mm" (FR-018), usa `use-online-status` + `last-loaded` — depende de T034, T035
- [X] T037 [US4] Montar `<OfflineBanner>` globalmente en `app/layout.tsx` — depende de T036
- [X] T038 [US4] Crear `src/hooks/use-sw-update.ts` — detecta un service worker nuevo en `waiting`, expone `reload()` que hace `postMessage({ type: "SKIP_WAITING" })` y recarga en `controllerchange` — depende de T033
- [X] T039 [US4] Crear `src/components/offline/update-available-banner.tsx` — aviso + botón "Recargar" — depende de T038
- [X] T040 [US4] Montar `<UpdateAvailableBanner>` en `app/layout.tsx` — depende de T039

**Checkpoint**: User Story 1 a 4 funcionan de forma independiente — app instalable, contenido visitado disponible sin conexión, sin fuga de HTML de administración.

---

## Phase 7: User Story 5 - Marcar un avistamiento sin conexión (Priority: P5)

**Goal**: El marcado del día de hoy (User Story 1) funciona sin conexión: queda pendiente en una cola de IndexedDB, se sincroniza solo al recuperar señal, y una falla permanente se avisa con un control para descartar (FR-019 a FR-024).

**Independent Test**: Con el celular en modo avión en la ficha de una mascota, marcar el día de hoy, confirmar el estado "pendiente", reactivar la conexión y confirmar que pasa a "confirmado" sin acción manual, con la fecha del momento en que se marcó.

### Tests for User Story 5

- [X] T041 [P] [US5] Tests unitarios en `tests/unit/sync-errors.test.ts` — `classifySyncError()`: cualquier error con `code` (`42501`, violación de FK) → `"permanent"`; `TypeError`/error de red sin `code` → `"transient"` (research.md §4). Puede escribirse antes de la implementación (función pura, sin IndexedDB). Se verificó a mano contra un host de Supabase inalcanzable que `rpc()` nunca tira: resuelve `{ data: null, error: { code: "", message: "TypeError: fetch failed" } }` — `code: ""` es falsy, cae en "transient" con la misma regla, sin necesitar un try/catch adicional en `callMarkSighting`.

### Implementation for User Story 5

- [X] T042 [P] [US5] Crear `src/lib/offline/db.ts` — apertura de la base IndexedDB con `idb`, store `pending_sightings` (`contracts/offline-queue.md`)
- [X] T043 [US5] Crear `src/lib/offline/queue.ts` — `pendingKey()`, `enqueueSighting()` (incluye `petSlug`/`petName` denormalizados), `getPendingForPet()`, `getAllPending()`, `markSyncing()`, `markFailed()`, `remove()` — depende de T042. Se agregó además `markPending()` (no listada en el contrato pero necesaria para la transición "error transitorio → vuelve a pending" que sí describe `sync.ts` en el contrato).
- [X] T044 [P] [US5] Crear `src/lib/offline/sync-errors.ts` — `classifySyncError()` (research.md §4)
- [X] T045 [P] [US5] Crear `src/lib/offline/events.ts` — `EventTarget` mínimo, eventos `sighting-enqueued` / `sighting-confirmed` / `sighting-sync-failed` (`contracts/offline-queue.md`). `sighting-sync-failed` lleva además `petSlug`/`petName` en el payload del evento (ya denormalizados en `PendingSighting`, data-model.md) para que `<SyncFailureBanner>` no dependa de una consulta a la cola aparte.
- [X] T046 [US5] Tests unitarios en `tests/unit/offline-queue.test.ts` — dedup por clave `{pet_id}:{seen_on}` (sobrescribe, no acumula), transición `failed → pending` al volver a marcar el mismo día, usando `fake-indexeddb` — depende de T002, T043. Incluye `beforeEach` que limpia el store: `fake-indexeddb/auto` instala una sola base global para todo el proceso de Vitest, así que sin esto los tests de este archivo comparten estado entre sí.
- [X] T047 [US5] Crear `src/lib/offline/sync.ts` — `syncPendingSightings()`: no hace nada si `!navigator.onLine` o la cola está vacía; procesa las entradas `pending` **y `syncing`** en secuencia (nunca en paralelo) llamando `callMarkSighting` de `src/lib/sightings.ts`; transiciones de estado y emisión de eventos por resultado (`contracts/offline-queue.md`) — depende de T010, T043, T044, T045. Se agregó `syncing` a la condición de reintento (el contrato solo menciona `pending`): una entrada puede quedar varada en `syncing` si la app se cierra a mitad de un intento (batería agotada, tab cerrada), y sin este agregado nunca se reintenta de nuevo — queda "pendiente" en la UI para siempre. `syncing` nunca se salta como `failed` porque no representa una falla confirmada, solo un intento interrumpido.
- [X] T048 [US5] Crear `src/components/offline/offline-sync-provider.tsx` — monta los disparadores `online`, `visibilitychange` (`document.visibilityState === "visible"`) y un intento al montar, todos llamando `syncPendingSightings()` (research.md §3) — depende de T047
- [X] T049 [US5] Montar `<OfflineSyncProvider>` en `app/layout.tsx` — depende de T048
- [X] T050 [US5] Crear `src/hooks/use-pending-sighting.ts` — se suscribe a `src/lib/offline/events.ts`, expone el estado (confirmado/pendiente/fallido) del día de hoy para una mascota — depende de T045. Devuelve `null` tanto para "nada pendiente" como para una entrada `failed` (data-model.md: un fallido no cuenta como marcado) — un `failed` nunca debe sumar en el total del mes ni en la racha vía `todayPendingValue`.
- [X] T051 [US5] Conectar `<MarkTodayControl>` (User Story 1) a la cola offline: si `callMarkSighting` falla sin código de error, llama `enqueueSighting()` en vez de solo mostrar un mensaje; usa `use-pending-sighting` para su estado visual (FR-019/020/021/022) — depende de T011, T043, T050. Requirió agregar las props `petSlug`/`petName` a `<MarkTodayControl>` (hasta ahora solo tenía `petId`), enhebradas desde `app/mascotas/[slug]/page.tsx` vía `<PetSightingsSection>` — `enqueueSighting()` las necesita denormalizadas (contracts/offline-queue.md). También se suscribe a `sighting-sync-failed` para revertir el estado optimista local si la sincronización falla de forma permanente (sin esto el botón quedaría "confirmado" para siempre aunque el día nunca se haya registrado en el servidor; el aviso global cubre otras pantallas, esta suscripción cubre la ficha misma).
- [X] T052 [US5] En `<SightingCalendar>` (T019), leer `usePendingSighting(petId)` y pasar el valor resultante como `todayPendingValue` a `projectMonth()` (en vez del `null` fijo de US2); `<DayCell>` ya sabe renderizar `pending: true` porque `projectMonth` ya lo resuelve (T014) — solo falta agregar el ícono/badge de reloj sobre las combinaciones visto+pendiente / revisado y no estaba+pendiente en `day-cell.tsx` (research.md §8). No se cambia la firma de `projectMonth` ni de `<DayCell>`, solo lo que reciben — depende de T017, T019, T050
- [X] T053 [US5] En `<MonthSummary>` (T018), leer `usePendingSighting(petId)` y pasar el valor resultante como `todayPendingValue` a `computeStreak()` (en vez del `null` fijo de US2) — mismo patrón que T052, sin tocar la firma de `computeStreak` (Clarifications, spec.md — FR-006/007) — depende de T015, T018, T050. El cálculo de racha se movió de adentro del `useEffect` de `getStreakWindow` a un `useMemo` separado (`streakWindow` como estado + `computeStreak` puro) para que reaccione de inmediato a un cambio de `todayPendingValue` (por ejemplo, al confirmar la sincronización) sin esperar el próximo refetch de red.
- [X] T054 [US5] Crear `src/components/offline/sync-failure-banner.tsx` — suscrito a `sighting-sync-failed`, muestra `petName` + motivo, control de descarte que llama `remove()` (FR-023/024, `contracts/offline-queue.md`) — depende de T043, T045
- [X] T055 [US5] Montar `<SyncFailureBanner>` en `app/layout.tsx` — depende de T054
- [X] T056 [US5] Crear `tests/e2e/offline-sighting.spec.ts` con `context.setOffline()` — tres escenarios: (1) marcar sin conexión → estado pendiente visible → reconectar → confirmado con la fecha del momento de marcar (verificado contra Supabase directamente, no recargando: sin service worker en `next dev`, `research.md §5`/`next.config.ts`, no hay nada cacheado para servir una navegación offline); (2) dos marcados offline seguidos con valores distintos → al reconectar, solo el último queda registrado; (3) falla permanente — se optó por eliminar la mascota mientras está offline (violación de FK, `23503`) en vez de invalidar la sesión (lo que sugiere quickstart.md Validación 5 para una prueba manual): mismo resultado bajo `classifySyncError` ("cualquier código ⇒ permanente") y determinístico en CI sin depender de la revocación de tokens. La navegación a "otra pantalla" del escenario 3 usa un click en el link del header (client-side, App Router mantiene el layout raíz montado) en vez de `page.goto`, precisamente para no perder el estado ya seteado de `<SyncFailureBanner>` con un reload completo — depende de T049, T051, T052, T055. Se agregó un proyecto nuevo `offline` en `playwright.config.ts` (misma `storageState` que `authenticated`, aislado en su propio proyecto por usar `context.setOffline()`). Bug encontrado y corregido en el propio test: el primer intento reusaba `admin.auth.signOut()` (scope `"global"` por default) en el cleanup, lo que revocaba también la sesión del navegador (mismo problema ya documentado en `admin-flow.spec.ts`) y hacía fallar los tests siguientes del archivo — se cambió a `signOut({ scope: "local" })`.

**Checkpoint**: Las cinco historias de usuario funcionan de forma independiente — feature completa.

---

## Phase 8: Polish & Cross-Cutting Concerns

**Purpose**: Deuda técnica documentada y verificación final, sin bloquear ninguna historia.

- [X] T057 [P] Crear `.github/workflows/keep-supabase-awake.yml` — cron cada 3 días, `curl -sf` contra `pets_overview?select=id&limit=1` con `NEXT_PUBLIC_SUPABASE_ANON_KEY` (research.md §9). La clave se lee de secrets del repo (`NEXT_PUBLIC_SUPABASE_URL`/`NEXT_PUBLIC_SUPABASE_ANON_KEY`) en vez de hardcodearla en el workflow — mismo valor que ya viaja en el bundle del cliente (research.md §9 lo marca como seguro de exponer), pero via secrets es más fácil de rotar sin tocar el YAML.
- [X] T058 [P] Crear `README.md` en la raíz — instalación, comandos (`npm run dev`/`typecheck`/`test`/`test:e2e`/`gen:types`), y la nota de deuda técnica del ping (research.md §9, `CLAUDE.md`)
- [X] T059 Correr `npm run typecheck` y corregir cualquier error de tipos introducido por los módulos nuevos — sin errores.
- [X] T060 [P] Verificar que las transiciones de `<MarkTodayControl>` y `<DayCell>` respetan `prefers-reduced-motion` (research.md §8, Principio II) — cubierto por la regla global ya existente en `app/globals.css` (`transition-duration: 0.01ms !important` bajo `@media (prefers-reduced-motion: reduce)`), que alcanza sin cambios nuevos: ni el badge de reloj de "pendiente" ni el cambio de estado del botón agregan una animación propia, solo clases condicionales sobre transiciones ya cubiertas por esa regla.
- [X] T061 Correr las seis validaciones manuales de `quickstart.md` de punta a punta y registrar el resultado de cada una — ver resultado detallado más abajo.

### Resultado de T061 (quickstart.md)

| Validación | Resultado | Cómo se verificó |
|---|---|---|
| 1 — Calendario y marcado, con conexión | PASS | `tests/e2e/admin-flow.spec.ts` (automatizado): marcar "Visto", reemplazar con "Revisado y no estaba" sin duplicar, corregir un día pasado, día futuro no interactivo. |
| 2 — Racha | PASS | `tests/unit/streak.test.ts` (10 casos, incluye el escenario completo de esta validación: 3 visto + revisado_no_estaba + sin_registro + 2 visto = racha 2). |
| 3 — Offline: contenido ya visitado | PASS (verificado en Fase 6, sin cambios en Fase 7) | Verificación manual con Chrome DevTools en modo producción (`npm run build && npm run start`): cuadrícula y fichas visitadas por click siguen disponibles sin conexión, con fotos, aviso de desactualización y fallback `/offline` para una ficha no visitada. Ningún archivo tocado en la Fase 7 afecta `app/sw.ts` — no se repitió la prueba completa, solo se confirmó (ver fila siguiente) que el build de producción sigue generando el service worker sin errores. |
| 4 — Offline: marcar hoy y sincronizar | PASS | `tests/e2e/offline-sighting.spec.ts` (automatizado, `context.setOffline()` real vía CDP — más determinístico que alternar DevTools a mano): estado pendiente inmediato, confirmación automática al reconectar sin recargar, fecha guardada es la del momento de marcar (verificado contra Supabase), el día del calendario pasa a "visto" sin el reload de la página, dos marcados offline seguidos solo dejan el último valor. |
| 5 — Falla permanente de sincronización | PASS (con una adaptación) | `tests/e2e/offline-sighting.spec.ts`, tercer escenario: en vez de invalidar la sesión (lo que sugiere esta validación para una prueba manual), se eliminó la mascota mientras estaba offline — mismo resultado bajo `classifySyncError` (violación de FK, `23503`, "cualquier código ⇒ permanente"), pero determinístico en CI. Aviso global visible tras una navegación del lado del cliente a otra pantalla, descartable. |
| 6 — PWA instalable y actualización | PASS parcial | Verificado en Fase 6: `app/manifest.ts` sirve JSON válido, `public/sw.js` se genera y activa en modo producción, `<UpdateAvailableBanner>` funciona (se confirmó de nuevo ahora, orgánicamente: al levantar `npm run start` con el build de la Fase 7 sobre un service worker ya registrado de una sesión anterior, apareció "Hay una versión nueva de PetDex disponible" con el botón "Recargar", tal como describe esta validación). El prompt nativo de instalación del navegador ("Agregar a pantalla de inicio") y el modo standalone en un dispositivo real **no se pudieron ejercitar** desde este entorno — quedan pendientes de una verificación manual en un teléfono real antes de considerar la PWA completamente validada para publicación. |

**No verificado por este agente** (requiere intervención humana): el flujo de login real con Google OAuth (el login de prueba usa `TEST_ADMIN_EMAIL`/`TEST_ADMIN_PASSWORD` vía Supabase directamente, nunca un formulario de contraseña en el navegador — entrar credenciales reales en un campo de un navegador automatizado está fuera de lo que este agente hace); el prompt de instalación nativo de PWA en un dispositivo móvil real; verificar que una sesión invalidada en un segundo dispositivo (en vez de una mascota eliminada) también dispara el aviso de falla permanente — cubierto por la misma regla de clasificación pero no ejercitado literalmente como sugiere la Validación 5.

**Nota sobre datos de prueba**: la cuadrícula de producción usada para esta verificación manual (`npm run start`) muestra mascotas de prueba dejadas por corridas anteriores de los tests de integración/E2E (`RLS write test`, `Abcdef`, y similares con prefijos `rls-`/`e2e-`) — no se tocaron ni se limpiaron como parte de esta feature; si se quiere una cuadrícula de producción limpia, es una tarea aparte de housekeeping de datos, no de código.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Fase 1)**: sin dependencias — arranca de inmediato
- **Foundational (Fase 2)**: depende de Setup — bloquea las cinco historias
- **User Story 1 (Fase 3)**: depende de Foundational únicamente
- **User Story 2 (Fase 4)**: depende de Foundational; extiende `src/lib/sightings.ts` creado en US1 (T010) — no puede empezar antes de T010, aunque es conceptualmente independiente de `<MarkTodayControl>`
- **User Story 3 (Fase 5)**: depende de Foundational, de `callMarkSighting` (US1, T010) y de `<DayCell>`/`<SightingCalendar>` (US2, T017/T019)
- **User Story 4 (Fase 6)**: depende de Foundational únicamente (no depende de US1/US2/US3) — podría implementarse en paralelo con ellas
- **User Story 5 (Fase 7)**: depende de Foundational, de `<MarkTodayControl>` (US1, T011) y de `<DayCell>`/`<MonthSummary>` (US2, T017/T018) para extenderlos con el estado "pendiente"; **no** depende de User Story 4 pese a compartir temática "offline" — usa `navigator.onLine` directamente, no el hook de US4
- **Polish (Fase 8)**: depende de que las historias que se vayan a entregar estén completas

### Advertencia de archivo compartido

`app/layout.tsx` se edita en Foundational (T008), US4 (T037, T040) y US5 (T049, T055) — son ediciones aditivas (cada una monta un provider/banner distinto) pero **no** son paralelizables entre sí: aplicar en el orden de fase, una a la vez.

`app/mascotas/[slug]/page.tsx` se edita en US1 (T012, integra `<MarkTodayControl>`), US2 (T020, integra `<SightingCalendar>`/`<MonthSummary>`) y US4 (T025, reemplaza el `{user && ...}` del botón "Editar" por `<AdminOnly>`) — mismo caso: tres historias que la Parallel Team Strategy sugiere repartir entre personas distintas, pero estas tres ediciones puntuales de ese archivo se aplican una a la vez, en el orden de fase (T012 → T020 → T025), no simultáneamente.

### Within Each User Story

- Los tests que no dependen de UI (RLS de US1, `sync-errors` de US5) pueden escribirse antes que su implementación
- Dentro de `src/lib/sightings.ts`: T010 (US1) → T014 → T015 (US2), siempre secuencial, mismo archivo
- Dentro de `src/lib/offline/`: T042 → T043 → T047 (US5), secuencial
- E2E (Playwright) al final de cada historia, sobre la UI ya integrada

### Parallel Opportunities

- Setup: T001, T002 en paralelo
- Foundational: T003+T004 (fechas) en paralelo con T005 (sesión) — T006/T007/T008 son secuenciales sobre T005
- US1: T009 en paralelo con T010
- US2: T016 (test de racha) en paralelo con T017 (day-cell) una vez que T015 está listo
- US4: T024, T027, T028, T029, T030, T034, T035, T038, T039 pueden repartirse entre distintas personas (archivos todos distintos); T031–T033, T036–T037, T040 tienen dependencias secuenciales puntuales anotadas en cada tarea
- US4 y US5 completas pueden trabajarse en paralelo por equipos distintos una vez cerradas US1 y US2 (ver advertencia de `app/layout.tsx` arriba para el momento de integrar)
- Polish: T057, T058, T060 en paralelo

---

## Parallel Example: User Story 1

```bash
# En paralelo, una vez completada Foundational:
Task: "Integration test en tests/integration/rls-sightings-write.test.ts"
Task: "Crear src/lib/sightings.ts con callMarkSighting()"

# Secuencial después (dependen de ambos anteriores):
Task: "Crear src/components/sightings/mark-today-control.tsx"
Task: "Integrar <MarkTodayControl> en app/mascotas/[slug]/page.tsx"
Task: "Extender tests/e2e/admin-flow.spec.ts"
```

---

## Implementation Strategy

### MVP First (User Story 1 solamente)

1. Completar Fase 1: Setup
2. Completar Fase 2: Foundational (crítico — bloquea todas las historias)
3. Completar Fase 3: User Story 1
4. **Parar y validar**: marcar "hoy" online funciona de punta a punta, sin duplicados
5. Desplegar/demo si está listo — ya es valor real (el gesto más frecuente de la app)

### Incremental Delivery

1. Setup + Foundational → base lista
2. User Story 1 → validar → deploy (MVP)
3. User Story 2 → validar (calendario visible con datos correctos) → deploy
4. User Story 3 → validar (corrección de días pasados) → deploy
5. User Story 4 → validar con `quickstart.md` Validación 3 y 6 (offline de solo lectura + PWA instalable) → deploy
6. User Story 5 → validar con `quickstart.md` Validación 4 y 5 (marcado offline + falla permanente) → deploy
7. Polish → `README.md`, keep-alive, verificación final

### Parallel Team Strategy

Con más de una persona disponible, después de Foundational:

- Persona A: User Story 1 → luego User Story 3 (depende de US1+US2)
- Persona B: User Story 2 (en cuanto US1 libera `src/lib/sightings.ts` con `callMarkSighting`)
- Persona C: User Story 4 (independiente de US1/US2/US3)
- User Story 5 recién puede empezar cuando US1 y US2 están cerradas (necesita `<MarkTodayControl>` y `<DayCell>` ya existentes para extenderlos)

---

## Notes

- `[P]` = archivo distinto, sin depender de una tarea todavía incompleta
- `[Story]` mapea cada tarea a su historia de usuario para trazabilidad
- Cada historia es completable y testeable de forma independiente, en el orden P1→P5
- Los tests que ejercitan lógica pura (fechas, racha, clasificación de errores, dedup de la cola) se pueden escribir antes que su implementación y deben fallar primero
- Commitear después de cada tarea o grupo lógico
- Parar en cualquier checkpoint para validar la historia de forma independiente antes de seguir
- Evitar: tareas vagas, conflictos de archivo simultáneos (ver advertencia de `app/layout.tsx`), dependencias cruzadas entre historias que rompan su independencia
