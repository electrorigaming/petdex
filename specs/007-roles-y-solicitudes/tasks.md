---

description: "Task list for feature implementation"
---

# Tasks: Rol Usuario, solicitud de cuenta y registro de modificaciones

**Input**: Design documents from `/specs/007-roles-y-solicitudes/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/, quickstart.md — todos completos.

**Tests**: Se incluyen tests de integración RLS nuevos (o extendidos) por
historia, mismo criterio que `002`/`005`: la garantía central de cada
historia es una política de base de datos o un trigger, y la única forma real
de probarlos es contra Postgres.

**Organization**: Las tareas están agrupadas por historia de usuario
(spec.md) para poder implementar y probar cada una de forma independiente.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Puede ejecutarse en paralelo (archivos distintos, sin dependencias entre sí)
- **[Story]**: A qué historia de usuario pertenece (US1, US2, US3) — ausente en Setup/Foundational/Polish
- Cada tarea incluye la ruta de archivo exacta

## Prerrequisitos manuales (fuera de estas tareas)

Entre la Fase 1 y la Fase 2, fuera de este agente (Principio I — nunca con la
service role key):

1. Aplicar la migración de T001: pegar el contenido completo de
   `supabase/migrations/20260824120000_roles_y_solicitudes.sql` en el SQL
   Editor del dashboard de Supabase y ejecutarlo.
2. Confirmar en el SQL Editor que la migración movió a las administradoras
   existentes:
   ```sql
   select user_id, email, role from public.app_users;
   -- esperado: una fila por cada admin que antes estaba en `admins`, role='admin'
   ```
3. Verificar `storage.foldername()` antes de dar por buena la migración
   (research.md §9):
   ```sql
   select storage.foldername('abc/123.webp');
   -- esperado: {abc}
   ```
4. Regenerar tipos: `npm run gen:types`.
5. Crear una segunda cuenta de prueba con password auth (mismo mecanismo ya
   usado para `TEST_ADMIN_EMAIL`/`TEST_ADMIN_PASSWORD` — Authentication del
   dashboard de Supabase, nunca expuesto en la UI real de la app), agregar
   `TEST_USER_EMAIL`/`TEST_USER_PASSWORD` al `.env` de test (no son las dos
   variables públicas del Principio I — son credenciales de testing, mismo
   estatus que las de `TEST_ADMIN_*`), y sembrar su rol:
   ```sql
   insert into public.app_users (user_id, email, display_name, role, approved_by)
   values ('<uuid-de-TEST_USER_EMAIL>', '<TEST_USER_EMAIL>', 'Cuenta de prueba', 'usuario',
           (select user_id from public.app_users where role = 'admin' limit 1));
   ```
6. Crear una tercera cuenta de prueba, mismo mecanismo, **sin** sembrarle
   ninguna fila en `app_users` — a diferencia de `TEST_USER_EMAIL`, esta
   queda "sin reclamar" a propósito, porque el test de
   `claim_approved_account()` (T028) necesita una cuenta que todavía no
   tenga rol para poder probar el enganche real. Agregar
   `TEST_CLAIM_EMAIL`/`TEST_CLAIM_PASSWORD` al `.env` de test.

Sin los pasos 1–5, T005 en adelante no van a tipar ni a correr correctamente.

---

## Phase 1: Setup

**Purpose**: Migración de esquema — prerrequisito de todo lo demás

- [X] T001 Crear `supabase/migrations/20260824120000_roles_y_solicitudes.sql`
  con, en este orden (research.md §1–§9, SQL completo ahí):
  1. `create table public.app_users (...)` (research.md §1)
  2. `insert into public.app_users (...) select ... from public.admins a join auth.users u ...` — migra administradoras existentes
  3. `drop policy "admins_self_read" on public.admins;` y `drop table public.admins;`
  4. `create or replace function public.is_admin() ...` (redefinida sobre `app_users`) y `create or replace function public.is_editor() ...` + sus `revoke`/`grant` (research.md §1)
  5. `alter table public.app_users enable row level security;` + policies `app_users_read` (select propio o admin) y `app_users_admin_revoke_usuario` (delete, admin y `role='usuario'`) (research.md §1)
  6. `create table public.account_requests (...)` + índice único parcial `account_requests_pending_email_idx` (research.md §2)
  7. `alter table public.account_requests enable row level security;` + policies `account_requests_public_insert`, `account_requests_admin_read`, `account_requests_self_read`, `account_requests_admin_review` (research.md §2)
  8. `create or replace function public.claim_approved_account() ...` + `revoke`/`grant` (research.md §3)
  9. `drop policy "milestones_admin_write" on public.milestones;` → `milestones_editor_write` (usa `is_editor()`, conserva la condición de ownership); misma operación para `sightings_admin_write` → `sightings_editor_write` (research.md §4)
  10. `create policy "pets_usuario_insert_private" ...`, `"pets_usuario_update_own_private" ...`, `"pets_usuario_delete_own_private" ...` en `public.pets` — se suman a las de admin, no las reemplazan (research.md §8)
  11. `drop policy "pet_photos_admin_write/update/delete" on storage.objects;` → `create policy "pet_photos_editor_insert/update/delete" ...` con verificación de dueño por `storage.foldername(name)` (research.md §9)
  12. `create table public.pet_activity_log (...)` + índice `pet_activity_log_pet_date_idx` (research.md §5)
  13. `alter table public.pet_activity_log enable row level security;` + policy `pet_activity_log_admin_read` (research.md §5)
  14. `create or replace function public.current_actor_label() ...`, `create or replace function public.log_pet_activity()/log_milestone_activity()/log_sighting_activity() ...` + sus triggers `pets_log_activity`, `milestones_log_activity`, `sightings_log_activity` (research.md §5)
  15. `create or replace function public.my_account_status() returns table(role text, request_status text) ...` (`security definer`, `stable`; junta `app_users` por `auth.uid()` y la última `account_requests` por `auth.jwt()->>'email'` cuando no hay fila en `app_users`, contracts/database.md) + `revoke`/`grant execute ... to authenticated, anon`

**Checkpoint**: Migración lista para que el usuario la aplique (ver
Prerrequisitos manuales arriba). No se avanza a Phase 2 hasta que `npm run
gen:types` refleje `app_users`/`account_requests`/`pet_activity_log` y la
ausencia de `admins`.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Sesión y gate compartidos por las tres historias de usuario

**⚠️ CRITICAL**: Ninguna historia de usuario puede empezar hasta que esta fase esté completa

- [X] T002 En `src/components/auth/session-provider.tsx`: reemplazar la
  llamada a `rpc("is_admin")` por `rpc("my_account_status")`; exponer
  `{ isAuthenticated, isAdmin, isEditor, role, requestStatus, email, loading }`
  en `SessionContextValue` (`isAdmin = role === "admin"`,
  `isEditor = role === "admin" || role === "usuario"`) — data-model.md,
  sección "Sesión"
- [X] T003 En `src/hooks/use-session.ts`: sin cambios de lógica, solo
  verificar que el tipo re-exportado siga a `SessionContextValue` de T002
  (`npm run typecheck` debe marcar cualquier consumidor desalineado)
- [X] T004 En `src/components/auth/admin-gate.tsx`: cambiar la condición de
  bloqueo de `!loading && isAuthenticated && !isAdmin` a
  `!loading && isAuthenticated && !isAdmin && !isEditor` — una cuenta
  `usuario` deja de chocar con `<NotAdminScreen>` (depende de T002)

**Checkpoint**: `npm run typecheck` pasa. Una cuenta con `role='usuario'`
sembrada a mano (Prerrequisitos manuales, paso 5) ya puede iniciar sesión y
llegar a la app normal, sin distinguir todavía mensajes de "solicitud
pendiente" (eso lo agrega US3) — las historias de usuario pueden empezar.

---

## Phase 3: User Story 1 - Una cuenta Usuario gestiona su propio seguimiento diario y sus propias mascotas privadas (Priority: P1) 🎯 MVP

**Goal**: Una cuenta con `role='usuario'` puede agregar/editar/eliminar
hitos y marcar avistamientos en cualquier mascota Pública, y puede crear,
editar y eliminar sus propias mascotas — siempre y únicamente con Tipo
Privado — sin tocar nunca una mascota Pública ni cambiar el Tipo de ninguna.

**Independent Test**: Con la cuenta de prueba `TEST_USER_EMAIL` (Prerrequisitos
manuales, paso 5), iniciar sesión, agregar/editar/eliminar un hito y marcar un
avistamiento en una mascota pública, crear una mascota propia (queda Privada
sin poder elegir otra cosa), editarla y eliminarla, y confirmar por API que
no puede tocar una mascota Pública, la Privada de otra cuenta, ni cambiar el
Tipo de la suya (quickstart.md, Escenario 1).

### Tests for User Story 1

- [X] T005 [P] [US1] En `tests/integration/rls-milestones-write.test.ts`:
  agregar un `describe` (o casos dentro del existente) que inicia sesión con
  `TEST_USER_EMAIL`/`TEST_USER_PASSWORD` y confirma que puede `insert`,
  `update` y `delete` sobre `milestones` de una mascota **pública**, igual
  que la cuenta admin
- [X] T006 [P] [US1] En `tests/integration/rls-sightings-write.test.ts`:
  mismo agregado que T005 pero para `sightings` de una mascota **pública**
  (incluido `rpc('mark_sighting', ...)` con la sesión de `TEST_USER_EMAIL`)
- [X] T007 [P] [US1] En `tests/integration/rls-pets-write.test.ts`: con la
  sesión `TEST_USER_EMAIL`, cubrir (research.md §8):
  - `insert` con `visibility: "publico"` → falla (`42501`)
  - `insert` con `visibility: "privado", created_by: <su-uid>` → éxito
  - `update`/`delete` sobre esa misma fila propia (dato normal, no Tipo) → éxito
  - `update` de esa misma fila cambiando `visibility` a `"publico"` → 0 filas afectadas
  - `update`/`delete` sobre una mascota **pública** existente (creada por la
    cuenta admin de prueba) → 0 filas afectadas
  - `update`/`delete` sobre la mascota **privada** de la cuenta admin de
    prueba (sembrada a mano para el test) → 0 filas afectadas
  - reinsertar (simulando `restorePet`) la misma fila propia recién borrada,
    con el mismo `id`/`created_by`/`visibility` → éxito
- [X] T008 [P] [US1] Crear `tests/integration/rls-pet-photos-storage.test.ts`:
  con la sesión `TEST_USER_EMAIL` — `upload` bajo un `petId` nuevo
  (`crypto.randomUUID()`, sin fila en `pets` todavía) → éxito; `upload` bajo
  el `petId` de su propia mascota privada (creada en el test) → éxito;
  `upload`/`update`/`remove` bajo el `petId` de una mascota **pública**
  existente → falla; bajo el `petId` de la privada de la cuenta admin de
  prueba → falla (research.md §9; reusar `tests/e2e/fixtures/pet-photo.png`
  como archivo de prueba)

### Implementation for User Story 1

- [X] T009 [US1] Crear `src/components/auth/editor-only.tsx`: mismo patrón
  que `src/components/auth/admin-only.tsx` pero usando `isEditor` en vez de
  `isAuthenticated` (`if (loading || !isEditor) return null`)
- [X] T010 [P] [US1] En `src/components/sightings/mark-today-control.tsx`:
  reemplazar `<AdminOnly>` por `<EditorOnly>` (import de T009) (depende de T009)
- [X] T011 [P] [US1] En `src/components/sightings/mark-today-toggle.tsx`:
  mismo reemplazo que T010 (depende de T009)
- [X] T012 [P] [US1] En `src/components/sightings/pet-sightings-section.tsx`:
  reemplazar el uso de `isAuthenticated` por `isEditor` en las tres
  referencias (`onDaySelect`, `onCorrectDay`, render de `<PastDayDialog>`)
- [X] T013 [P] [US1] En `src/components/milestone-timeline.tsx`: cambiar
  `const { isAuthenticated: isAdmin } = useSession()` por
  `const { isEditor } = useSession()` y renombrar los dos usos de `isAdmin`
  del archivo a `isEditor` (botón "Agregar hito" y controles de
  editar/eliminar por hito)
- [X] T014 [P] [US1] En `src/components/empty-states.tsx`: cambiar
  `isAuthenticated` por `isEditor` en `<EmptyState>` — una cuenta Usuario
  también puede crear (sus propias, Privadas)
- [X] T015 [P] [US1] En `src/components/pets/add-pet-button.tsx`: cambiar
  `isAuthenticated` por `isEditor`
- [X] T016 [US1] En `src/components/pets/pet-form.tsx`: leer
  `useSession().role`; cuando `role === "usuario"`, no renderizar el grupo
  de radios de "Tipo" (líneas ~342-362) y forzar `visibility: "privado"` en
  el valor por defecto de modo `create` (línea ~105, hoy `"publico"`) —
  en modo `edit` el valor ya llega fijo en `"privado"` vía `initialValues`
  y tampoco se muestra el grupo; sin cambios de comportamiento cuando
  `role === "admin"` (data-model.md, sección "Formulario y controles de mascota")
- [X] T017 [US1] En `src/components/pets/edit-pet-button.tsx`: agregar prop
  `visibility: PetVisibility`; condición pasa de `isAuthenticated` a
  `isAdmin || (isEditor && visibility === "privado")`
- [X] T018 [US1] En `src/components/pets/delete-pet-button.tsx`: mismo
  cambio que T017 (prop `visibility`, misma condición)
- [X] T019 [US1] En `src/components/pets/pet-admin-actions.tsx`: agregar prop
  `visibility: PetVisibility` y pasarla a `<EditPetButton>`/`<DeletePetButton>`
  (T017, T018); su propio gate pasa de `isAuthenticated` a
  `isAdmin || (isEditor && visibility === "privado")` (depende de T017, T018)
- [X] T020 [US1] En `app/mascotas/[slug]/page.tsx`: pasar
  `visibility={pet.visibility}` a `<PetAdminActions>` (ya disponible en
  `PetDetail`/`getPetBySlug()` desde `006-tipo-editable-formulario`, research.md §7)
  (depende de T019)
- [X] T021 [P] [US1] En `src/components/pet-grid.tsx`: cambiar la condición
  que muestra el grupo de filtro "Tipo" de `isAdmin` a `isEditor` (línea
  ~333) — una cuenta Usuario también tiene mascotas Privadas propias para
  filtrar
- [X] T022 [US1] En `src/lib/actions/pets.ts`: en `updatePet()`, encadenar
  `.select().maybeSingle()` al `update(...)` y devolver
  `{ ok: false, message: "No tenés permiso para editar esta mascota." }`
  cuando el resultado es `null` sin `error`; en `deletePet()`, usar
  `.delete({ count: "exact" })` y devolver el mismo tipo de error cuando
  `count === 0` (research.md §10 — RLS rechaza `update`/`delete` sin fila
  afectada en vez de con un `error`, y el rol Usuario es la primera cuenta
  que puede alcanzar ese camino navegando con normalidad)

**Checkpoint**: User Story 1 funcional de punta a punta — una cuenta Usuario
edita hitos/avistamientos de cualquier mascota pública, gestiona sus propias
mascotas privadas de punta a punta, y no puede tocar nada más.

---

## Phase 4: User Story 2 - Una administradora ve quién hizo cada cambio en una mascota (Priority: P2)

**Goal**: Sección "Historial" en la ficha, solo para administradoras, con
cada evento de creación/edición/hito/avistamiento atribuido a su cuenta.

**Independent Test**: Con dos cuentas de escritura (admin + usuario) haciendo
varias acciones alternadas sobre la misma mascota pública, confirmar que el
Historial las lista en orden con la cuenta correcta, y que una cuenta Usuario
o sin sesión no ve la sección en absoluto (quickstart.md, Escenario 2).

### Tests for User Story 2

- [X] T023 [P] [US2] Crear `tests/integration/rls-pet-activity-log.test.ts`:
  con la sesión admin, crear una mascota, un hito y un avistamiento, y
  confirmar que aparecen las filas esperadas en `pet_activity_log` (creadas
  por los triggers, no por la Action); con `anon` y con la sesión
  `TEST_USER_EMAIL`, confirmar que `select` sobre `pet_activity_log` devuelve
  `[]`; con cualquier sesión (incluida la admin), confirmar que un `insert`
  manual en `pet_activity_log` falla (`42501`) — nadie escribe ahí salvo los
  triggers

### Implementation for User Story 2

- [X] T024 [P] [US2] Crear `src/lib/activity-log.ts` (no `src/lib/pets.ts` —
  verificado en validación manual: `pets.ts` importa
  `src/lib/supabase/server.ts`/`next/headers` a nivel de archivo, y
  `activity-log.tsx` es un Client Component; importar de `pets.ts` arrastraba
  ese import al bundle del cliente y rompía el build con "You're importing a
  component that needs next/headers"): agregar
  `ActivityEvent`/`ActivityAction`/`ACTIVITY_ACTION_LABEL` (data-model.md) y
  una función `getActivityLog(supabase, petId)` que hace `select` sobre
  `pet_activity_log` ordenado por `created_at desc`
- [X] T025 [US2] Crear `src/components/pets/activity-log.tsx`: Client
  Component; `useSession()` para el gate (`if (loading || !isAdmin) return
  null` — mismo patrón que `<PetAdminActions>`, nunca se pasan datos de
  historial como prop desde un Server Component, se piden desde el cliente
  recién cuando `isAdmin` es `true`, para no filtrar datos sensibles al HTML
  cacheado); al montar (o cuando `isAdmin` pasa a `true`), llama a
  `getActivityLog` (T024) con el cliente browser (`@/lib/supabase/client`) y
  renderiza la lista (`"{actorLabel} {ACTIVITY_ACTION_LABEL[action]}{detail
  ? \`: ${detail}\` : ''}"`, con la fecha) (depende de T024)
