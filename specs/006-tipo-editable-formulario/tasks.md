---

description: "Task list for feature implementation"
---

# Tasks: Tipo editable desde el formulario

**Input**: Design documents from `/specs/006-tipo-editable-formulario/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/, quickstart.md — todos completos.

**Tests**: Se modifica `tests/integration/rls-pets-visibility.test.ts`: se
borra el test que asumía el trigger (`pets_lock_visibility_trigger`, ahora
eliminado) y se agregan los casos correctos de research.md §7 —
`created_by: null` en vez de un UUID inventado, que fallaría por FK antes
de llegar a RLS (mismo error que ya se encontró y corrigió en
`005-tipo-privado-publico`).

**Organization**: Una sola historia de usuario (spec.md solo define P1) —
Setup y Foundational preparan la capa de datos, User Story 1 agrega la UI y
las pruebas.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Puede ejecutarse en paralelo (archivos distintos, sin dependencias entre sí)
- **[Story]**: A qué historia de usuario pertenece (US1) — ausente en Setup/Foundational/Polish
- Cada tarea incluye la ruta de archivo exacta

## Prerrequisitos manuales (fuera de estas tareas)

Entre la Fase 1 y la Fase 2, fuera de este agente (Principio I — nunca con
la service role key): aplicar la migración de T001 pegándola en el SQL
Editor del dashboard de Supabase (mismo criterio operativo que
`005-tipo-privado-publico`), y correr `npm run gen:types`. Esta migración no
agrega columnas — `npm run gen:types` no debería cambiar `database.ts`, pero
se corre igual para confirmar que nada se rompió.

---

## Phase 1: Setup

**Purpose**: Migración de esquema — elimina el trigger, endurece el insert

- [X] T001 Crear `supabase/migrations/20260816120000_make_visibility_editable.sql`
  con, en este orden (research.md §1 y §3, SQL completo ahí):
  1. `drop trigger pets_lock_visibility_trigger on public.pets;`
  2. `drop function public.pets_lock_visibility();`
  3. `drop policy "pets_admin_insert" on public.pets;` → recrear con
     `with check (public.is_admin() and (visibility = 'publico' or created_by = auth.uid()))`
  4. **No tocar** `pets_admin_update` — ya tiene exactamente esa condición desde 005 (research.md §2)

**Checkpoint**: Migración lista para que el usuario la aplique (ver
Prerrequisitos manuales arriba).

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Capa de datos que la UI de User Story 1 necesita

**⚠️ CRITICAL**: User Story 1 no puede empezar hasta que esta fase esté completa

- [X] T002 [P] En `src/lib/validation/pet-schema.ts`: agregar
  `visibility: z.enum(PET_VISIBILITY_OPTIONS).default("publico")` a
  `petFieldsSchema` (reutiliza `PET_VISIBILITY_OPTIONS`, ya definido en
  005 — no crear un enum nuevo, data-model.md)
- [X] T003 [P] En `src/lib/pets.ts`: sumar `visibility: PetVisibility` a
  `PetDetail`; actualizar `getPetBySlug()` para seleccionar `visibility` de
  `pets` y mapearlo (data-model.md §6)
- [X] T004 [P] En `src/lib/actions/pets.ts`: en `createPet` y `updatePet`,
  agregar al payload de `insert`/`update`:
  `visibility: values.visibility, created_by: values.visibility === "privado" ? user.id : null`
  — sin leer ningún valor previo de la fila, se recalcula en cada guardado
  (research.md §4, contracts/mutations-delta.md)

**Checkpoint**: `npm run typecheck` pasa. El formulario ya puede leer/enviar
`visibility` de punta a punta.

---

## Phase 3: User Story 1 - Marcar una mascota como Privada al cargarla o editarla (Priority: P1) 🎯 MVP

**Goal**: El campo Tipo aparece en el formulario de alta/edición y hace
efecto real (RLS ya lo garantiza desde Foundational).

**Independent Test**: Con sesión activa, crear una mascota marcada Privada,
confirmar que desaparece de la cuadrícula sin esa sesión; editarla de vuelta
a Público y confirmar que reaparece (quickstart.md, Escenarios 1–2).

### Tests for User Story 1

- [X] T005 [US1] En `tests/integration/rls-pets-visibility.test.ts`:
  - **Borrar** el test `"el Tipo no se puede cambiar desde la app, ni
    siquiera por la dueña de la fila"` (asumía
    `pets_lock_visibility_trigger`, que ya no existe — ese test ahora
    describiría lo contrario del comportamiento correcto)
  - **Agregar**: insertar una mascota pública propia, actualizarla a
    `visibility: "privado", created_by: <propio auth.uid()>` → éxito, y la
    fila deja de ser visible para `anon` (FR-004)
  - **Agregar**: sobre esa misma mascota ya privada, intentar
    `update({ visibility: "privado", created_by: null })` → falla (0 filas /
    error), prueba FR-006 sin necesitar un UUID inventado ajeno (research.md
    §7 — un UUID inventado fallaría por la FK a `auth.users`, no por RLS)
  - **Agregar**: actualizar de vuelta a `visibility: "publico"` → éxito,
    vuelve a ser visible para `anon` (FR-005)

