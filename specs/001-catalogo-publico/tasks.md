---

description: "Task list template for feature implementation"
---

# Tasks: Catálogo público

**Input**: Design documents from `/specs/001-catalogo-publico/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/page-data-contracts.md, quickstart.md

**Tests**: Solo se incluyen los tests pedidos explícitamente en `/speckit.plan`: normalización de acentos, orden de la timeline de hitos, y el test de integración que confirma que un `insert` en `pets` con la anon key falla. No se agregan tests adicionales.

**Organization**: Tareas agrupadas por historia de usuario (spec.md) para poder implementar y probar cada una de forma independiente.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Puede ejecutarse en paralelo (archivo distinto, sin dependencias pendientes)
- **[Story]**: Historia de usuario a la que pertenece (US1, US2, US3)
- Cada tarea incluye la ruta de archivo exacta

## Path Conventions

Proyecto único de Next.js App Router (ver `plan.md` → Project Structure):
`app/` para rutas, `src/lib/` para acceso a datos y utilidades, `src/components/`
para UI, `tests/unit/` y `tests/integration/` para los tests pedidos.

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Scaffolding del proyecto Next.js — el repo hoy no tiene `package.json`.

- [X] T001 Crear `package.json` en la raíz con scripts `dev`, `build`, `start`, `typecheck`, `lint`, `test`, `gen:types` y dependencias `next`, `react`, `react-dom`, `typescript`, `tailwindcss`, `@supabase/ssr`, `@supabase/supabase-js`, `lucide-react`, `vitest` (según `plan.md` → Technical Context)
- [X] T002 [P] Crear `next.config.ts` con `images.remotePatterns` apuntando al hostname del proyecto Supabase (`owfxiyhqnkuquagsxbid.supabase.co`) para servir `pets.photo_url` con `next/image` (Principio IV)
- [X] T003 [P] Crear `tsconfig.json` en modo `strict` con alias `@/*` → `src/*`
- [X] T004 [P] Crear `tailwind.config.ts` y `postcss.config.js` cargando los tokens de color/espaciado/tipografía de `design-system/MASTER.md`
- [X] T005 Inicializar shadcn/ui (`components.json`) e instalar los componentes `card`, `badge`, `input`, `select`, `button`, `skeleton` (depende de T004; ver `research.md` §7)
- [X] T006 [P] Crear `vitest.config.ts` apuntando a `tests/unit/**` y `tests/integration/**`
- [X] T007 Crear `app/globals.css` importando Tailwind y declarando las CSS variables de `design-system/MASTER.md` (paleta, `--text-*`, `--space-*`) (depende de T004)
- [X] T008 Crear `app/layout.tsx` raíz mínimo: `<html>`/`<body>`, fuente Inter, metadata básica — sin lógica de preferencia de vista todavía (depende de T007)

**Checkpoint**: `npm run dev` levanta una página en blanco sin errores de build.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Lo que las tres historias necesitan antes de poder implementarse.

**⚠️ CRITICAL**: Según el comentario del propio esquema (`petdex-schema.sql`): "Verificá RLS... si no falla, no sigas construyendo encima". T010 es un gate, no una tarea opcional.

- [X] T009 [P] Crear `src/lib/supabase/server.ts`: factory del cliente Supabase para Server Components usando `@supabase/ssr` y la anon key (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`) — único cliente que esta feature necesita (Principio I)
- [X] T010 [P] Crear `tests/integration/rls-pets-insert.test.ts`: usar la anon key para intentar un `insert` en `pets` y afirmar que falla por política RLS (research.md §6) — correr y confirmar que efectivamente falla antes de seguir

**Checkpoint**: Fundación lista — las historias de usuario pueden empezar.

---

## Phase 3: User Story 1 - Explorar el catálogo de mascotas (Priority: P1) 🎯 MVP

**Goal**: Contador destacado + cuadrícula/lista de mascotas alternable, con la preferencia de vista persistida entre visitas, y estado vacío cuando no hay mascotas.

**Independent Test**: Entrar a `/` con datos de prueba cargados; el contador coincide con la cantidad real, aparece una tarjeta por mascota, y el alternador de vista cambia la presentación y persiste tras recargar.

### Implementation for User Story 1

- [X] T011 [P] [US1] Implementar `getPetSummaries()` y `getPetCount()` en `src/lib/pets.ts`: la primera consulta `pets_overview` seleccionando `slug, name, nicknames, photo_url, zone`; la segunda un `count` aparte con `head: true` sobre la misma vista — nunca tablas base ni `data.length` (contracts/page-data-contracts.md, constitución "Cuadrícula")
- [X] T012 [P] [US1] Crear `src/components/pet-card.tsx`: toda la tarjeta envuelta en `next/link` hacia `/mascotas/${pet.slug}` (SC-004 — es como se llega a la ficha desde la cuadrícula), foto con `next/image` o placeholder (`ImageOff` de Lucide) del mismo `aspect-ratio`, nombre, zona con ícono `MapPin` (design-system/MASTER.md)
- [X] T013 [P] [US1] Crear `src/components/view-toggle.tsx` (Client Component): botones con íconos `LayoutGrid`/`List`, lee y escribe `localStorage['petdex:view']`
- [X] T014 [P] [US1] Crear `src/components/empty-states.tsx` con el estado vacío general (FR-009): título "Todavía no hay mascotas registradas" + cuerpo, sin ícono decorativo (design-system/MASTER.md)
- [X] T015 [US1] Agregar a `app/layout.tsx` el script inline anti-flash que lee `localStorage.getItem('petdex:view')` y aplica `data-view` en `<html>` antes de la hidratación (research.md §3) (depende de T008, T013)
- [X] T016 [US1] Crear `src/components/pet-grid.tsx` (Client Component): recibe `pets`/`total`, renderiza cuadrícula (1 col en 375px, 2 en 768px, 3 en 1024px, 4 en 1440px) o lista compacta según `data-view`, usando `<PetCard>` y `<ViewToggle>` (depende de T011, T012, T013)
- [X] T017 [US1] Implementar `app/page.tsx` (Server Component): llama a `getPetSummaries()`/`getPetCount()`, renderiza `<EmptyState>` si `total === 0` o `<PetGrid>` en caso contrario (depende de T009, T011, T014, T016)

**Checkpoint**: User Story 1 funcional y testeable de forma independiente — MVP entregable.

---

## Phase 4: User Story 2 - Ver la ficha completa de una mascota (Priority: P2)

**Goal**: Ficha por slug con foto grande, datos condicionales (se omiten los vacíos) y línea de tiempo de hitos invertible; 404 propio si el slug no existe.

**Independent Test**: Entrar directo a la URL de una mascota existente (sin pasar por `/`); los campos con datos se muestran, los vacíos se omiten, y la timeline funciona con cero, uno o varios hitos.

### Tests for User Story 2 ⚠️

> Escribir primero, confirmar que falla antes de implementar T019.

- [X] T018 [P] [US2] Crear `tests/unit/milestone-order.test.ts`: verifica que una lista de hitos se ordena de más reciente a más antigua por defecto, y que invertir el orden la deja de más antigua a más reciente

### Implementation for User Story 2

- [X] T019 [US2] Implementar `sortMilestones(milestones, direction)` en `src/lib/milestones.ts` — función pura, hace pasar T018
- [X] T020 [P] [US2] Agregar a `src/lib/pets.ts`: `getPetBySlug(slug)` (consulta `pets` por `slug`, incluye `id` para la siguiente función), `getMilestonesForPet(petId)` (consulta `milestones` por `pet_id` ordenada `occurred_on desc`), y `getAllPetSlugs()` para `generateStaticParams` (contracts/page-data-contracts.md Pantalla B)
- [X] T021 [P] [US2] Crear `src/components/milestone-timeline.tsx`: usa `sortMilestones`, botón con ícono `ArrowUpDown` para invertir el orden, badge de categoría (solo texto, sin color por categoría — design-system/MASTER.md), omite `category`/`note` cuando son `null` (depende de T019)
- [X] T022 [P] [US2] Crear `src/components/pet-detail.tsx`: foto grande o placeholder, nombre, apodos, zona, ubicación, fecha de registro, edad estimada, peso, descripción — cada campo `null` se omite por completo, nunca "sin datos" (FR-013, data-model.md)
- [X] T023 [US2] Implementar `app/mascotas/[slug]/page.tsx` (Server Component): `generateStaticParams` desde `getAllPetSlugs()`, `export const dynamicParams = true`, `export const revalidate = 0`, llama `notFound()` si `getPetBySlug` no devuelve fila, renderiza `<PetDetail>` + `<MilestoneTimeline>` (research.md §4; depende de T009, T020, T021, T022)
- [X] T024 [P] [US2] Crear `app/mascotas/[slug]/not-found.tsx`: 404 propio de PetDex para slug inexistente (FR-017)

**Checkpoint**: User Stories 1 y 2 funcionan de forma independiente y en conjunto.

---

## Phase 5: User Story 3 - Buscar y filtrar dentro del catálogo (Priority: P3)

**Goal**: Búsqueda por nombre/apodo normalizada (sin distinguir mayúsculas ni acentos) y filtro de zona, ambos client-side sobre los datos ya cargados; estado "sin resultados" distinto del estado vacío.

**Independent Test**: Con el catálogo ya cargado, buscar un nombre existente escrito sin acentos ni mayúsculas coincidentes y verificar que aparece; buscar un texto sin coincidencias y verificar el estado "sin resultados" (distinto del vacío de US1).

### Tests for User Story 3 ⚠️

> Escribir primero, confirmar que falla antes de implementar T026.

- [X] T025 [P] [US3] Crear `tests/unit/normalize.test.ts`: verifica que nombres con mayúsculas/acentos distintos (ej. "Ñandú" vs "nandu") normalizan al mismo valor

### Implementation for User Story 3

- [X] T026 [US3] Implementar `normalizeSearchText(s)` en `src/lib/search.ts` usando `s.normalize('NFD').replace(/\p{Diacritic}/gu,'').toLowerCase()` — hace pasar T025
- [X] T027 [US3] Agregar a `src/components/pet-grid.tsx` el buscador (`Input` + ícono `Search`) filtrando `pets` en memoria con `normalizeSearchText` sobre `name`/`nicknames`, y el filtro de zona (`Select`) con opciones derivadas de `[...new Set(pets.map(p => p.zone).filter(Boolean))]` (research.md §2; depende de T016, T026)
- [X] T028 [US3] Ampliar `src/components/empty-states.tsx` con el estado "sin resultados" (FR-010): título "Sin resultados para tu búsqueda" + sugerencia, ícono `Search` atenuado — visualmente distinto del estado vacío de T014 (depende de T014)
- [X] T029 [US3] Conectar en `pet-grid.tsx` la combinación búsqueda + filtro de zona (AND, FR-008) y decidir entre mostrar resultados o el estado "sin resultados" de T028 (depende de T027, T028)

**Checkpoint**: Las tres historias de usuario funcionan de forma independiente y en conjunto — feature completa.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Cierre transversal, no específico de ninguna historia.

- [X] T030 [P] Crear `app/not-found.tsx` raíz: 404 propio de PetDex como fallback para cualquier URL fuera de las rutas de esta feature
- [X] T031 [P] Ejecutar `npm run gen:types` y confirmar que `src/types/database.ts` no cambia (Principio V — el esquema no se tocó en esta feature)
- [X] T032 Revisar toda la UI construida contra el checklist de `design-system/MASTER.md` (contraste 4.5:1, foco visible, `prefers-reduced-motion`, cero emojis como ícono)
- [X] T033 Ejecutar los cinco bloques de validación manual de `quickstart.md` de punta a punta y confirmar el checklist de "tarea terminada" de `CLAUDE.md` (incluye repetir a mano la verificación de RLS) — validado en el navegador con datos de prueba reales: contador correcto, placeholder de foto, búsqueda normalizada (Ñandú/nandu), estado "sin resultados" distinto del vacío, filtro de zona (Radix Select), toggle grid/lista con persistencia sin flash, ficha con campos condicionales (omitidos si `null`), timeline de hitos ordenable, estado sin hitos, 404 propio de mascota y 404 raíz, y RLS (T010) contra el proyecto real con código `42501`.
- [X] T034 Correr `npm run typecheck` y `npm run test` sin errores

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: sin dependencias — arranca de inmediato
- **Foundational (Phase 2)**: depende de Setup — bloquea las tres historias
- **User Stories (Phase 3-5)**: dependen de Foundational; US2 y US3 además dependen de archivos creados en US1 (`pets.ts`, `pet-grid.tsx`) por lo que en la práctica conviene el orden P1 → P2 → P3, aunque cada una tiene su propio checkpoint de prueba independiente
- **Polish (Phase 6)**: depende de que las historias que se vayan a entregar estén completas

### User Story Dependencies

- **US1 (P1)**: sin dependencia de otra historia
- **US2 (P2)**: extiende `src/lib/pets.ts` creado en US1 (T020 agrega funciones al archivo de T011); no depende de la UI de búsqueda/filtro de US3
- **US3 (P3)**: extiende `src/components/pet-grid.tsx` y `empty-states.tsx` creados en US1; es la única que no es 100% independiente de archivos porque literalmente amplía la cuadrícula ya construida — pero es probable independientemente sin tocar US2

### Parallel Opportunities

- Setup: T002, T003, T004, T006 en paralelo tras T001
- Foundational: T009 y T010 en paralelo
- US1: T011, T012, T013, T014 en paralelo
- US2: T018 (test) en paralelo con nada previo; T020, T021, T022 en paralelo entre sí una vez que T019 pasó
- US3: T025 (test) independiente; T026 sigue a T025

---

## Parallel Example: User Story 1

```bash
Task: "Implementar getPetSummaries() y getPetCount() en src/lib/pets.ts"
Task: "Crear src/components/pet-card.tsx"
Task: "Crear src/components/view-toggle.tsx"
Task: "Crear src/components/empty-states.tsx con el estado vacío general"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Completar Phase 1: Setup
2. Completar Phase 2: Foundational (incluye el gate de RLS T010 — no seguir si falla)
3. Completar Phase 3: User Story 1
4. **Parar y validar**: correr el bloque "Pantalla A" de `quickstart.md`
5. Esto ya es un catálogo público desplegable

### Incremental Delivery

1. Setup + Foundational → fundación lista
2. + US1 → validar independientemente → deploy (MVP)
3. + US2 → validar independientemente (URL directa a una ficha) → deploy
4. + US3 → validar independientemente (búsqueda/filtro) → deploy
5. Cada historia agrega valor sin romper la anterior

---

## Notes

- `[P]` = archivos distintos, sin dependencias pendientes entre sí
- `[Story]` mapea cada tarea a su historia para trazabilidad
- T010 (RLS) es un gate de seguridad, no una tarea de relleno: si falla, para y arreglá la política antes de seguir
- Confirmar tests fallando antes de implementar (T018→T019, T025→T026)
- Evitar: tareas vagas, dos tareas [P] tocando el mismo archivo, dependencias cruzadas que rompan la independencia de cada historia