- [X] T026 [US2] En `app/mascotas/[slug]/page.tsx`: renderizar
  `<ActivityLog petId={pet.id} />` (import de T025) en la ficha — mismo
  patrón que `<PetAdminActions>`, sin ningún chequeo de sesión en el Server
  Component (depende de T025)

**Checkpoint**: User Story 2 funcional de punta a punta — el Historial
refleja cada acción cubierta y solo lo ven administradoras.

---

## Phase 5: User Story 3 - Alguien del barrio solicita una cuenta Usuario y una administradora la aprueba (Priority: P3)

**Goal**: Formulario público en `/login`, panel `/admin/solicitudes` para
aprobar/rechazar/revocar, y enganche automático del rol en el próximo login
real de Google.

**Independent Test**: Completar el formulario sin sesión, aprobar desde el
panel, iniciar sesión con Google con ese email y confirmar que ya tiene rol
Usuario sin pasos adicionales; probar por separado el rechazo y la revocación
(quickstart.md, Escenario 3).

### Tests for User Story 3

- [X] T027 [P] [US3] Crear `tests/integration/rls-account-requests.test.ts`:
  con `anon`, `insert` de una solicitud `pendiente` tiene éxito; un segundo
  `insert` con el mismo email mientras la primera sigue pendiente falla
  (`23505`); `anon`/la propia sesión no pueden `update` su solicitud
  (`status`, `reviewed_by`); con la sesión admin, `select`/`update`
  (aprobar/rechazar) sobre cualquier solicitud tiene éxito; con una sesión
  autenticada de prueba cuyo email coincide con una solicitud propia,
  `select` la devuelve aunque no sea admin (política `account_requests_self_read`)