### Implementation for User Story 1

- [X] T006 [US1] En `src/components/pets/pet-form.tsx`: agregar un campo
  "Tipo" con dos `<Radio>` (Público/Privado) usando
  `PET_VISIBILITY_OPTIONS`/`PET_VISIBILITY_LABEL`, mismo patrón visual y de
  `Controller` que ya usan "Estado" y "Esterilizado"; default `"publico"`
  en modo alta (spec.md FR-001, FR-002)
- [X] T007 [US1] En `app/mascotas/[slug]/editar/page.tsx`: sumar
  `visibility: pet.visibility` a `initialValues` (depende de T003)

**Checkpoint**: User Story 1 funcional de punta a punta — Tipo se carga,
persiste, y hace efecto real en la visibilidad.

---

## Phase 4: Polish & Cross-Cutting Concerns

- [X] T008 Anotar como "superseded por 006-tipo-editable-formulario" los
  cuatro lugares de `005-tipo-privado-publico` que describían el trigger
  eliminado como vigente (`research.md §3.1`, `data-model.md`,
  `contracts/rls-policies.md`, `quickstart.md` Escenario 2 paso 3), y la
  última línea de `docs/agregar-cuenta-admin.md` que decía que Tipo no se
  editaba desde ningún formulario — hecho durante el diseño, antes de este
  desglose de tareas, a pedido de la revisión previa a implementar
- [X] T009 Correr `npm run typecheck` y confirmar que pasa — pasa limpio
  (sin cambios de columnas, como se esperaba)
- [X] T010 Correr `npm run test` (suite completa) y confirmar que pasa —
  88/88, incluidos los 6 tests de `rls-pets-visibility.test.ts`. En el
  camino se encontró y corrigió un error real en el diseño del test de
  FR-006: un `WITH CHECK` que falla sobre una fila que SÍ pasó `USING`
  produce un error explícito de Postgres (`42501`), no una selección vacía
  como un `USING` que oculta filas — la primera versión del test asumía lo
  segundo (research.md §7, actualizado)
- [X] T011 Correr las validaciones de `quickstart.md` contra el proyecto de
  Supabase real y en el navegador (login vía `/test/login`):
  - Escenario 1: el campo Tipo aparece en `/mascotas/nueva`, default
    Público; se creó una mascota marcada Privada → sin sesión, su ficha da
    404 ("Esta mascota no está en PetDex")
  - Escenario 2: se editó esa misma mascota de vuelta a Público → sin
    sesión, la ficha vuelve a cargar con normalidad
  - El formulario de edición precargó "Privado" correctamente al abrir
    (confirma T007)
  - Escenario 3 (necesita 2 cuentas admin reales): no se corrió — solo hay
    una cuenta de test disponible, igual que ya se documentó como
    limitación aceptada en research.md §7
  - Escenario 4: cubierto por el test automatizado de T005 (FR-006)
  - Mascota de prueba borrada al terminar; sin datos de prueba
    persistentes

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: Sin dependencias — puede empezar de inmediato.
- **Foundational (Phase 2)**: Depende de que el usuario haya aplicado T001
  — BLOQUEA User Story 1.
- **User Story 1 (Phase 3)**: Depende solo de Foundational.
- **Polish (Phase 4)**: Depende de que User Story 1 esté completa.

### Within Phases

- Foundational: T002, T003, T004 tocan archivos distintos — 100% paralelizables.
- US1: T005 (tests) y T006 (form) son independientes entre sí; T007 depende de T003 (Foundational) pero no de T006.

### Parallel Opportunities

- T002, T003, T004 (Foundational) — archivos distintos, en paralelo.
- T005, T006, T007 (US1) — archivos distintos, en paralelo (T007 solo necesita que Foundational ya esté completa).

---

## Parallel Example: Foundational

```bash
Task: "Agregar visibility a petFieldsSchema en src/lib/validation/pet-schema.ts"
Task: "Sumar visibility a PetDetail y al select de getPetBySlug() en src/lib/pets.ts"
Task: "Pasar visibility/created_by en createPet/updatePet en src/lib/actions/pets.ts"
```

## Parallel Example: User Story 1

```bash
Task: "Actualizar tests/integration/rls-pets-visibility.test.ts (borrar test del trigger, agregar casos nuevos)"
Task: "Agregar campo Tipo (Público/Privado) en src/components/pets/pet-form.tsx"
Task: "Sumar visibility a initialValues en app/mascotas/[slug]/editar/page.tsx"
```

---

## Implementation Strategy

### MVP First (única historia)

1. Completar Phase 1: Setup (T001) + aplicar migración/gen:types (prerrequisito manual).
2. Completar Phase 2: Foundational (T002–T004).
3. Completar Phase 3: User Story 1 (T005–T007).
4. **Parar y validar**: Escenarios 1, 2 y 4 de `quickstart.md`.
5. Polish (T009–T011).

---

## Notes

- [P] tasks = archivos distintos, sin dependencias entre sí.
- No se toca `pet-card.tsx`, `pet-grid.tsx`, `pet-filters.ts` ni
  `pet-detail.tsx` — su comportamiento no cambia (data-model.md).
- Commitear después de cada fase lógica (Setup, Foundational, US1, Polish).
