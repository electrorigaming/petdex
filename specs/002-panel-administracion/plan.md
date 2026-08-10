# Implementation Plan: Panel de administración

**Branch**: `002-panel-administracion` | **Date**: 2026-08-10 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/002-panel-administracion/spec.md`

## Summary

Panel de administración que reemplaza la carga manual en la base de datos:
login con Google (múltiples cuentas autorizadas, sin roles), alta/edición de
mascota con foto subida directo del navegador a Supabase Storage, y alta/
edición/borrado de hitos desde la ficha pública. Se extiende la app de
Next.js existente (no hay backend propio): las mismas rutas públicas de la
feature 1 ganan controles de edición condicionados a la sesión, más rutas
nuevas para los formularios. La única garantía de escritura sigue siendo RLS
sobre las políticas ya aplicadas (`pets_admin_write`, `milestones_admin_write`,
`pet_photos_admin_write/update/delete`) — no se toca el esquema.

## Technical Context

**Language/Version**: TypeScript 5.x (strict) sobre Next.js 15 (App Router), Node.js 20 LTS

**Primary Dependencies**: `next`, `react`/`react-dom`, `tailwindcss`, `shadcn/ui`
(Radix + CVA), `lucide-react`, `@supabase/ssr` + `@supabase/supabase-js`
(ya instalados) — más `react-hook-form`, `zod`, `@hookform/resolvers` (nuevos).
Compresión de imágenes con `createImageBitmap` + `<canvas>` nativos del
navegador, sin librería.

**Storage**: Supabase Postgres ya aplicado (`petdex-schema.sql`: tablas `pets`,
`milestones`, `admins`; funciones `is_admin()`, `mark_sighting`; políticas RLS
`*_admin_write` ya cubren escritura de mascotas/hitos/fotos para cualquier fila
de `admins`, sin importar el método de login) y bucket público `pet-photos`.
**Sin migraciones nuevas** — el esquema ya soporta múltiples administradores
porque `is_admin()` solo verifica pertenencia a la tabla `admins`, agnóstica al
proveedor de autenticación.

**Testing**: Vitest — unitarios para generación de slug (acentos, ñ),
compresión de imágenes y mapeo de códigos de error Postgres; integración
extendida de RLS por tabla (`pets`, `milestones`) confirmando que la anon key
falla con `42501` y que una sesión admin de prueba tiene éxito. Playwright
para el flujo E2E (alta con foto, agregar hito, cerrar sesión, visibilidad sin
sesión), con la sesión de administrador bootstrapeada programáticamente (ver
research.md §6) en vez de automatizar el consentimiento real de Google.

**Target Platform**: Web responsive, desplegado en Vercel; mobile-first
(375/768/1024/1440) — el formulario se usa parado en la calle, con una mano.

**Project Type**: Aplicación web de un solo proyecto (Next.js), extiende la
misma app de la feature 1. Se agregan las piezas de infraestructura que esa
feature dejó explícitamente diferidas: `lib/supabase/client.ts` (browser) y
`middleware.ts` (refresco de sesión).

**Performance Goals**: Alta de mascota completa (datos + foto) en menos de 3
minutos (SC-001); hito visible en la timeline en menos de 2 segundos sin
recargar la página (SC-003); login hasta la pantalla correcta en menos de 10
segundos (SC-006).

**Constraints**: Solo `NEXT_PUBLIC_SUPABASE_URL` y `NEXT_PUBLIC_SUPABASE_ANON_KEY`
en runtime — Google OAuth no agrega variables de entorno propias porque el
intercambio de credenciales lo resuelve Supabase Auth, configurado en su
dashboard, no en el código de la app (ver research.md §1). Sin service role
key en ningún punto, ni siquiera para testing (ver research.md §6, que usa un
admin de prueba con contraseña — un usuario real con los mismos privilegios
que cualquier admin, no un bypass). Fotos nunca vía Route Handler ni Server
Action (límite de body ~4.5 MB de las funciones serverless de Vercel); siempre
navegador → Storage directo.

**Scale/Scope**: Escala de barrio (decenas de mascotas); 6 rutas nuevas
(login, callback OAuth, alta mascota, editar mascota, agregar hito, editar
hito) más controles condicionales agregados a las 2 rutas públicas existentes.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

Constitución v1.1.0 (ver `.specify/memory/constitution.md`).

| Principio | Evaluación |
|---|---|
| I. Los permisos viven en la base de datos | PASS. Ninguna Server Action confía en su propia validación: usa `getUser()` (nunca `getSession()`) solo para dar buenos mensajes de error, y las políticas `*_admin_write` ya aplicadas son la garantía real, verificada explícitamente en tests de integración (research.md §6). Sin service role key en ningún punto — el admin de prueba usado en tests es una fila real de `admins`, no un atajo. |
| II. Minimalismo visual (Swiss Style) | PASS. Los formularios nuevos reutilizan `design-system/MASTER.md` y los componentes `shadcn/ui` ya construidos en la feature 1 (`Input`, `Select`, `Button`, `Card`); no se introduce paleta ni componentes fuera de ese sistema. |
| III. Mobile-first, una sola mano | PASS. Campos grandes, teclado numérico para peso, orden de tabulación coherente, botón de guardar alcanzable con el pulgar — explícito en el pedido y en `data-model.md`/`quickstart.md`. |
| IV. Ninguna imagen depende de una URL que expira | PASS, y esta feature es la que por primera vez escribe `photo_url`: siempre la URL pública de `getPublicUrl()`, nunca signed URL. Además cumple las dos reglas nuevas que trae este principio para escritura: comprimir en el cliente (1600px, WebP, calidad 0.8) antes de subir, y nombre de archivo único por subida (`{petId}/{timestamp}.webp`, nunca sobrescribir una ruta existente). |
| V. El esquema es la fuente de verdad | PASS. Sin migraciones; `src/types/database.ts` no se toca a mano — si algún tipo no alcanza (no debería, el esquema ya cubre todo lo necesario), se resuelve con un tipo derivado en `src/lib/`, nunca editando el archivo generado. |
| VI. Degradación offline | DIFERIDO, no violado — mismo tratamiento que en la feature 1: esta feature no tiene service worker ni lógica offline (explícitamente fuera de alcance en el pedido original), y no bloquea agregarlo después. |
| Stack y Alcance | PASS. Next.js App Router + TypeScript + Tailwind + shadcn/ui + Supabase, sin variables de entorno nuevas en runtime. Múltiples administradores ya está dentro del alcance v1 (constitución v1.1.0). |
| Flujo de Desarrollo y Cumplimiento | PASS. El checklist de "tarea terminada" se corre igual que en la feature 1, con la extensión de RLS ahora cubriendo también el camino positivo (sesión admin tiene éxito), no solo el negativo. |

No hay violaciones que requieran la tabla de Complexity Tracking.

## Project Structure

### Documentation (this feature)

```text
specs/002-panel-administracion/
├── plan.md              # This file (/speckit-plan command output)
├── research.md          # Phase 0 output (/speckit-plan command)
├── data-model.md         # Phase 1 output (/speckit-plan command)
├── quickstart.md        # Phase 1 output (/speckit-plan command)
├── contracts/            # Phase 1 output (/speckit-plan command)
└── tasks.md              # Phase 2 output (/speckit-tasks command - NOT created by /speckit-plan)
```

### Source Code (repository root)

```text
app/
├── layout.tsx                          # Existente — agrega el shell de sesión (research.md §2)
├── page.tsx                            # Existente — agrega botón "alta" condicionado a sesión
├── login/
│   └── page.tsx                        # Pantalla A — botón "Continuar con Google"
├── auth/
│   └── callback/
│       └── route.ts                    # Intercambia el code de OAuth por sesión (research.md §3)
├── test/
│   └── login/
│       └── page.tsx                    # Solo-test: signInWithPassword vía el browser client (research.md §6); 404 si NODE_ENV === 'production'
└── mascotas/
    ├── nueva/
    │   └── page.tsx                    # Pantalla B (alta) — protegida por middleware
    └── [slug]/
        ├── page.tsx                     # Existente — agrega controles de editar/agregar hito
        ├── editar/
        │   └── page.tsx                 # Pantalla B (edición) — protegida por middleware
        └── hitos/
            ├── nuevo/
            │   └── page.tsx             # Pantalla C (alta de hito) — protegida
            └── [hitoId]/
                └── editar/
                    └── page.tsx         # Pantalla C (edición de hito) — protegida

