# Implementation Plan: Tipo editable desde el formulario

**Branch**: `006-tipo-editable-formulario` | **Date**: 2026-08-16 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/006-tipo-editable-formulario/spec.md`

**Note**: This template is filled in by the `/speckit-plan` command; its definition describes the execution workflow.

## Summary

Revierte FR-003 de `005-tipo-privado-publico`: el campo Tipo pasa a ser
editable desde `pet-form.tsx`, mismo patrón que Estado/Esterilizado. Se
elimina el trigger `pets_lock_visibility_trigger` (ya no aplica — ahora la
app sí tiene un camino legítimo para tocar `visibility`/`created_by`) y se
endurece `pets_admin_insert` con la misma condición de ownership que ya
tenía `pets_admin_update` desde 005. La regla de negocio nueva — "privado
siempre pertenece a quien guardó por última vez" — no necesita ninguna
policy nueva: `pets_admin_update` ya la garantizaba, solo estaba bloqueada
por el trigger.

## Technical Context

**Language/Version**: TypeScript 5.7, Next.js 15 (App Router), React 19

**Primary Dependencies**: Sin cambios respecto de 005 — `@supabase/ssr`,
Zod, react-hook-form, componentes propios (`Radio`, ya usado por
Estado/Esterilizado).

**Storage**: PostgreSQL vía Supabase. Sin columnas nuevas — solo cambian
policies y se elimina un trigger (research.md §1–§3).

**Testing**: Vitest — extender `tests/integration/rls-pets-visibility.test.ts`
(o agregar un archivo hermano) para el caso "guardar como privado asigna la
propia cuenta como dueña" y "no se puede asignar una dueña ajena"
(research.md §7). No hace falta tocar `tests/unit/pet-filters.test.ts` —
`PetFilters`/`matchesFilters` no cambian.

**Target Platform**: PWA web, mobile-first (375px de referencia).

**Project Type**: Web app single-project (Next.js App Router).

**Performance Goals**: Sin objetivo nuevo.

**Constraints**: Sin variables de entorno nuevas; la regla de ownership
sigue siendo 100% RLS (Principio I) — la Action nunca es la única línea de
defensa.

**Scale/Scope**: Sin cambio de escala.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principio | Evaluación |
|---|---|
| I. Permisos en la base de datos | PASS — la regla "privado pertenece a quien guarda" la garantiza `pets_admin_update`/`pets_admin_insert` (RLS), no la Action. El trigger que se elimina existía justamente para lo contrario (bloquear), y su eliminación está justificada porque ahora hay un camino legítimo que la policy ya sabe validar sola (research.md §1–§2). |
| II. Minimalismo visual (Swiss Style) | PASS — el control de Tipo reutiliza `<Radio>`, mismo patrón que Estado/Esterilizado, sin componente ni paleta nueva. |
| III. Mobile-first, una sola mano | PASS — un campo más dentro del formulario ya scrolleable, no agrega un control fijo nuevo. |
| IV. Ninguna imagen depende de una URL que expira | N/A — no toca fotos. |
| V. El esquema es la fuente de verdad | PASS — migración versionada en `supabase/migrations/`, seguida de `npm run gen:types`/`npm run typecheck` (sin columnas nuevas, pero los tipos de las policies no afectan `database.ts`, así que este paso es solo para confirmar que nada más se rompió). |
| VI. Degradación offline | PASS — no cambia el payload cacheado por el service worker (`visibility` ya viajaba en `PetSummary` desde 005). |

Sin violaciones — no se completa Complexity Tracking.

## Project Structure

### Documentation (this feature)

```text
specs/006-tipo-editable-formulario/
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
└── 20260816120000_make_visibility_editable.sql
    # DROP TRIGGER pets_lock_visibility_trigger + DROP FUNCTION pets_lock_visibility()
    # DROP/CREATE pets_admin_insert (+ condición de ownership, research.md §3)
    # pets_admin_update NO se toca (research.md §2)

src/types/database.ts        # regenerado con `npm run gen:types` tras la migración (sin cambios de columnas esperados)

src/lib/
├── validation/pet-schema.ts # petFieldsSchema + campo visibility (reutiliza PET_VISIBILITY_OPTIONS/LABEL de 005)
├── pets.ts                  # PetDetail + visibility; getPetBySlug() suma visibility al select
└── actions/pets.ts          # createPet/updatePet mandan visibility + created_by (research.md §4)

app/mascotas/[slug]/editar/page.tsx  # initialValues suma visibility

src/components/
└── pets/pet-form.tsx        # + control Tipo (Radio Público/Privado), mismo patrón que Estado

tests/
└── integration/rls-pets-visibility.test.ts  # + casos: guardar privado asigna auth.uid() propio; rechaza created_by ajeno; revertir a público (research.md §7)
```

**Structure Decision**: Proyecto único (Next.js App Router), sin carpetas
nuevas. Extiende exactamente los mismos módulos que tocó
`005-tipo-privado-publico`, ahora en la dirección opuesta (de solo-lectura a
editable). No se toca `pet-card.tsx`, `pet-grid.tsx`, `pet-filters.ts` ni
`pet-detail.tsx` — su comportamiento no cambia (data-model.md).

## Complexity Tracking

N/A — sin violaciones de la constitución (ver Constitution Check).
