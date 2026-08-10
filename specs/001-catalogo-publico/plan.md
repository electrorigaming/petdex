# Implementation Plan: Catálogo público

**Branch**: `001-catalogo-publico` | **Date**: 2026-08-09 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/001-catalogo-publico/spec.md`

## Summary

Catálogo público de mascotas callejeras, de solo lectura y sin cuenta: una
pantalla de inicio con contador, cuadrícula/lista alternable con búsqueda
client-side y filtro de zona, y una ficha por mascota con sus datos y la
línea de tiempo de hitos. Se implementa como dos rutas de Next.js App Router
renderizadas en Server Components, leyendo directamente de Supabase Postgres
con la anon key (RLS ya garantiza el acceso público de lectura); no se toca
el esquema existente ni se agrega backend propio.

## Technical Context

**Language/Version**: TypeScript 5.x (strict) sobre Next.js 15 (App Router), Node.js 20 LTS

**Primary Dependencies**: `next`, `react`/`react-dom`, `tailwindcss`, `shadcn/ui` (Radix + `class-variance-authority`), `lucide-react`, `@supabase/ssr` + `@supabase/supabase-js`

**Storage**: Supabase Postgres ya aplicado (`petdex-schema.sql`: tablas `pets`, `milestones`, `sightings`, `admins`; vista `pets_overview`; función `mark_sighting`) y bucket público `pet-photos`. Sin migraciones nuevas.

**Testing**: Vitest — unitarios para la normalización de acentos y el orden de la timeline de hitos, más un test de integración contra el proyecto Supabase real que confirme que un `insert` en `pets` con la anon key falla (verifica la política RLS, no la simula)

**Target Platform**: Web responsive, desplegado en Vercel; mobile-first (375/768/1024/1440)

**Project Type**: Aplicación web de un solo proyecto (Next.js). No hay "backend" propio: Supabase es un servicio externo consumido directamente desde Server Components, sin capa de API intermedia

**Performance Goals**: Búsqueda y filtro de zona sin latencia de red perceptible (100% client-side sobre datos ya cargados); primera carga de cada pantalla sin spinner de datos (Server Component ya trae los datos resueltos)

**Constraints**: Solo `NEXT_PUBLIC_SUPABASE_URL` y `NEXT_PUBLIC_SUPABASE_ANON_KEY`; sin service role key; sin `supabase db push` ni migraciones nuevas; cuadrícula limitada a una consulta sobre `pets_overview` (nunca tablas base con subconsulta por tarjeta); sin índice full-text (búsqueda 100% cliente); toggle cuadrícula/lista persistido en `localStorage` sin flash de contenido incorrecto

**Scale/Scope**: Escala de barrio (decenas de mascotas, no miles); 2 pantallas; sin paginación en esta versión

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principio | Evaluación |
|---|---|
| I. Los permisos viven en la base de datos | PASS. Solo se usa el cliente de servidor con la anon key (`lib/supabase/server.ts`); toda lectura pasa por las políticas `pets_public_read` / `milestones_public_read` ya aplicadas. No se crea ni se referencia la service role key en ningún punto. |
| II. Minimalismo visual (Swiss Style) | PASS. `design-system/MASTER.md` generado en la Fase 1 de este plan (paleta monocromática + un único acento, Inter, Lucide, estados vacío/sin-resultados distintos, foco visible, `prefers-reduced-motion`). |
| III. Mobile-first, una sola mano | PASS. Ambas pantallas se diseñan primero para 375px; el filtro de zona y el toggle de vista son controles de un solo toque, sin gestos de dos manos. |
| IV. Ninguna imagen depende de una URL que expira | PASS. `pets.photo_url` ya es la URL pública permanente (`getPublicUrl()`) cargada por la feature de alta; esta feature solo la consume vía `next/image` y no genera signed URLs en ningún punto. |
| V. El esquema es la fuente de verdad | PASS. Los tipos ya están regenerados en `src/types/database.ts`; el plan no modifica el esquema ni escribe tipos a mano. |
| VI. Degradación offline | DIFERIDO, no violado. `spec.md` excluye explícitamente service worker/offline de esta feature (es la primera de varias). Las dos pantallas se implementan como Server Components estándar sin estado cliente que dependa de una conexión persistente, por lo que no bloquean agregar el service worker en una feature posterior. |
| Stack y Alcance | PASS. Next.js App Router + TypeScript + Tailwind + shadcn/ui + Supabase, tal como está fijado; ninguna variable de entorno nueva. |
| Flujo de Desarrollo y Cumplimiento | PASS. La cuadrícula usa `pets_overview` con `count: 'exact', head: true` para el contador (nunca `data.length`); se incluye el test de RLS con anon key exigido por el checklist de "tarea terminada". |

No hay violaciones que requieran la tabla de Complexity Tracking.

## Project Structure

### Documentation (this feature)

```text
specs/001-catalogo-publico/
├── plan.md              # This file (/speckit-plan command output)
├── research.md          # Phase 0 output (/speckit-plan command)
├── data-model.md        # Phase 1 output (/speckit-plan command)
├── quickstart.md        # Phase 1 output (/speckit-plan command)
├── contracts/           # Phase 1 output (/speckit-plan command)
└── tasks.md             # Phase 2 output (/speckit-tasks command - NOT created by /speckit-plan)
```

### Source Code (repository root)

```text
app/
├── layout.tsx                    # Layout raíz; script inline para leer la preferencia de vista sin flash
├── globals.css                   # Tailwind + tokens del design system
├── page.tsx                      # Pantalla A — Inicio (Server Component)
├── not-found.tsx                 # 404 propio de PetDex (fallback global)
└── mascotas/
    └── [slug]/
        ├── page.tsx               # Pantalla B — Ficha (Server Component + generateStaticParams)
        └── not-found.tsx          # 404 propio cuando el slug no existe