middleware.ts                            # Nuevo — refresca sesión + redirige rutas protegidas a /login

src/
├── types/
│   └── database.ts                     # Ya generado — sin cambios (Principio V)
├── lib/
│   ├── supabase/
│   │   ├── client.ts                   # Nuevo — browser client (@supabase/ssr)
│   │   ├── server.ts                   # Existente — sin cambios de forma
│   │   └── middleware.ts               # Nuevo — helper updateSession() (research.md §2)
│   ├── validation/
│   │   ├── pet-schema.ts               # Zod — mismo esquema en cliente y servidor
│   │   └── milestone-schema.ts         # Zod
│   ├── slug.ts                         # generateSlug() (NFD, sin diacríticos, kebab-case)
│   ├── image-compression.ts            # compressToWebp() (createImageBitmap + canvas)
│   ├── errors.ts                       # mapPostgresError() — 23505/42501 → texto en español
│   ├── pets.ts                         # Existente — solo lectura, sin cambios de forma
│   ├── milestones.ts                   # Existente — solo lectura, sin cambios de forma
│   └── actions/
│       ├── pets.ts                     # Nuevo — createPet/updatePet, "use server" a nivel de módulo
│       └── milestones.ts               # Nuevo — createMilestone/updateMilestone/deleteMilestone, ídem
└── components/
    ├── auth/
    │   ├── login-button.tsx            # "Continuar con Google" (Client Component)
    │   ├── logout-button.tsx           # Cierra sesión
    │   └── session-nav-link.tsx        # Enlace "Iniciar sesión" / botón de logout según sesión (FR-005/006)
    ├── pets/
    │   ├── pet-form.tsx                 # Pantalla B — un solo componente para alta y edición
    │   ├── photo-field.tsx              # Selección + preview + compresión + progreso + quitar foto
    │   └── slug-field.tsx               # Autogenerado, editable en alta, solo lectura en edición
    └── milestones/
        ├── milestone-form.tsx           # Pantalla C — alta y edición
        └── delete-milestone-dialog.tsx  # Confirmación explícita nombrando el hito

