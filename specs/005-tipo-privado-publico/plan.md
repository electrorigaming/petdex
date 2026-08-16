# Implementation Plan: Campo Tipo (Privado/Público) y visibilidad por administradora

**Branch**: `005-tipo-privado-publico` | **Date**: 2026-08-15 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/005-tipo-privado-publico/spec.md`

**Note**: This template is filled in by the `/speckit-plan` command; its definition describes the execution workflow.

## Summary

Agregar dos columnas a `pets` — `visibility` (`'publico' | 'privado'`, default
`'publico'`) y `created_by` (dueña, solo relevante cuando es `'privado'`) —
de solo lectura desde la aplicación (se cambian a mano por SQL, mismo
criterio que dar de alta una cuenta en `admins`). La garantía real es RLS:
se reemplaza la lectura pública total de `pets`/`milestones`/`sightings` por
una condición `publico OR created_by = auth.uid()`, y se restringe
update/delete/insert-relacionado a la dueña una vez que una fila es privada.
Se suma un tercer grupo de filtro "Tipo" en el catálogo (mismo patrón de
chips que Estado/Esterilizado), visible solo con sesión administradora, y un
indicador "Privado" en la tarjeta de la cuadrícula. Sin cambios en
formularios ni Server Actions — el campo nunca viaja en su payload.

## Technical Context

**Language/Version**: TypeScript 5.7, Next.js 15 (App Router), React 19

**Primary Dependencies**: `@supabase/ssr` + `@supabase/supabase-js` (RLS,
sin cambios de librería), componentes propios estilo Nocturne (`Badge`,
`FilterChip`) — sin librería nueva.

**Storage**: PostgreSQL vía Supabase. Columnas nuevas `pets.visibility text`
y `pets.created_by uuid`; `pets_overview` se extiende con `visibility`;
políticas RLS de `pets`/`milestones`/`sightings` se reemplazan/extienden
(research.md §2–§4).

**Testing**: Vitest (unidades — `matchesFilters` con el grupo `tipo` nuevo),
tests de integración RLS nuevos contra un proyecto Supabase real
(`tests/integration/rls-pets-visibility.test.ts`, research.md §5).

**Target Platform**: PWA web, mobile-first (375px de referencia).

**Project Type**: Web app single-project (Next.js App Router — no hay
frontend/backend separados).

**Performance Goals**: Sin objetivo nuevo — la condición extra en las
policies (`visibility = 'publico' or created_by = auth.uid()`) es una
comparación de columna indexable por PK/igualdad simple, sin impacto
perceptible al volumen de un barrio (decenas de mascotas).

**Constraints**: Sin variables de entorno nuevas; el campo Tipo no se
expone en ningún formulario (FR-003); la garantía de visibilidad debe
sostenerse aunque se la consulte sin pasar por la interfaz (FR-007,
Principio I).

**Scale/Scope**: Mismo orden de magnitud que el resto del catálogo — no
cambia por esta feature.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principio | Evaluación |
|---|---|
| I. Permisos en la base de datos | PASS — la visibilidad Privado/Público es 100% política RLS (research.md §3–§4); no hay ningún chequeo de ownership que viva solo en Server Actions o componentes. La inmutabilidad de `visibility`/`created_by` (FR-003) la garantiza un trigger `BEFORE UPDATE`, no la ausencia de un campo en el formulario (research.md §3.1 — encontrado y corregido en revisión de este plan: las policies de `update` solas permitían que una admin no dueña se autoasignara una mascota pública ajena). No se introduce service role key ni bypass de RLS en ningún punto (los tests de integración nuevos usan `anon`/`authenticated` reales, research.md §5). |
| II. Minimalismo visual (Swiss Style) | PASS — el badge "Privado" reutiliza `<Badge variant="neutral">` (mismo tratamiento que el de Esterilizado); el grupo de chips "Tipo" reutiliza `FilterChip`, sin paleta ni componente nuevos. |
| III. Mobile-first, una sola mano | PASS — el grupo Tipo se suma dentro del panel de Filtros ya colapsable; no agrega un control fijo nuevo en 375px. |
| IV. Ninguna imagen depende de una URL que expira | N/A — esta feature no toca fotos. |
| V. El esquema es la fuente de verdad | PASS — migración versionada en `supabase/migrations/`, seguida de `npm run gen:types` y `npm run typecheck` antes de tocar UI (tasks.md lo va a ordenar así explícitamente). |
| VI. Degradación offline | PASS — `visibility` viaja como cualquier otro campo de `PetSummary` dentro del mismo payload que ya cachea el service worker existente; no se agrega ningún mecanismo de cache nuevo. Una mascota privada que deja de ser visible (sesión cerrada) simplemente no está en el payload cacheado para esa sesión — comportamiento ya inherente a que el cache es por respuesta HTTP, no por usuario. |

Sin violaciones — no se completa Complexity Tracking.

## Project Structure

### Documentation (this feature)

```text
specs/005-tipo-privado-publico/
├── plan.md              # This file (/speckit-plan command output)
├── research.md          # Phase 0 output (/speckit-plan command)
├── data-model.md         # Phase 1 output (/speckit-plan command)
├── quickstart.md        # Phase 1 output (/speckit-plan command)
├── contracts/           # Phase 1 output (/speckit-plan command)
└── tasks.md             # Phase 2 output (/speckit-tasks command - NOT created by /speckit-plan)
```

### Source Code (repository root)

```text
supabase/migrations/
└── 20260815120000_add_visibility_to_pets.sql
    # ALTER TABLE pets ADD COLUMN visibility / created_by
    # DROP/CREATE de pets_select, pets_admin_insert/update/delete
    # DROP/CREATE de milestones_select, milestones_admin_write
    # DROP/CREATE de sightings_select, sightings_admin_write
    # CREATE OR REPLACE VIEW pets_overview (+ visibility al final)
    # ALTER VIEW pets_overview SET (security_invoker = on) — guard explícito, research.md §2
    # CREATE FUNCTION pets_lock_visibility() + TRIGGER pets_lock_visibility_trigger
    #   (inmutabilidad de visibility/created_by desde authenticated/anon, research.md §3.1)

