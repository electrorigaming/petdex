# Implementation Plan: Campo Esterilizado y filtros de Estado/Esterilizado

**Branch**: `004-esterilizado-y-filtros` | **Date**: 2026-08-14 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/004-esterilizado-y-filtros/spec.md`

**Note**: This template is filled in by the `/speckit-plan` command; its definition describes the execution workflow.

## Summary

Agregar un atributo booleano `sterilized` a `pets` (default `No`), editable
desde el formulario de alta/edición ya existente, visible en la ficha
pública y (solo cuando es "Sí") en la tarjeta de la cuadrícula. Sumar un
panel de filtros colapsable en el catálogo con chips multi-select de Estado
y Esterilizado, combinados con OR dentro de cada grupo y AND entre grupos,
resueltos 100% en el cliente sobre los datos que ya trae `pets_overview`
(mismo criterio que el filtro de Zona existente).

## Technical Context

**Language/Version**: TypeScript 5.7, Next.js 15 (App Router), React 19

**Primary Dependencies**: `@supabase/ssr` + `@supabase/supabase-js`, Zod 4,
react-hook-form, Tailwind CSS, componentes propios estilo Nocturne
(`Badge`, `Radio`/`RadioChip`, `Select`) — sin librería nueva.

**Storage**: PostgreSQL vía Supabase. Columna nueva `pets.sterilized
boolean not null default false`; la vista `pets_overview` se extiende con
esa misma columna (research.md §1).

**Testing**: Vitest (unidades — validación Zod, lógica de filtrado),
Playwright (e2e existente, no se agregan specs nuevas salvo que el flujo de
filtros lo justifique).

**Target Platform**: PWA web, mobile-first (375px de referencia).

**Project Type**: Web app single-project (Next.js App Router — no hay
frontend/backend separados).

**Performance Goals**: Sin objetivo específico nuevo — el filtrado corre en
memoria sobre una lista ya cargada de decenas de mascotas (mismo orden de
magnitud que el filtro de Zona existente, 001-catalogo-publico).

**Constraints**: Sin variables de entorno nuevas; ninguna escritura nueva
sin cobertura RLS; el filtrado de Estado/Esterilizado no dispara consultas
adicionales a Supabase (Principio V no aplica acá porque no hay paginación).

**Scale/Scope**: Mismo orden de magnitud que el resto del catálogo (decenas
de mascotas, un barrio) — no cambia por esta feature.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principio | Evaluación |
|---|---|
| I. Permisos en la base de datos | PASS — `sterilized` es una columna más de `pets`; la escritura ya está cubierta por la policy `pets_admin_write` (`for all ... with check (is_admin())`) sin necesidad de una policy nueva. No se introduce service role key ni bypass de RLS. |
| II. Minimalismo visual (Swiss Style) | PASS — el badge de ficha reutiliza `<Badge variant="outline">` (mismo tratamiento que Estado); los chips de filtro reutilizan la estética ya definida de `RadioChip` (borde + acento), sin paleta ni componente nuevos. |
| III. Mobile-first, una sola mano | PASS — el panel de filtros va colapsado por defecto detrás de un botón "Filtros (N)" junto al selector de Zona, para no sumar una fila fija de chips en 375px (decisión explícita con el usuario, ver Clarifications de spec.md). |
| IV. Ninguna imagen depende de una URL que expira | N/A — esta feature no toca fotos. |
| V. El esquema es la fuente de verdad | PASS — migración versionada en `supabase/migrations/`, seguida de `npm run gen:types` y `npm run typecheck` antes de tocar UI (tasks.md lo ordena así explícitamente). |
| VI. Degradación offline | PASS — `sterilized` viaja como cualquier otro campo de `PetSummary`/`PetDetail` dentro del mismo payload que ya cachea el service worker existente; no se agrega ningún mecanismo de cache nuevo. |

Sin violaciones — no se completa Complexity Tracking.

## Project Structure

### Documentation (this feature)

```text
specs/004-esterilizado-y-filtros/
├── plan.md              # This file (/speckit-plan command output)
├── research.md          # Phase 0 output (/speckit-plan command)
├── data-model.md        # Phase 1 output (/speckit-plan command)
├── quickstart.md        # Phase 1 output (/speckit-plan command)
├── contracts/           # Phase 1 output (/speckit-plan command)
└── tasks.md             # Phase 2 output (/speckit-tasks command - NOT created by /speckit-plan)
```

### Source Code (repository root)

```text
supabase/migrations/
└── 20260814120000_add_sterilized_to_pets.sql   # ALTER TABLE + CREATE OR REPLACE VIEW pets_overview

src/types/database.ts        # regenerado con `npm run gen:types` tras la migración

src/lib/
├── validation/pet-schema.ts # + campo sterilized (boolean, default false)
├── pets.ts                  # PetSummary/PetDetail + sterilized; getPetSummaries() suma status/sterilized al select
└── actions/pets.ts          # createPet/updatePet pasan sterilized al insert/update

src/components/
├── pets/pet-form.tsx        # + control Sí/No para Esterilizado (mismo patrón que Estado)
├── pet-detail.tsx           # + badge Esterilizada/o
├── pet-card.tsx             # + indicador solo cuando sterilized === true
├── pet-grid.tsx             # + botón "Filtros (N)" y panel con chips de Estado/Esterilizado
└── ui/
    └── filter-chip.tsx      # nuevo — botón toggle multi-select, estética de RadioChip

tests/
├── unit/pet-filters.test.ts            # nuevo — lógica pura de combinación de filtros (OR intra-grupo, AND entre grupos)
└── integration/rls-pets-write.test.ts  # ya existente y agnóstico de columna — cubre `sterilized` sin cambios (RLS es por fila/tabla, no por columna)
```

**Structure Decision**: Proyecto único (Next.js App Router) — no hay
frontend/backend separados. La feature no agrega ninguna carpeta nueva de
alto nivel; extiende módulos ya existentes de `src/lib` y `src/components`,
y suma un único componente presentacional nuevo (`filter-chip.tsx`) porque
el toggle multi-select no tiene un equivalente reutilizable hoy (`RadioChip`
es de selección única).

## Complexity Tracking

N/A — sin violaciones de la constitución (ver Constitution Check).