tests/
├── unit/
│   ├── slug.test.ts                    # Nuevo — acentos, ñ, colisiones de formato
│   ├── image-compression.test.ts       # Nuevo — dimensiones/formato de salida
│   └── errors.test.ts                  # Nuevo — mapeo 23505/42501 → texto
├── integration/
│   ├── rls-pets-insert.test.ts         # Existente — se le agrega el camino positivo (admin)
│   ├── rls-pets-write.test.ts          # Nuevo — update/delete si aplica, mismo patrón
│   └── rls-milestones-write.test.ts    # Nuevo — insert/update/delete con anon (falla) y admin (éxito)
└── e2e/
    ├── global-setup.ts                 # Bootstrapea sesión admin real vía browser (research.md §6)
    ├── admin-flow.spec.ts              # Alta con foto → agregar hito → cerrar sesión (storageState)
    └── anonymous-visibility.spec.ts    # Sin sesión: controles de edición no existen (sin storageState)
```

**Structure Decision**: Se mantiene el proyecto único de Next.js de la
feature 1. Alta/edición de mascota e hitos se implementan como rutas propias
(no modales) porque el formulario de mascota es largo (9 campos + foto) y el
principio de una sola mano se cumple mejor con una pantalla completa que con
un modal recortado. `middleware.ts` y `lib/supabase/client.ts` — que la
feature 1 dejó deliberadamente sin crear — se agregan ahora porque esta
feature es la primera con sesión de usuario real.