- [X] T028 [P] [US3] Crear `tests/integration/rls-app-users.test.ts`: con la
  sesión admin, `select` devuelve todas las filas; con la sesión
  `TEST_USER_EMAIL`, `select` solo devuelve su propia fila; la sesión admin
  puede `delete` la fila de `TEST_USER_EMAIL` (`role='usuario'`) pero un
  intento de `delete` sobre una fila `role='admin'` falla (0 filas
  afectadas); además, el flujo completo de `claim_approved_account()`
  (research.md §6): insertar una solicitud con el email de una tercera
  cuenta de prueba, aprobarla con la sesión admin, iniciar sesión con esa
  tercera cuenta y llamar `rpc('claim_approved_account')`, y confirmar que
  aparece la fila esperada en `app_users` con `role='usuario'`

### Implementation for User Story 3

- [X] T029 [P] [US3] Crear `src/lib/validation/account-request-schema.ts`:
  esquema Zod `{ email: z.string().email(), displayName: z.string().min(1) }`
- [X] T030 [US3] Crear `src/lib/actions/account-requests.ts` con
  `submitAccountRequest`, `approveRequest`, `rejectRequest`,
  `revokeUsuario` (contracts/server-actions.md — firmas, outputs,
  `revalidatePath`, mapeo de `23505` a un mensaje legible en
  `submitAccountRequest`) (depende de T029)