src/
├── types/
│   └── database.ts               # Ya generado — Database types (Principio V)
├── lib/
│   ├── supabase/
│   │   └── server.ts             # Único cliente Supabase que hace falta en esta feature (@supabase/ssr)
│   ├── pets.ts                   # getPetSummaries, getPetCount, getPetBySlug, getMilestonesForPet, getAllPetSlugs
│   ├── milestones.ts             # sortMilestones (orden cronológico + inversión)
│   └── search.ts                 # normalizeSearchText (acentos/mayúsculas)
└── components/
    ├── pet-grid.tsx               # Cuadrícula/lista + búsqueda + filtro (Client Component)
    ├── pet-card.tsx               # Tarjeta individual, linkeada a la ficha (foto/placeholder, nombre, zona)
    ├── pet-detail.tsx             # Contenido de la ficha (campos condicionales, FR-013)
    ├── view-toggle.tsx            # Alternador cuadrícula/lista (localStorage)
    ├── milestone-timeline.tsx     # Línea de tiempo de hitos con orden invertible
    └── empty-states.tsx           # Estado vacío vs. estado sin resultados (mensajes distintos)

design-system/
└── MASTER.md                      # Generado por ui-ux-pro-max en la Fase 1 de este plan

tests/
├── unit/
│   ├── normalize.test.ts          # Normalización de acentos/mayúsculas para la búsqueda
│   └── milestone-order.test.ts    # Orden cronológico y su inversión
└── integration/
    └── rls-pets-insert.test.ts    # Confirma que un insert en pets con la anon key falla
```

**Structure Decision**: Proyecto único de Next.js App Router (no hay split
frontend/backend: Supabase es un servicio externo, no una carpeta de este
repo). `app/` contiene únicamente las rutas de las dos pantallas de esta
feature; el resto de la lógica de datos y presentación vive en `src/`. Se
crea solo `lib/supabase/server.ts` — `client.ts` y `middleware.ts` (sesión
de auth) se agregan recién en la feature de autenticación, ya que esta
feature no tiene ningún flujo que dependa de sesión de usuario.

## Complexity Tracking

*No hay violaciones de la constitución que requieran justificación en esta feature.*
