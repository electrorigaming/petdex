---

description: "Task list for feature implementation"
---

# Tasks: Campo Esterilizado y filtros de Estado/Esterilizado

**Input**: Design documents from `/specs/004-esterilizado-y-filtros/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/, quickstart.md — todos completos.

**Tests**: Se incluye un único archivo de test nuevo (`tests/unit/pet-filters.test.ts`)
para la lógica de combinación de filtros — es la única pieza de lógica no trivial
que agrega esta feature (research.md §4), en línea con el resto del repo, que
testea funciones puras (`dates.test.ts`, `slug.test.ts`, `streak.test.ts`). No se
agregan tests de Zod ni E2E nuevos: el resto de la feature reutiliza patrones ya
cubiertos (`tests/integration/rls-pets-write.test.ts` sigue siendo válido sin
cambios, research.md §2).

**Organization**: Las tareas están agrupadas por historia de usuario (spec.md)
para poder implementar y probar cada una de forma independiente.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Puede ejecutarse en paralelo (archivos distintos, sin dependencias entre sí)
- **[Story]**: A qué historia de usuario pertenece (US1, US2) — ausente en Setup/Foundational/Polish
- Cada tarea incluye la ruta de archivo exacta

## Prerrequisitos manuales (fuera de estas tareas)

Entre la Fase 1 y la Fase 2, fuera de este agente (Principio I — nunca con la
service role key):

1. Aplicar la migración de T001 con `supabase db push` (login propio del usuario).
2. Regenerar tipos: `npm run gen:types`.

Sin estos dos pasos, T002–T004 no van a tipar correctamente contra
`src/types/database.ts` y `npm run typecheck` va a fallar.

---

## Phase 1: Setup

**Purpose**: Migración de esquema — prerrequisito de todo lo demás

- [ ] T001 Crear `supabase/migrations/20260814120000_add_sterilized_to_pets.sql`
  con `alter table public.pets add column sterilized boolean not null default
  false;` seguido de `create or replace view public.pets_overview as` con la
  definición exacta de research.md §1 (misma lista de columnas y subconsultas
  ya existentes + `sterilized`)

**Checkpoint**: Migración lista para que el usuario la aplique (ver
Prerrequisitos manuales arriba). No se avanza a Phase 2 hasta que `npm run
gen:types` refleje la columna nueva.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Capa de datos compartida por ambas historias de usuario

**⚠️ CRITICAL**: Ninguna historia de usuario puede empezar hasta que esta fase esté completa

- [ ] T002 [P] Agregar `sterilized: z.boolean().default(false)` a
  `petFieldsSchema` en `src/lib/validation/pet-schema.ts` (sin `.optional()`,
  mismo criterio que `status` — data-model.md)
- [ ] T003 [P] En `src/lib/pets.ts`: sumar `status: PetStatus` y `sterilized:
  boolean` a `PetSummary`, sumar `sterilized: boolean` a `PetDetail`; actualizar
  `getPetSummaries()` para seleccionar `status, sterilized` de `pets_overview` y
  mapearlos; actualizar `getPetBySlug()` para seleccionar `sterilized` de `pets`
  y mapearlo (data-model.md)
- [ ] T004 [P] En `src/lib/actions/pets.ts`: pasar `sterilized: values.sterilized`
  en el `insert` de `createPet` y en el `update` de `updatePet` (contracts/mutations-delta.md)

**Checkpoint**: `npm run typecheck` pasa. La capa de datos expone `sterilized`
de punta a punta — las historias de usuario pueden empezar en paralelo.

---

## Phase 3: User Story 1 - Registrar si una mascota está esterilizada (Priority: P1) 🎯 MVP

**Goal**: Cargar/editar el campo Esterilizado desde el formulario de administración
y verlo reflejado en la ficha pública y en la tarjeta de la cuadrícula.

**Independent Test**: Con sesión activa, editar una mascota existente, marcar
"Esterilizado: Sí", guardar, y confirmar sin sesión que la ficha pública
(`/mascotas/{slug}`) muestra el badge y que su tarjeta en `/` lo indica; repetir
con "No" y confirmar que ambos desaparecen (quickstart.md, Escenarios 1–2).

### Implementation for User Story 1

- [ ] T005 [P] [US1] En `src/components/pets/pet-form.tsx`: agregar un campo
  "Esterilizado" con dos `<Radio>` (Sí/No), mismo patrón visual y de
  `Controller` que ya usa el campo "Estado"; default `false` en modo alta
  (spec.md FR-002)
- [ ] T006 [P] [US1] En `src/components/pet-detail.tsx`: agregar un
  `<Badge variant="outline">` para "Esterilizada"/"No esterilizada" junto al
  badge de Estado, visible siempre (spec.md FR-003)
- [ ] T007 [P] [US1] En `src/components/pet-card.tsx`: agregar un indicador
  (badge/ícono chico) que se muestra únicamente cuando `pet.sterilized ===
  true`, tanto en el overlay de la vista grid (esquina superior derecha,
  libre porque "Hoy"/"Ayer" usa la izquierda) como en la fila de la vista
  lista; no se muestra nada cuando es `false` (spec.md FR-004)

**Checkpoint**: User Story 1 funcional de punta a punta — el dato se carga,
persiste y se ve, con y sin sesión.

---

## Phase 4: User Story 2 - Filtrar el catálogo por Estado y Esterilizado (Priority: P2)

**Goal**: Panel de filtros colapsable en `/` con chips multi-select de Estado y
Esterilizado, combinados entre sí y con Zona/búsqueda ya existentes.

**Independent Test**: Con al menos dos mascotas con `status`/`sterilized`
distintos, abrir el panel "Filtros" en `/`, combinar chips de ambos grupos y
confirmar que la cuadrícula y el contador se actualizan sin recargar, incluido
el caso de cero resultados con la acción de limpiar todo (quickstart.md,
Escenario 3).

### Tests for User Story 2

- [ ] T008 [P] [US2] Crear `tests/unit/pet-filters.test.ts` con casos para
  `matchesFilters()` (T010): ningún filtro activo = todo pasa; un solo chip de
  Estado; dos chips de Estado (OR intra-grupo); Estado + Esterilizado
  combinados (AND entre-grupos); todos los chips de un grupo activos ==
  ninguno activo (spec.md Edge Cases)

### Implementation for User Story 2

- [ ] T009 [P] [US2] Crear `src/components/ui/filter-chip.tsx`: botón
  `aria-pressed` con la estética de `RadioChip` (borde/texto acento cuando
  está activo) para selección múltiple independiente (research.md §3)
- [ ] T010 [US2] Crear `src/lib/pet-filters.ts` con la función pura
  `matchesFilters(pet, filters)` descrita en research.md §4 (satisface T008)
- [ ] T011 [US2] En `src/components/pet-grid.tsx`: agregar estado local
  `PetFilters` (data-model.md), un botón "Filtros (N)" junto al `<Select>` de
  Zona que expande/colapsa un panel con los chips de Estado (4, usando T009) y
  Esterilizado (2, usando T009), y aplicar `matchesFilters` (T010) dentro del
  `useMemo` existente junto a los filtros de zona/búsqueda ya implementados
  (spec.md FR-005 a FR-010)
- [ ] T012 [US2] En `src/components/pet-grid.tsx`: extender `clearFilters()`
  para limpiar también Estado y Esterilizado, y confirmar que
  `<NoResultsState>` sigue disparándose correctamente cuando la combinación no
  arroja resultados (spec.md FR-011)

**Checkpoint**: Ambas historias funcionan de punta a punta, de forma
independiente entre sí.

---

## Phase 5: Polish & Cross-Cutting Concerns

- [ ] T013 Correr `npm run typecheck` y confirmar que pasa con los tipos
  regenerados
- [ ] T014 Correr las validaciones manuales de `quickstart.md` (Escenarios 1–4
  y checklist final de CLAUDE.md) de punta a punta y registrar el resultado

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
  dependencia de US2.
- **User Story 2 (P2)**: Puede empezar después de Foundational. No depende de
  US1 para funcionar (filtra sobre `status`/`sterilized`, que ya expone
  Foundational), aunque su valor práctico crece una vez que US1 permite cargar
  el dato.

### Within Each User Story

- US1: T005, T006 y T007 tocan archivos distintos sin dependencias entre sí — 100% paralelizables.
- US2: T008 y T009 son paralelizables entre sí; T010 debe existir para que T008 pase; T011 depende de T009 y T010; T012 depende de T011.

### Parallel Opportunities

- T002, T003, T004 (Foundational) — archivos distintos, en paralelo.
- T005, T006, T007 (US1) — archivos distintos, en paralelo.
- T008, T009 (US2) — archivos distintos, en paralelo.
- Una vez completa Foundational, un desarrollador puede tomar US1 y otro US2 en simultáneo.

---

## Parallel Example: Foundational

```bash
Task: "Agregar sterilized a petFieldsSchema en src/lib/validation/pet-schema.ts"
Task: "Sumar status/sterilized a PetSummary/PetDetail y sus queries en src/lib/pets.ts"
Task: "Pasar sterilized en createPet/updatePet en src/lib/actions/pets.ts"
```

## Parallel Example: User Story 1

```bash
Task: "Agregar campo Esterilizado (Sí/No) en src/components/pets/pet-form.tsx"
Task: "Agregar badge Esterilizada/o en src/components/pet-detail.tsx"
Task: "Agregar indicador condicional en src/components/pet-card.tsx"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Completar Phase 1: Setup (T001) + aplicar migración/gen:types (prerrequisito manual).
2. Completar Phase 2: Foundational (T002–T004).
3. Completar Phase 3: User Story 1 (T005–T007).
4. **Parar y validar**: Escenarios 1–2 de `quickstart.md`.
5. Esterilizado ya es cargable y visible — aunque todavía no filtrable.

### Incremental Delivery

1. Setup + Foundational → capa de datos lista.
2. User Story 1 → validar independientemente → el dato ya es útil (MVP).
3. User Story 2 → validar independientemente → el catálogo ya es filtrable.
4. Polish → checklist final de CLAUDE.md.

---

## Notes

- [P] tasks = archivos distintos, sin dependencias entre sí.
- [Story] mapea cada tarea a su historia de usuario para trazabilidad.
- No se toca RLS: la policy `pets_admin_write` ya cubre la columna nueva (research.md §2).
- Commitear después de cada tarea o grupo lógico (Foundational, US1, US2, Polish).