- [X] T031 [P] [US3] Crear `src/components/account-requests/account-request-form.tsx`:
  formulario `react-hook-form` + `zodResolver(accountRequestSchema)` (T029),
  llama a `submitAccountRequest` (T030), muestra confirmación sin redirigir
  (depende de T029, T030)
- [X] T032 [US3] En `app/login/page.tsx`: renderizar
  `<AccountRequestForm />` (T031) debajo de `<LoginButton>` (depende de T031)
- [X] T033 [US3] Crear `src/components/auth/request-pending-screen.tsx`:
  mismo layout que `<NotAdminScreen>` pero con el mensaje "tu solicitud está
  pendiente"
- [X] T034 [US3] En `src/components/auth/not-admin-screen.tsx`: agregar un
  link a `/login` invitando a completar el formulario de solicitud (para el
  caso `requestStatus` `null`/`"rechazada"`)
- [X] T035 [US3] En `src/components/auth/admin-gate.tsx`: cuando
  `!isAdmin && !isEditor`, renderizar `<RequestPendingScreen>` (T033) si
  `requestStatus === "pendiente"`, si no `<NotAdminScreen>` (T034) (depende
  de T033, T034, y de T002/T004 de Foundational)
- [X] T036 [P] [US3] Crear `app/admin/solicitudes/page.tsx`: Server
  Component; llama `rpc("is_admin")` con el cliente de servidor y hace
  `redirect("/")` si es `false` (mismo criterio que el resto del proyecto:
  la Action/página da un buen mensaje temprano, RLS es la garantía real);
  trae las solicitudes pendientes y las cuentas `role='usuario'` activas
