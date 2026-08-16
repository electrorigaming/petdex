---

description: "Task list for feature implementation"
---

# Tasks: Campo Tipo (Privado/Público) y visibilidad por administradora

**Input**: Design documents from `/specs/005-tipo-privado-publico/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/, quickstart.md — todos completos.

**Tests**: Se incluyen dos archivos de test: uno de integración nuevo
(`tests/integration/rls-pets-visibility.test.ts`) porque la garantía central de
esta feature es una política RLS + un trigger, y la única forma real de probarlos
es contra Postgres (mismo criterio que `rls-pets-write.test.ts`/`rls-pets-insert.test.ts`
ya existentes); y una extensión del test puro ya existente
(`tests/unit/pet-filters.test.ts`) para el grupo `tipo` de `matchesFilters()`
(mismo criterio que 004-esterilizado-y-filtros).

**Organization**: Las tareas están agrupadas por historia de usuario (spec.md)
para poder implementar y probar cada una de forma independiente.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Puede ejecutarse en paralelo (archivos distintos, sin dependencias entre sí)
- **[Story]**: A qué historia de usuario pertenece (US1, US2) — ausente en Setup/Foundational/Polish
- Cada tarea incluye la ruta de archivo exacta

## Prerrequisitos manuales (fuera de estas tareas)

Entre la Fase 1 y la Fase 2, fuera de este agente (Principio I — nunca con la
service role key):

1. Aplicar la migración de T001: pegar el contenido completo de
   `supabase/migrations/20260815120000_add_visibility_to_pets.sql` en el SQL
   Editor del dashboard de Supabase y ejecutarlo — mismo criterio operativo
   que `petdex-schema.sql` original ("pegar completo en el SQL Editor del
   proyecto"), sin necesitar la CLI ni `supabase db push`.
2. Correr en el SQL Editor de Supabase y confirmar el resultado:
   ```sql
   select reloptions from pg_class where relname = 'pets_overview';
   -- esperado: {security_invoker=on}
   ```
   (T001 ya fuerza esta opción de forma idempotente, pero vale confirmarla —
   research.md §2.)
3. Regenerar tipos: `npm run gen:types`.
4. Para poder correr los Escenarios de `quickstart.md`, marcar a mano una
   mascota de prueba como privada vía SQL Editor:
   ```sql
   update public.pets set visibility = 'privado', created_by = '<uuid-admin-de-prueba>'
   where slug = '<slug-de-prueba>';
   ```

Sin los pasos 1–3, T002–T008 no van a tipar correctamente contra
`src/types/database.ts` y `npm run typecheck` va a fallar.

---

## Phase 1: Setup

**Purpose**: Migración de esquema — prerrequisito de todo lo demás

- [X] T001 Crear `supabase/migrations/20260815120000_add_visibility_to_pets.sql`
  con, en este orden (research.md §1–§4, SQL completo ahí):
  1. `alter table public.pets add column visibility text not null default 'publico' check (visibility in ('publico','privado'));`
  2. `alter table public.pets add column created_by uuid references auth.users(id) on delete set null;`
  3. `drop policy "pets_public_read" on public.pets;` y `drop policy "pets_admin_write" on public.pets;`,
     reemplazadas por `pets_select`, `pets_admin_insert`, `pets_admin_update`, `pets_admin_delete` (research.md §3)
  4. `create or replace function public.pets_lock_visibility() ...` + `create trigger pets_lock_visibility_trigger before update on public.pets ...` (research.md §3.1)
  5. `drop policy "milestones_public_read" on public.milestones;` → `milestones_select`;
     `drop policy "sightings_public_read" on public.sightings;` → `sightings_select` (research.md §4)
  6. Reemplazar `milestones_admin_write` y `sightings_admin_write` por las versiones con `exists(...)` de research.md §4
  7. `create or replace view public.pets_overview as ...` agregando `visibility` al final del `select` existente
  8. `alter view public.pets_overview set (security_invoker = on);` (guard explícito, research.md §2)

**Checkpoint**: Migración lista para que el usuario la aplique (ver
Prerrequisitos manuales arriba). No se avanza a Phase 2 hasta que `npm run
gen:types` refleje `visibility`/`created_by`.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Capa de datos compartida por ambas historias de usuario

**⚠️ CRITICAL**: Ninguna historia de usuario puede empezar hasta que esta fase esté completa

- [X] T002 [P] En `src/lib/validation/pet-schema.ts`: agregar
  `PET_VISIBILITY_OPTIONS = ["publico", "privado"] as const`, el tipo
  `PetVisibility`, y `PET_VISIBILITY_LABEL` (`publico: "Público"`,
  `privado: "Privado"`) — **no** agregar `visibility` a `petFieldsSchema` ni a
  `createPetSchema`/`updatePetSchema` (FR-003, data-model.md)
- [X] T003 [P] En `src/lib/pets.ts`: sumar `visibility: PetVisibility` a
  `PetSummary`; actualizar `getPetSummaries()` para seleccionar `visibility`
  de `pets_overview` y mapearlo — **no** tocar `PetDetail`/`getPetBySlug()`
  (el indicador es solo de tarjeta de cuadrícula, data-model.md)

**Checkpoint**: `npm run typecheck` pasa. `PetSummary.visibility` disponible
de punta a punta — las historias de usuario pueden empezar en paralelo.

---

## Phase 3: User Story 1 - Un registro Privado queda invisible para todos salvo su creadora (Priority: P1) 🎯 MVP

**Goal**: La garantía real de la feature — RLS + trigger deciden qué fila
llega a quién, con o sin pasar por la interfaz.

**Independent Test**: Con una mascota marcada a mano como privada (Prerrequisitos
manuales, paso 4), confirmar que su cuenta dueña la ve en la cuadrícula y en su
ficha; que sin sesión y con la sesión de otra admin no aparece en ninguna de
las dos, ni sus hitos/avistamientos; y que ni siquiera otra admin puede
editarla, borrarla, o convertirla en privada apropiándosela (quickstart.md,
Escenarios 1–2).

### Tests for User Story 1

- [X] T004 [P] [US1] Crear `tests/integration/rls-pets-visibility.test.ts`
  con, usando el mismo patrón de cliente `anon`/`admin` real que
  `rls-pets-write.test.ts` (research.md §5, sin necesitar una segunda cuenta
  de Google ni dejar filas huérfanas):
  - Insertar una mascota `visibility='privado'` con `created_by` = el propio
    `auth.uid()` de la única cuenta de test → esa misma sesión puede
    `select`/`update`(un campo normal, no `visibility`/`created_by`)/`delete`la
  - Insertar un hito y un avistamiento (`rpc('mark_sighting', ...)`) para esa
    misma mascota privada → la sesión dueña los lee sin problema
  - Con un cliente `anon` (sin sesión): `select` sobre esa mascota devuelve
    `[]`; `select` sobre su hito/avistamiento por `pet_id` también devuelve
    `[]`; intentar `mark_sighting` sobre ese `pet_id` falla (`42501`) — esto
    prueba la denegación también para "otra cuenta administradora" por el
    argumento de equivalencia de research.md §5 (ninguna policy involucrada
    distingue anon de una admin no-dueña, ambas fallan la misma comparación
    de `created_by = auth.uid()`)
  - Insertar una mascota **pública propia** (mismo `created_by` que la
    cuenta de test — `created_by` tiene FK a `auth.users`, no acepta un
    UUID inventado, research.md §5 nota post-implementación) e intentar
    `update pets set visibility='privado'` desde esa misma sesión → debe
    fallar (bloqueado por `pets_lock_visibility_trigger`, research.md §3.1) —
    prueba que FR-003 se sostiene a nivel de base incluso para la propia
    dueña, no solo por la ausencia de un control en el formulario; limpiar
    la fila al final (sigue pública, sin problema de ownership para el
    `delete`)

### Implementation for User Story 1

- [X] T005 [P] [US1] En `src/components/pet-card.tsx`: agregar un indicador
  "Privado" (badge con ícono de candado, `<Badge variant="neutral">`, mismo
  tratamiento que el de Esterilizado) que se muestra únicamente cuando
  `pet.visibility === "privado"`, tanto en overlay de vista grid como inline
  en vista lista; no ocupa espacio cuando es `"publico"` (spec.md FR-013)

**Checkpoint**: User Story 1 funcional de punta a punta — la visibilidad,
edición y borrado quedan gobernados por RLS/trigger, con el indicador visual
para la dueña.

---

## Phase 4: User Story 2 - Filtrar el catálogo por Tipo (Priority: P2)

**Goal**: Un tercer grupo de chips "Tipo" (Privado/Público) en el panel de
Filtros ya existente, visible solo con sesión administradora.

**Independent Test**: Con sesión administradora activa y al menos una mascota
propia privada y una pública visibles, abrir "Filtros", activar el chip
"Privado", y confirmar que la cuadrícula y el contador se actualizan sin
recargar; confirmar además que sin sesión el grupo "Tipo" no aparece
(quickstart.md, Escenario 3).

### Tests for User Story 2

- [X] T006 [US2] En `tests/unit/pet-filters.test.ts`: agregar casos para el
  grupo `tipo` de `matchesFilters()` (T007): ningún chip de tipo activo =
  todo pasa; solo `"privado"` activo; `"privado"` + `"publico"` activos (OR
  intra-grupo, equivalente a ninguno activo); combinado con un chip de Estado
  (AND entre-grupos) — depende de que T007 exista para pasar

### Implementation for User Story 2

- [X] T007 [US2] En `src/lib/pet-filters.ts`: sumar `tipo: PetVisibility[]` a
  `PetFilters`, extender `EMPTY_PET_FILTERS`, sumar la condición
  `filters.tipo.length === 0 || filters.tipo.includes(pet.visibility)` (AND)
  dentro de `matchesFilters()`, y sumar `filters.tipo.length` a
  `countActiveFilters()` (data-model.md)
- [X] T008 [US2] En `src/components/pet-grid.tsx`: agregar un tercer grupo de
  chips "Tipo" (Privado/Público) dentro del panel de Filtros ya existente,
  usando `toggleTipo()` con el mismo patrón que `toggleEsterilizado()`;
  renderizar el grupo únicamente cuando `useSession().isAdmin === true`
  (importar `useSession` de `@/hooks/use-session`); extender `clearFilters()`
  para resetear también `tipo` (spec.md FR-010 a FR-012)

**Checkpoint**: Ambas historias funcionan de punta a punta, de forma
independiente entre sí.

---

## Phase 5: Polish & Cross-Cutting Concerns

- [X] T009 Correr `npm run typecheck` y confirmar que pasa con los tipos
  regenerados — usuario aplicó la migración pegándola en el SQL Editor de
  Supabase (en vez de `supabase db push`, mismo criterio operativo que
  `petdex-schema.sql` original); `npm run gen:types` + `npm run typecheck`
  pasan limpio. `npm run test` completo también pasa: 86/86 (16 archivos),
  incluidos los 4 tests nuevos de `rls-pets-visibility.test.ts` — encontró y
  corrigió en el camino un bug real del test (no de la migración):
  `created_by` tiene FK a `auth.users(id)`, así que un `crypto.randomUUID()`
  inventado para simular "otra admin" viola la FK (`23503`) antes de llegar
  a RLS; el caso del trigger se rehízo sobre una mascota pública propia en
  vez de una con dueño ajeno inventado (research.md §5, nota
  post-implementación)
- [X] T010 Correr las validaciones manuales de `quickstart.md` — verificado
  en el navegador (`npm run dev`, login vía `/test/login` con la cuenta de
  test) contra el proyecto de Supabase real:
  - Escenario 1/RLS: mascota marcada `privado` (insertada vía API con la
    sesión admin, ya que el formulario no expone Tipo) visible para su
    dueña logueada; al cerrar sesión, el contador vuelve de 3 a 2 y la
    mascota desaparece por completo de la cuadrícula
  - Escenario 3 (filtro): sin sesión, el panel de Filtros muestra solo
    Estado/Esterilizado, sin el grupo Tipo; con sesión admin aparece el
    grupo Tipo (Público/Privado); activar "Privado" acota correctamente a 0
    resultados (no había otras privadas) con el contador "Filtros (1)"
  - Escenario 4 (indicador visual): badge con ícono de candado visible en
    la tarjeta de la mascota privada, tanto en vista grid (esquina superior
    derecha) como en vista lista (junto al nombre)
  - No se probó con una segunda cuenta administradora real (decisión de
    research.md §5) — la denegación para "otra admin" queda cubierta por el
    test automatizado de T004 vía el argumento de equivalencia con `anon`,
    no por una segunda sesión real en el navegador
  - Mascota de prueba borrada al terminar; sin datos de prueba persistentes

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: Sin dependencias — puede empezar de inmediato.
- **Foundational (Phase 2)**: Depende de que el usuario haya aplicado T001 y
  corrido `npm run gen:types` — BLOQUEA ambas historias de usuario.
- **User Stories (Phase 3–4)**: Ambas dependen solo de Foundational, no entre
  sí — pueden implementarse en paralelo o en orden de prioridad (US1 → US2).
- **Polish (Phase 5)**: Depende de que ambas historias estén completas.

### User Story Dependencies

- **User Story 1 (P1)**: Puede empezar después de Foundational. Sin
  dependencia de US2 — es la garantía de datos, no necesita el filtro para
  funcionar ni para probarse.
- **User Story 2 (P2)**: Puede empezar después de Foundational. Depende de
  `PetSummary.visibility` (T003) para tener algo que filtrar, pero no de
  ningún artefacto de US1 (el badge de T005 es independiente del filtro).

### Within Each User Story

- US1: T004 (test) y T005 (badge) tocan archivos distintos y no dependen
  entre sí — paralelizables.
- US2: T007 debe existir antes de que T006 pueda pasar (aunque ambas tareas
  se listan por separado, no son [P] entre sí); T008 depende de T007.

### Parallel Opportunities

- T002, T003 (Foundational) — archivos distintos, en paralelo.
- T004, T005 (US1) — archivos distintos, en paralelo.
- Una vez completa Foundational, un desarrollador puede tomar US1 y otro US2 en simultáneo.

---

## Parallel Example: Foundational

```bash
Task: "Agregar PET_VISIBILITY_OPTIONS/PET_VISIBILITY_LABEL en src/lib/validation/pet-schema.ts"
Task: "Sumar visibility a PetSummary y al select de getPetSummaries() en src/lib/pets.ts"
```

## Parallel Example: User Story 1

```bash
Task: "Crear tests/integration/rls-pets-visibility.test.ts"
Task: "Agregar indicador Privado en src/components/pet-card.tsx"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Completar Phase 1: Setup (T001) + aplicar migración/gen:types (prerrequisito manual).
2. Completar Phase 2: Foundational (T002–T003).
3. Completar Phase 3: User Story 1 (T004–T005).
4. **Parar y validar**: Escenarios 1–2 y 5 de `quickstart.md`.
5. La garantía de visibilidad ya está completa y probada — aunque todavía no hay forma de filtrar por Tipo desde la UI.

### Incremental Delivery

1. Setup + Foundational → capa de datos lista.
2. User Story 1 → validar independientemente → la garantía real ya existe (MVP).
3. User Story 2 → validar independientemente → el catálogo ya es filtrable por Tipo.
4. Polish → checklist final de CLAUDE.md.

---

## Notes

- [P] tasks = archivos distintos, sin dependencias entre sí.
- [Story] mapea cada tarea a su historia de usuario para trazabilidad.
- No se toca `pet-form.tsx` ni `src/lib/actions/pets.ts` — el campo Tipo nunca
  viaja en ningún payload de la app (FR-003).
- Commitear después de cada tarea o grupo lógico (Setup, Foundational, US1, US2, Polish).
