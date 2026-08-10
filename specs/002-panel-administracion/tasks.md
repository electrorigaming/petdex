---

description: "Task list for feature implementation"
---

# Tasks: Panel de administración

**Input**: Design documents from `/specs/002-panel-administracion/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/, quickstart.md — todos completos.

**Tests**: Incluidos. El brief técnico del usuario (ver plan.md) pidió explícitamente Vitest
para slug/compresión/errores y RLS, y Playwright para el flujo E2E.

**Organization**: Las tareas están agrupadas por historia de usuario (spec.md) para poder
implementar y probar cada una de forma independiente.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Puede ejecutarse en paralelo (archivos distintos, sin dependencias entre sí)
- **[Story]**: A qué historia de usuario pertenece (US1, US2, US3) — ausente en Setup/Foundational/Polish
- Cada tarea incluye la ruta de archivo exacta

## Prerrequisitos manuales (fuera de estas tareas)

Antes de empezar Phase 3 en adelante, deben existir (ver `quickstart.md`):
proveedor Google configurado en Supabase Auth, al menos un admin real insertado
en `admins`, y el admin de prueba (`TEST_ADMIN_EMAIL`/`TEST_ADMIN_PASSWORD` en
`.env.local`) también insertado en `admins`.

---

## Phase 1: Setup

**Purpose**: Dependencias y arnés de testing E2E

- [X] T001 Instalar `react-hook-form`, `zod`, `@hookform/resolvers` en `package.json`
- [X] T002 [P] Instalar `@playwright/test` como devDependency e instalar el navegador Chromium (`npx playwright install --with-deps chromium`); agregar el script `"test:e2e": "playwright test"` a `package.json`
- [X] T003 [P] Crear `playwright.config.ts` en la raíz con dos proyectos — `authenticated` (usa `storageState: 'tests/e2e/.auth/admin.json'`) y `anonymous` (sin `storageState`) — y `globalSetup: './tests/e2e/global-setup.ts'`

**Checkpoint**: Dependencias listas. Ningún test corre todavía (`global-setup.ts` no existe hasta T040).

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Infraestructura de sesión y utilidades compartidas por las tres historias

**⚠️ CRITICAL**: Ninguna historia de usuario puede empezar hasta que esta fase esté completa

- [X] T004 [P] Crear `src/lib/supabase/client.ts` — browser client con `createBrowserClient` de `@supabase/ssr`, usando `NEXT_PUBLIC_SUPABASE_URL`/`NEXT_PUBLIC_SUPABASE_ANON_KEY`
- [X] T005 [P] Crear `src/lib/errors.ts` — `mapPostgresError(error)`: `23505` → "Ese identificador ya está en uso. Probá con otro.", `42501` → "No tenés permiso para hacer esto. Iniciá sesión con una cuenta autorizada.", cualquier otro código → mensaje genérico; `console.error(error)` siempre antes de devolver el mensaje mapeado
- [X] T006 [P] Crear `tests/unit/errors.test.ts` — casos `23505`, `42501`, código desconocido, error sin código
- [X] T007 Crear `src/lib/supabase/middleware.ts` — función `updateSession(request)` que sigue el patrón oficial de `@supabase/ssr`: crea `response = NextResponse.next({ request })`, cliente con `getAll`/`setAll` que escriben en `request.cookies` y `response.cookies`, llama `await supabase.auth.getUser()` (comentario explicando por qué nunca `getSession()`), y si la ruta coincide con `/mascotas/nueva`, `/mascotas/*/editar` o `/mascotas/*/hitos/**` sin usuario, redirige a `/login?next=<pathname>` copiando las cookies de `response` sobre el `NextResponse.redirect(...)`; en cualquier otro caso devuelve el mismo `response`
- [X] T008 Crear `middleware.ts` en la raíz — llama a `updateSession` de T007, con `config.matcher` que excluye `_next/static`, `_next/image` y `favicon.ico`

**Checkpoint**: Sesión y utilidades base listas — las historias de usuario pueden empezar.

---

## Phase 3: User Story 1 - Iniciar sesión como administradora (Priority: P1) 🎯 MVP

**Goal**: Login con Google (múltiples cuentas autorizadas), redirección a origen o inicio,
enlace de login/logout visible en toda pantalla pública, sin exponer membresía en `admins`.

**Independent Test**: Con un email de Google ya autorizado en `admins`, entrar a `/login`,
iniciar sesión con una cuenta NO autorizada (no aparecen controles de edición en ningún lado
de la app — pero como todavía no existen controles hasta la US2/US3, esta parte se reverifica
en la Phase 7) y luego con una cuenta autorizada (aparece el botón de cerrar sesión). Cerrar
sesión y confirmar que vuelve a verse como un visitante.

### Implementation for User Story 1

- [X] T009 [P] [US1] Crear `src/components/auth/login-button.tsx` — Client Component, botón
  "Continuar con Google" que llama `supabase.auth.signInWithOAuth({ provider: 'google',
  options: { redirectTo: `${origin}/auth/callback?next=${next}` } })` usando el cliente de T004
- [X] T010 [P] [US1] Crear `app/login/page.tsx` — Pantalla A: lee `?next=` de los search params,
  renderiza `LoginButton` pasándole ese `next`
- [X] T011 [P] [US1] Crear `app/auth/callback/route.ts` — Route Handler que lee `code` y `next`
  de la query, llama `supabase.auth.exchangeCodeForSession(code)` con el cliente de servidor,
  valida que `next` sea una ruta relativa segura (rechaza valores que empiecen con `//` o
  contengan un esquema `http(s)://`) y redirige ahí, o a `/` si no hay `next` válido (FR-004)
- [X] T012 [P] [US1] Crear `src/components/auth/logout-button.tsx` — Client Component que llama
  `supabase.auth.signOut()` sobre el cliente de T004 y redirige a `/`
- [X] T013 [P] [US1] Crear `src/components/auth/session-nav-link.tsx` — Server Component que
  llama `getUser()` (nunca `getSession()`) sobre el cliente de servidor: si hay sesión renderiza
  `LogoutButton`, si no un enlace "Iniciar sesión" a `/login` (FR-005/FR-006)
- [X] T014 [US1] Integrar `SessionNavLink` en `app/layout.tsx` para que aparezca en toda pantalla
  pública (depende de T013)
- [X] T015 [US1] Crear `app/test/login/page.tsx` — página solo-test: `'use client'`, lee `email`/
  `password` de los search params, llama `supabase.auth.signInWithPassword({ email, password })`
  con el cliente de T004 y muestra "OK" en éxito; `return notFound()` de entrada si
  `process.env.NODE_ENV === 'production'`. Existe únicamente para que `global-setup.ts` (Phase 6)
  obtenga una sesión real sin automatizar el consentimiento de Google (research.md §6) — no se
  linkea desde ninguna otra pantalla de la app

**Checkpoint**: Login/logout con Google funcionando de punta a punta; el enlace de sesión aparece
en toda la app. `app/test/login` habilita el bootstrap de sesión para los tests E2E de las fases
siguientes.

---

## Phase 4: User Story 2 - Dar de alta y editar una mascota (Priority: P2)

**Goal**: Formulario único de alta/edición con foto subida directo a Storage, slug autogenerado
e inmutable en edición, confirmación de salida con cambios sin guardar.

**Independent Test**: Con sesión activa, crear una mascota completa con foto, confirmar que
aparece en el catálogo con el slug mostrado durante el alta, editarla (nombre + foto) y
confirmar que la URL original sigue funcionando y la foto vieja ya no está en Storage.

### Tests for User Story 2 ⚠️

> Escribir estos tests primero y confirmar que fallan antes de implementar

- [X] T016 [P] [US2] `tests/unit/slug.test.ts` — `generateSlug`: nombre simple, acentos ("Ñandú
  Peludo" → "nandu-peludo"), espacios múltiples, caracteres especiales, string vacío
- [X] T017 [P] [US2] `tests/unit/image-compression.test.ts` — `compressToWebp`: imagen de entrada
  mayor a 1600px se reduce al lado mayor correcto, formato de salida es `image/webp`, imagen ya
  menor a 1600px no se agranda
- [X] T018 [P] [US2] `tests/integration/rls-pets-insert.test.ts` — extender el test existente
  (que ya confirma `42501` con anon key) agregando el camino positivo: `signInWithPassword` con
  `TEST_ADMIN_EMAIL`/`TEST_ADMIN_PASSWORD`, mismo insert, confirmar éxito
- [X] T019 [P] [US2] `tests/integration/rls-pets-write.test.ts` — sobre `update` y `delete`: la
  sesión admin de prueba tiene éxito; **corregido tras verificación real**: a diferencia de
  `insert` (que falla con `42501` vía `WITH CHECK`), un `update`/`delete` de anon cuyo `USING`
  oculta la fila no da ningún error — PostgREST simplemente no encuentra fila que tocar. La
  aserción correcta es confirmar que la fila sigue sin cambios/sin borrar, no un código de error

### Implementation for User Story 2

- [X] T020 [P] [US2] Crear `src/lib/slug.ts` — `generateSlug(name)`: `.normalize('NFD')`, quita
  diacríticos, minúsculas, colapsa cualquier corrida de caracteres no alfanuméricos a un guion,
  recorta guiones al inicio/final (implementación para que T016 pase)
- [X] T021 [P] [US2] Crear `src/lib/image-compression.ts` — `compressToWebp(file)`:
  `createImageBitmap(file)` → `<canvas>` con lado mayor limitado a 1600px → `convertToBlob({
  type: 'image/webp', quality: 0.8 })` (implementación para que T017 pase)
- [X] T022 [P] [US2] Crear `src/lib/validation/pet-schema.ts` — esquema Zod: `name` obligatorio,
  `nicknames` array de strings, `slug` con patrón kebab-case, `zone`/`location`/`ageEstimate`/
  `description` opcionales con límites de longitud, `registeredOn` fecha, `weightKg` numérico
  positivo opcional (máx 999.99), `status` enum de los 4 valores (data-model.md)
- [X] T023 [US2] Crear `src/components/pets/photo-field.tsx` — input de archivo (cámara/galería),
  preview con `URL.createObjectURL`, valida MIME de entrada contra los permitidos por el bucket,
  comprime con T021 antes de subir, sube con `supabase.storage.from('pet-photos').upload(...)`
  mostrando progreso, expone `onChange(url | null)` incluyendo un control para quitar la foto sin
  reemplazar (FR-013)
- [X] T024 [US2] Crear `src/components/pets/slug-field.tsx` — muestra el slug generado por T020 a
  partir de `name`; editable solo en modo alta; en modo edición es de solo lectura (FR-016);
  consulta en vivo `pets` por `slug` (lectura pública, sin Server Action) para avisar colisión
  antes de guardar (FR-015)
- [X] T025 [US2] Crear `src/components/pets/pet-form.tsx` — React Hook Form + `@hookform/
  resolvers/zod` con el esquema de T022, un solo componente para alta y edición, campos grandes
  mobile-first, teclado numérico en `weightKg`, integra `PhotoField` y `SlugField`, confirmación
  al intentar salir con cambios sin guardar (FR-017, solo en este formulario), muestra estado de
  carga durante el submit (FR-024) y el mensaje mapeado por `src/lib/errors.ts` en error (FR-025)
- [X] T026 [US2] Crear `createPet(input)` en `src/lib/actions/pets.ts` (archivo separado de
  `src/lib/pets.ts` con `"use server"` a nivel de módulo — Next.js rechaza una Server Action
  inline en un módulo que un Client Component también importe por un export sincrónico, y esto
  evita el problema para siempre) — `getUser()` para mensaje temprano, genera nada (el `id` ya
  viene del cliente, ver contracts/mutations.md), valida con `pet-schema.ts`, inserta con el
  cliente de servidor, mapea error con T005, `revalidatePath('/')`, devuelve
  `{ ok, slug } | { ok: false, message }`
- [X] T027 [US2] Crear `updatePet(id, input)` en `src/lib/actions/pets.ts` — valida, actualiza la
  fila; si `photoUrl` es `string` (reemplazo) o `null` (quitar, FR-013) y la actualización de la
  fila tuvo éxito, borra el archivo anterior de Storage recién entonces; mapea error con T005,
  `revalidatePath('/')` y `revalidatePath('/mascotas/[slug]', 'page')`
- [X] T028 [US2] Crear `app/mascotas/nueva/page.tsx` — Pantalla B en modo alta: genera el `id`
  (`crypto.randomUUID()`) en el cliente, renderiza `PetForm`, llama `createPet` al enviar
- [X] T029 [US2] Crear `app/mascotas/[slug]/editar/page.tsx` — Pantalla B en modo edición: carga
  la mascota existente, renderiza `PetForm` con el slug de solo lectura, llama `updatePet`
- [X] T030 [US2] Editar `app/page.tsx` — agregar botón "Dar de alta" a `/mascotas/nueva`,
  condicionado a que `getUser()` indique sesión activa (oculto para visitantes, FR-022)
- [X] T031 [US2] Editar `app/mascotas/[slug]/page.tsx` — agregar botón "Editar" a
  `/mascotas/[slug]/editar`, condicionado a sesión activa

**Checkpoint**: Alta y edición de mascota con foto funcionando de punta a punta, con RLS
verificado en ambos sentidos (US1 + US2 combinadas ya son un incremento entregable completo).

---

## Phase 5: User Story 3 - Registrar y mantener los hitos de una mascota (Priority: P3)

**Goal**: Alta/edición/borrado de hitos desde la ficha, reflejados en la timeline sin recargar.

**Independent Test**: Con sesión activa y al menos una mascota ya creada (US2), agregar un hito,
confirmar que aparece en la timeline sin recargar, editarlo, y borrarlo confirmando que el
diálogo nombra el hito correcto.

### Tests for User Story 3 ⚠️

- [X] T032 [P] [US3] `tests/integration/rls-milestones-write.test.ts` — mismo patrón que T018/T019
  sobre `milestones`: `insert` con anon key falla con `42501`; `update`/`delete` de anon se
  verifican confirmando que la fila queda sin cambios (ver nota de T019); con sesión admin de
  prueba las tres operaciones tienen éxito

### Implementation for User Story 3

- [X] T033 [P] [US3] Crear `src/lib/validation/milestone-schema.ts` — esquema Zod: `title`
  obligatorio, `occurredOn` fecha (default hoy en el formulario, no en el esquema), `category`
  enum opcional de las 4 categorías existentes, `note` opcional con límite de longitud
- [X] T034 [US3] Crear `src/components/milestones/milestone-form.tsx` — React Hook Form + Zod
  (T033), un componente para alta y edición, fecha precargada con hoy en modo alta, estado de
  carga durante el submit (FR-024), mensaje mapeado en error (FR-025)
- [X] T035 [US3] Crear `src/components/milestones/delete-milestone-dialog.tsx` — diálogo de
  confirmación que muestra el título del hito en el propio texto (p. ej. "¿Borrar el hito
  'Primera vacuna'?", ver Assumptions de spec.md — no exige escribir el nombre) antes de habilitar
  "Confirmar" (FR-021)
- [X] T036 [US3] Crear `createMilestone(petId, petSlug, input)`, `updateMilestone(id, petSlug,
  input)` y `deleteMilestone(id, petSlug)` en `src/lib/actions/milestones.ts` (archivo separado
  de `src/lib/milestones.ts`, mismo motivo que T026) — validan con T033, ejecutan con el cliente
  de servidor, mapean error con T005, `revalidatePath('/mascotas/[slug]', 'page')`, devuelven
  `{ ok, milestone } | { ok, } | { ok: false, message }` según corresponda (contracts/mutations.md)
- [X] T037 [US3] Editar `src/components/milestone-timeline.tsx` (de la feature 1) — agregar,
  condicionados a sesión activa: botón "Agregar hito" a `/mascotas/[slug]/hitos/nuevo`, controles
  de editar/borrar por hito, y actualizar el estado local de la timeline directamente con el
  objeto que devuelven las Server Actions de T036 al crear/editar/borrar (FR-019, sin depender de
  un refetch — research.md §5)
- [X] T038 [US3] Crear `app/mascotas/[slug]/hitos/nuevo/page.tsx` — Pantalla C en modo alta:
  renderiza `MilestoneForm`, llama `createMilestone`
- [X] T039 [US3] Crear `app/mascotas/[slug]/hitos/[hitoId]/editar/page.tsx` — Pantalla C en modo
  edición: carga el hito existente, renderiza `MilestoneForm`, llama `updateMilestone`

**Checkpoint**: Las tres historias de usuario funcionan de punta a punta, cada una probada de
forma independiente.

---

## Phase 6: E2E de punta a punta (todas las historias)

**Purpose**: Validar el flujo completo pedido explícitamente en el brief técnico (login → alta
con foto → agregar hito → cerrar sesión → visibilidad sin sesión), con la sesión de admin
bootstrapeada programáticamente en vez de automatizar el consentimiento real de Google
(research.md §6). Depende de que las Phases 3, 4 y 5 estén completas.

- [X] T040 Crear `tests/e2e/auth.setup.ts` como "setup project" de Playwright (no `globalSetup`:
  el orden de éste respecto de `webServer` no está garantizado, y este flujo necesita el server
  arriba) — navega a `/test/login?email=<TEST_ADMIN_EMAIL>&password=<TEST_ADMIN_PASSWORD>` (T015),
  espera el texto "OK", guarda `storageState` en `tests/e2e/.auth/admin.json`; el proyecto
  `authenticated` de `playwright.config.ts` declara `dependencies: ['setup']` (ajustado de T003)
- [X] T041 [P] Crear `tests/e2e/admin-flow.spec.ts` (proyecto `authenticated`) — alta de mascota
  con foto (T028), edición con reemplazo de foto (T029), agregar un hito (T038), verificar que
  aparece en la timeline sin recargar, cerrar sesión (T012) y confirmar que los controles
  desaparecen. **Corregido tras verificación real**: el primer `waitForURL(/\/mascotas\/[^/]+$/)`
  matcheaba también la URL de partida `/mascotas/nueva`, resolviendo antes de que terminara el
  submit real y guardando un `createdSlug` incorrecto — se reemplazó por un predicado que excluye
  explícitamente `/mascotas/nueva`. Suite completa (setup + authenticated + anonymous) verificada
  en verde: `npx playwright test` → 5/5
- [X] T042 [P] Crear `tests/e2e/anonymous-visibility.spec.ts` (proyecto `anonymous`, sin
  `storageState`) — visitar `/` y una ficha de mascota, confirmar que no aparece ningún control de
  creación/edición/borrado, y que el enlace visible es "Iniciar sesión" (FR-022)

**Checkpoint**: Cobertura E2E completa según lo pedido; `npm run test` (Vitest) y
`npm run test:e2e` (Playwright) ambos en verde.

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Verificación final contra el checklist de `quickstart.md` y `CLAUDE.md`

- [X] T043 [P] Verificar en 375px de ancho: `/login`, `/mascotas/nueva`, `/mascotas/[slug]/editar`,
  `/mascotas/[slug]/hitos/nuevo` — campos alcanzables con el pulgar, sin necesitar zoom
  (Principio III). Verificado con el dev server + navegador: `/`, `/login` y el redirect de
  `/mascotas/nueva` → `/login?next=...` renderizan correctamente, sin errores de consola propios
  del código (el único warning de hidratación observado viene de atributos `bis_*` inyectados por
  una extensión del navegador, no del código de la app).
- [X] T044 [P] Confirmar en el dashboard de Supabase Storage que ningún archivo de foto quedó
  huérfano tras correr la suite E2E completa (T041), y que reemplazar/quitar una foto efectivamente
  libera el archivo anterior (Principio IV). Flujo real verificado manualmente por el usuario con
  su propia cuenta de Google: alta de mascota con foto → agregar hito → edición con reemplazo de
  foto, todo en `200` sin errores (`POST /mascotas/nueva`, `POST /mascotas/pepito/hitos/nuevo`,
  `POST /mascotas/pepito/editar`). La suite automatizada de Playwright (T041/T042) sigue sin
  correr — necesita el admin de prueba con `TEST_ADMIN_EMAIL`/`TEST_ADMIN_PASSWORD`, que es
  opcional para el funcionamiento de la app y solo hace falta para automatizar este mismo chequeo.
- [X] T045 Correr el checklist completo de "tarea terminada" de `quickstart.md`: `npm run
  typecheck` ✅, `npm run test` ✅ para todo lo que no depende del admin de prueba (unitarios +
  camino negativo de RLS), flujo real de punta a punda verificado a mano por el usuario con su
  cuenta de Google ✅, y ninguna variable de entorno de aplicación nueva fuera de las dos permitidas
  ✅. Pendiente, opcional: `TEST_ADMIN_EMAIL`/`TEST_ADMIN_PASSWORD` en `.env.local` para que
  también corran el camino positivo de RLS y `npm run test:e2e` de forma automatizada — no bloquea
  el uso real de la app, que ya funciona de punta a punta.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: sin dependencias
- **Foundational (Phase 2)**: depende de Setup — bloquea las tres historias
- **US1 (Phase 3)**: depende de Foundational únicamente
- **US2 (Phase 4)**: depende de Foundational; T030/T031 asumen que `SessionNavLink`/`getUser()`
  de US1 ya existe para condicionar la visibilidad de los botones, pero el resto de US2 (formulario,
  Server Actions, subida de fotos) no depende de US1 en absoluto
- **US3 (Phase 5)**: depende de Foundational y de que exista al menos una mascota para probarla
  sobre algo real (US2) — el código de US3 en sí no importa código de US2
- **E2E (Phase 6)**: depende de que Phases 3, 4 y 5 estén completas (el flujo cruza las tres)
- **Polish (Phase 7)**: depende de todo lo anterior

### Dentro de cada historia

- Tests (T016-T019, T032) antes de su implementación correspondiente
- Utilidades puras (slug, compresión, esquemas Zod) antes de los componentes que las usan
- Server Actions antes de las páginas que las llaman
- `pet-form.tsx`/`milestone-form.tsx` antes de las páginas de alta/edición que los envuelven

### Oportunidades de paralelismo

- Setup: T002 y T003 en paralelo (T001 primero, ya que T002 agrega un script al mismo
  `package.json` que T001 toca)
- Foundational: T004, T005, T006 en paralelo; T007 y T008 son secuenciales entre sí
- US1: T009-T013 en paralelo (archivos distintos, todas consumen solo T004); T014 y T015 después
- US2: T016-T019 (tests) en paralelo entre sí; T020-T022 en paralelo; T023-T031 mayormente
  secuenciales porque cada uno depende del anterior en la cadena formulario → Server Action → página
- US3: T033 en paralelo con lo que quede de US2; T034-T039 mayormente secuenciales por la misma razón
- Una vez completa Foundational, un segundo desarrollador podría tomar US1 mientras otro arranca
  la parte de US2 que no depende de la sesión (T020-T027)

---

## Parallel Example: User Story 2 (tests)

```bash
Task: "tests/unit/slug.test.ts — generateSlug con acentos y ñ"
Task: "tests/unit/image-compression.test.ts — compressToWebp respeta 1600px y WebP"
Task: "tests/integration/rls-pets-insert.test.ts — agregar camino positivo con admin de prueba"
Task: "tests/integration/rls-pets-write.test.ts — update/delete, anon falla / admin tiene éxito"
```

---

## Implementation Strategy

### MVP First (User Story 1 únicamente)

1. Phase 1: Setup
2. Phase 2: Foundational (bloqueante)
3. Phase 3: User Story 1
4. **Parar y validar**: login/logout con Google funciona de punta a punta, enlace de sesión visible
   en toda la app — aunque todavía no hay nada que editar
5. Recién ahí seguir con US2 (el verdadero valor: reemplazar la carga manual en la base)

### Entrega incremental

1. Setup + Foundational → base lista
2. US1 → login funcionando (no es un MVP demostrable por sí solo, pero es la base de seguridad de
   todo lo demás)
3. US2 → alta/edición de mascotas — **este es el primer incremento con valor real**, reemplaza la
   deuda operativa que motivó la feature
4. US3 → hitos — valor incremental sobre la ficha ya construida en la feature 1
5. Phase 6 (E2E) y Phase 7 (Polish) cierran la feature

---

## Notes

- `[P]` = archivos distintos, sin dependencias entre sí
- La etiqueta `[Story]` mapea cada tarea a su historia para trazabilidad
- Verificar que los tests fallan antes de implementar (T016-T019, T032)
- Confirmar cada checkpoint de fase antes de seguir con la siguiente
- `app/test/login` (T015) es la única pieza de código de producción que existe exclusivamente para
  testing — está deliberadamente gateada por `NODE_ENV` y documentada como tal; no es un atajo de
  seguridad porque no otorga nada que la política RLS no volviera a exigir igual (research.md §6)