- [X] T037 [US3] Crear `src/components/account-requests/pending-requests-list.tsx`:
  lista de solicitudes pendientes con botones "Aprobar"/"Rechazar", llama a
  `approveRequest`/`rejectRequest` (T030) (depende de T030)
- [X] T038 [US3] Crear `src/components/account-requests/active-users-list.tsx`:
  lista de cuentas `role='usuario'` con botón "Revocar acceso", llama a
  `revokeUsuario` (T030) (depende de T030)
- [X] T039 [US3] En `app/admin/solicitudes/page.tsx`: renderizar
  `<PendingRequestsList>` (T037) y `<ActiveUsersList>` (T038) (depende de
  T036, T037, T038)
- [X] T040 [US3] En `app/auth/callback/route.ts`: agregar
  `await supabase.rpc("claim_approved_account")` inmediatamente después de
  `exchangeCodeForSession(code)` exitoso, antes del `redirect` (contracts/server-actions.md)

**Checkpoint**: Las tres historias funcionan de punta a punta, de forma
independiente entre sí.

---

## Phase 6: Polish & Cross-Cutting Concerns

- [X] T041 Actualizar la sección "Login de administradoras" de `CLAUDE.md`
  para documentar el rol Usuario (incluida su capacidad de crear/editar/
  eliminar sus propias mascotas Privadas), la tabla `app_users` (reemplaza a
  `admins`) y el flujo de solicitud/aprobación — Sync Impact Report ya
  registrado en `.specify/memory/constitution.md` (v1.2.0)