src/types/database.ts        # regenerado con `npm run gen:types` tras la migración

src/lib/
├── validation/pet-schema.ts # + PET_VISIBILITY_OPTIONS / PET_VISIBILITY_LABEL (solo lectura, no entra a petFieldsSchema)
├── pets.ts                  # PetSummary + visibility; getPetSummaries() suma visibility al select
└── pet-filters.ts           # PetFilters + grupo `tipo`; matchesFilters/countActiveFilters/EMPTY_PET_FILTERS extendidos

src/components/
├── pet-card.tsx             # + indicador "Privado" solo cuando visibility === "privado"
└── pet-grid.tsx             # + grupo de chips "Tipo", renderizado solo si useSession().isAdmin
                              #   (isAdmin arranca en false mientras loading===true — si el panel
                              #   ya está abierto cuando la sesión resuelve, el grupo puede aparecer
                              #   con un salto; revisar en 375px, tasks.md lo detalla)

tests/
├── unit/pet-filters.test.ts                    # + casos del grupo `tipo` (OR intra-grupo, AND con estado/esterilizado)
└── integration/rls-pets-visibility.test.ts     # nuevo — select/update/delete de una fila privada desde: anon, admin dueña, admin no-dueña (simulada con created_by ajeno, research.md §5); incluye milestones/sightings heredando la restricción, y el caso admin no-dueña intenta privatizar una mascota pública ajena (debe fallar por el trigger, research.md §3.1)
```

**Structure Decision**: Proyecto único (Next.js App Router) — no hay
frontend/backend separados. La feature no agrega ninguna carpeta ni
componente nuevo de alto nivel; extiende módulos ya existentes de
`src/lib`, `src/components` y `supabase/migrations`, siguiendo exactamente
el mismo patrón que `004-esterilizado-y-filtros`. No se toca
`src/components/pets/pet-form.tsx` ni `src/lib/actions/pets.ts` — el campo
es de solo lectura desde la app (FR-003), así que no hay formulario ni
Server Action que extender.

## Complexity Tracking

N/A — sin violaciones de la constitución (ver Constitution Check).