- [X] T042 Correr `npm run typecheck` y `npm run test` completos y confirmar
  que pasan, con los tipos regenerados tras aplicar T001
- [X] T043 Correr las validaciones manuales de `quickstart.md` (los 4
  escenarios) contra el proyecto de Supabase real, en 375px de ancho

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: Sin dependencias — puede empezar de inmediato.
- **Foundational (Phase 2)**: Depende de que el usuario haya aplicado T001,
  sembrado la cuenta de prueba `usuario` y corrido `npm run gen:types` —
  BLOQUEA las tres historias de usuario.
- **User Stories (Phase 3–5)**: Todas dependen solo de Foundational.
  US1 y US2 son mutuamente independientes. US3 no depende de US1/US2 en
  términos de datos (su propia porción del esquema ya existe desde T001),
  pero comparte archivos con Foundational (`admin-gate.tsx`) — ver abajo.
- **Polish (Phase 6)**: Depende de que las tres historias estén completas.

### User Story Dependencies

- **User Story 1 (P1)**: Puede empezar después de Foundational. Sin
  dependencia de US2/US3 — una cuenta Usuario dada de alta a mano (sin que
  exista todavía el flujo de solicitud) ya puede probarse completa.
- **User Story 2 (P2)**: Puede empezar después de Foundational. No depende
  de US1 para funcionar (el Historial registra acciones de cualquier cuenta
  editora, incluida una admin sola), aunque probarlo con dos cuentas
  distintas es más representativo si US1 ya está.
- **User Story 3 (P3)**: Puede empezar después de Foundational. T035 edita
  el mismo archivo que tocó T004 (Foundational) — no es un conflicto de
  historias entre sí, es una extensión secuencial del mismo archivo dentro
  de la misma rama de trabajo.

### Within Each User Story

- US1: T009 debe existir antes de T010/T011 (usan `<EditorOnly>`); T017/T018
  antes que T019 (que los importa y les pasa `visibility`); T019 antes que
  T020 (que le pasa la prop desde la página); T012–T016, T021, T022 son
  independientes entre sí y del resto.
- US2: T024 antes que T025 (el componente usa la función de datos); T025
  antes que T026 (la página importa el componente).
- US3: T029 antes que T030/T031; T030 antes que T031/T037/T038; T033/T034
  antes que T035; T036/T037/T038 antes que T039; T040 es independiente del
  resto (archivo propio).

### Parallel Opportunities

- T005, T006, T007, T008 (US1, tests) — archivos distintos, en paralelo.
- T010/T011 dependen de T009 pero son paralelos entre sí; T012, T013, T014,
  T015, T021 son independientes de T009–T011/T016–T020 y entre sí.
- T027, T028 (US3, tests) — archivos distintos, en paralelo.
- T029, T031 antes que el resto de US3, pero T029 en paralelo con T005–T008/
  T023/T027/T028 si se trabaja por fuera del orden de prioridad.
- Una vez completa Foundational, un desarrollador puede tomar US1, otro US2 y
  otro US3 en simultáneo (con la salvedad de T035/T004 sobre el mismo
  archivo, coordinable con un merge simple).

---

## Parallel Example: User Story 1

```bash
Task: "Extender tests/integration/rls-milestones-write.test.ts con la cuenta TEST_USER_EMAIL"
Task: "Extender tests/integration/rls-sightings-write.test.ts con la cuenta TEST_USER_EMAIL"
Task: "Reescribir tests/integration/rls-pets-write.test.ts con los casos de mascota propia/ajena/pública"
Task: "Crear tests/integration/rls-pet-photos-storage.test.ts"
Task: "Cambiar isAuthenticated por isEditor en src/components/empty-states.tsx"
Task: "Cambiar isAuthenticated por isEditor en src/components/pets/add-pet-button.tsx"
Task: "Cambiar isAdmin por isEditor en el filtro Tipo de src/components/pet-grid.tsx"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Completar Phase 1: Setup (T001) + Prerrequisitos manuales.
2. Completar Phase 2: Foundational (T002–T004).
3. Completar Phase 3: User Story 1 (T005–T022).
4. **Parar y validar**: Escenario 1 de `quickstart.md`.
5. El rol Usuario ya existe y funciona de punta a punta — seguimiento diario
   sobre mascotas públicas y gestión completa de sus propias privadas —
   aunque todavía no hay Historial ni flujo de solicitud (ambos se dan de
   alta a mano).

### Incremental Delivery

1. Setup + Foundational → sesión y gate listos para más de un rol.
2. User Story 1 → validar independientemente → rol Usuario funcional (MVP).
3. User Story 2 → validar independientemente → Historial visible para admin.
4. User Story 3 → validar independientemente → alta de cuentas Usuario sin
   tocar SQL a mano.
5. Polish → `CLAUDE.md`, typecheck/test completos, checklist final.

---

## Notes

- [P] tasks = archivos distintos, sin dependencias entre sí.
- [Story] mapea cada tarea a su historia de usuario para trazabilidad.
- No se toca `src/lib/actions/milestones.ts`/`sightings.ts` — el historial lo
  llenan los triggers de T001, ninguna Server Action existente necesita
  loguear nada a mano; `pets.ts` sí se toca (T022), pero solo para el
  hardening de detección de 0 filas, no para lógica de permisos nueva.
- Commitear después de cada tarea o grupo lógico (Setup, Foundational, US1,
  US2, US3, Polish).
