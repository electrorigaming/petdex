# Implementation Plan: Rol Usuario, solicitud de cuenta y registro de modificaciones

**Branch**: `007-roles-y-solicitudes` | **Date**: 2026-08-24 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/007-roles-y-solicitudes/spec.md`

## Summary

Reemplazar la tabla `admins` (cuenta única de escritura) por una tabla
unificada de cuentas de la aplicación con rol (`admin` | `usuario`), agregar
una tabla de solicitudes públicas de cuenta Usuario con aprobación manual, y
registrar en una tabla de solo lectura cada evento de escritura relevante por
mascota (creación, edición de ficha, altas/bajas de hitos, marcas de
avistamiento). El rol Usuario puede escribir hitos/avistamientos de cualquier
mascota Pública y, además, crear sus propias mascotas — siempre y únicamente
con Tipo Privado, con exactamente el mismo aislamiento por `created_by` que
ya rige entre administradoras (`005-tipo-privado-publico`) — sin poder nunca
tocar una mascota Pública ni cambiar el campo Tipo de ninguna mascota, propia
o ajena. Todo el enforcement de permisos —quién puede escribir qué, quién
puede aprobar solicitudes, quién puede leer el historial— vive en políticas
RLS de Postgres (incluidas las del bucket de fotos), siguiendo el mismo
patrón que ya usan `is_admin()` y las políticas de
`pets`/`milestones`/`sightings`. La UI se ajusta para distinguir tres estados
de sesión autenticada (admin / usuario / sin rol) en vez de dos (admin /
bloqueado), y se agrega un panel de administración nuevo para aprobar
solicitudes y revocar accesos.

## Technical Context

**Language/Version**: TypeScript 5.7 (strict), Next.js 15 App Router (React 19)

**Primary Dependencies**: `@supabase/ssr` / `@supabase/supabase-js` (auth + DB), `react-hook-form` + `zod` (formularios), `@phosphor-icons/react` (íconos), Tailwind + shadcn/ui-style componentes propios

**Storage**: Supabase Postgres — tres tablas nuevas (`app_users`, `account_requests`, `pet_activity_log`), dos tablas existentes migradas (`milestones`, `sightings` cambian de policy), una tabla reemplazada (`admins` → `app_users`), sin cambios de esquema en `pets`

**Testing**: Vitest (unit), Playwright (e2e, `tests/e2e/*.spec.ts`), tests de integración RLS con `@supabase/supabase-js` directo contra el proyecto (`tests/integration/rls-*.test.ts`, `signInWithPassword` con cuentas de prueba dedicadas)

**Target Platform**: Web (PWA), mobile-first — mismo target que el resto del proyecto

**Project Type**: Web app (Next.js App Router, single repo, sin separación frontend/backend — las Server Actions son el único "backend" propio)

**Performance Goals**: Sin requisito nuevo — el panel de solicitudes y el historial son pantallas de bajo volumen (decenas de filas), no necesitan paginación ni virtualización en v1

**Constraints**: Autorización 100% en RLS (Principio I, ahora v1.2.0 admite roles distintos); solo Google Sign-In, sin contraseña propia (CLAUDE.md); solo dos variables de entorno públicas permitidas, ninguna nueva; ninguna imagen ni URL con expiración involucrada en esta feature

**Scale/Scope**: Un barrio — decenas de cuentas de escritura como mucho, cientos de eventos de historial por mascota en el peor caso a lo largo de su vida

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- **I. Los permisos viven en la base de datos** — La feature introduce un
  segundo rol de escritura con permisos distintos. Esto requirió una enmienda
  del principio (v1.1.0 → v1.2.0, ver Sync Impact Report en
  `.specify/memory/constitution.md`): el principio ya admitía múltiples
  cuentas del mismo rol; ahora admite explícitamente múltiples roles con
  permisos distintos entre sí, sin tocar la garantía central (RLS es la única
  línea de defensa real, sin service role key). El rol Usuario, además, hereda
  el patrón de ownership por `created_by` que `005-tipo-privado-publico` ya
  estableció para administradoras — no es un mecanismo nuevo, es el mismo
  aplicado a una cuenta más. **PASS** tras la enmienda.
- **II. Minimalismo visual** — El panel `/admin/solicitudes` y la sección
  Historial siguen el design system existente (`design-system/MASTER.md`);
  sin íconos nuevos fuera de Lucide/Phosphor ya en uso. **PASS**, verificar en
  implementación.
- **III. Mobile-first, una sola mano** — El formulario de solicitud y el
  panel de aprobación son pantallas nuevas: se diseñan mobile-first a 375px
  igual que el resto de la app. **PASS**, verificar en implementación.
- **IV. Ninguna imagen depende de una URL que expira** — No aplica, esta
  feature no toca fotos. **N/A**.
- **V. El esquema es la fuente de verdad** — Tres tablas nuevas y cambios de
  policy requieren migración SQL + `npm run gen:types` + `npm run typecheck`
  antes de seguir, igual que toda migración anterior. **PASS**, condición
  explícita en `tasks.md`.
- **VI. Degradación offline** — El panel de administración y el historial no
  son parte del flujo offline crítico (marcar avistamientos); no se les exige
  funcionar sin conexión. El flujo ya offline-capaz (`mark_sighting` vía cola)
  sigue funcionando igual para una cuenta Usuario, porque la cola no distingue
  roles, solo reintenta la misma llamada. **PASS**.

No quedan violaciones sin justificar. Ninguna complejidad adicional requiere
`Complexity Tracking`.

## Project Structure

### Documentation (this feature)

```text
specs/007-roles-y-solicitudes/
├── plan.md              # This file (/speckit-plan command output)
├── research.md          # Phase 0 output (/speckit-plan command)
├── data-model.md         # Phase 1 output (/speckit-plan command)
├── quickstart.md         # Phase 1 output (/speckit-plan command)
├── contracts/             # Phase 1 output (/speckit-plan command)
│   ├── database.md
│   └── server-actions.md
└── tasks.md              # Phase 2 output (/speckit-tasks command - NOT created by /speckit-plan)
```

### Source Code (repository root)

```text
supabase/migrations/
└── 20260824120000_roles_y_solicitudes.sql   # tabla app_users (reemplaza admins),
                                              # account_requests, pet_activity_log,
                                              # is_admin() redefinida, is_editor() nueva,
                                              # policies de pets para usuario (crear/editar/
                                              # eliminar solo privadas propias — nuevas, no
                                              # reemplazan a las de admin), policies de
                                              # milestones/sightings → is_editor(),
                                              # policies de storage.objects (pet-photos) →
                                              # is_editor() con verificación de dueño por
                                              # ruta (reemplaza a las de petdex-schema.sql),
                                              # claim_approved_account(), triggers de historial,
                                              # my_account_status()

src/types/database.ts                        # regenerado (npm run gen:types)

src/lib/supabase/                             # sin cambios (factories ya existentes)

app/auth/callback/route.ts                    # + llamada a claim_approved_account()
                                               #   antes de redirigir

app/login/
├── page.tsx                                  # + <AccountRequestForm>
└── loading.tsx                               # sin cambios

app/admin/solicitudes/
└── page.tsx                                  # nueva ruta, solo admin (Server Component
                                               #   + gate); lista pendientes + usuarios activos

app/mascotas/[slug]/
└── page.tsx                                  # + <ActivityLog> (solo si isAdmin)

src/components/auth/
├── admin-gate.tsx                            # se generaliza a AccessGate (4 estados)
├── admin-only.tsx                            # sin cambios (sigue siendo admin-only)
├── editor-only.tsx                           # nuevo, análogo a admin-only pero para is_editor
├── not-admin-screen.tsx                      # se ajusta el copy / se agregan variantes
│   (pendiente/rechazada) o se separan en componentes hermanos
├── request-pending-screen.tsx                # nuevo
└── session-provider.tsx                      # expone role/requestStatus, no solo isAdmin

src/hooks/use-session.ts                      # tipo de retorno ampliado

src/components/account-requests/              # nuevo directorio
├── account-request-form.tsx                  # formulario público en /login
├── pending-requests-list.tsx                 # panel admin: aprobar/rechazar
└── active-users-list.tsx                     # panel admin: revocar

src/components/pets/
├── activity-log.tsx                          # nuevo, sección Historial (admin-only);
│                                              #   sus datos vienen de src/lib/activity-log.ts
│                                              #   (nuevo, no src/lib/pets.ts — research.md §5,
│                                              #   nota post-implementación: pets.ts importa
│                                              #   next/headers a nivel de archivo, un Client
│                                              #   Component no puede importar de ahí)
├── pet-form.tsx                              # + lógica por rol: usuario ve el campo Tipo
│                                              #   oculto/fijo en "Privado" (crear y editar),
│                                              #   admin sin cambios (006 sigue igual)
├── add-pet-button.tsx                        # isAuthenticated → isEditor (usuario también crea)
├── edit-pet-button.tsx                       # + prop visibility: isAdmin || (isEditor && visibility === "privado")
├── delete-pet-button.tsx                     # + prop visibility, misma condición que edit
└── pet-admin-actions.tsx                     # + prop visibility, hilvana la condición a ambos hijos

src/components/milestone-timeline.tsx         # isAuthenticated → isEditor
src/components/sightings/
├── pet-sightings-section.tsx                 # isAuthenticated → isEditor
├── mark-today-control.tsx                    # <AdminOnly> → <EditorOnly>
└── mark-today-toggle.tsx                     # <AdminOnly> → <EditorOnly>

src/components/empty-states.tsx               # isAuthenticated → isEditor (CTA agregar mascota;
                                               # usuario también puede crear, aunque solo privadas)
src/components/pet-grid.tsx                   # filtro "Tipo": isAdmin → isEditor (usuario también
                                               # tiene privadas propias para filtrar)

src/lib/actions/
├── account-requests.ts                       # nuevo: submitAccountRequest,
│                                              #   approveRequest, rejectRequest, revokeUser
└── pets.ts                                    # updatePet()/deletePet(): detectar 0 filas afectadas
                                               # (RLS rechazó silenciosamente) y devolver un error
                                               # explícito en vez de un falso "guardado"/"eliminado"
                                               # — hueco expuesto recién ahora, porque el rol Usuario
                                               # es la primera cuenta que puede LEER una mascota
                                               # (Pública) sin poder ESCRIBIRLA (research.md §8)
                                               # milestones.ts/sightings.ts: sin cambios de firma

src/lib/validation/
└── account-request-schema.ts                 # nuevo (zod)

tests/integration/
├── rls-app-users.test.ts                     # nuevo
├── rls-account-requests.test.ts              # nuevo
├── rls-pet-activity-log.test.ts              # nuevo
├── rls-milestones-write.test.ts              # + casos con cuenta Usuario (mascota pública)
├── rls-sightings-write.test.ts               # + casos con cuenta Usuario (mascota pública)
├── rls-pets-write.test.ts                    # + casos con cuenta Usuario: crea/edita/elimina
│                                              #   su propia privada; no puede crear pública,
│                                              #   ni tocar una pública ajena o una privada
│                                              #   de otra cuenta, ni cambiar Tipo
├── rls-pet-photos-storage.test.ts             # nuevo — sube foto para su propia privada;
│                                              # no puede subir/reemplazar/borrar un archivo
│                                              # bajo el petId de una mascota que no es suya
└── helpers/auth.ts                            # nuevo — signInWithRetry(), reintento con
                                               # backoff ante el rate-limit de Supabase Auth
                                               # (research.md §6, nota post-implementación)

vitest.config.ts                              # testTimeout 20000ms, fileParallelism: false
                                               # (research.md §6, mismo motivo)

tests/e2e/
└── account-request-flow.spec.ts              # opcional (ver quickstart.md) — no implementado
                                               # en esta pasada, cubierto por los tests de
                                               # integración de account_requests/claim_approved_account

CLAUDE.md                                     # se actualiza la sección "Login de
                                               # administradoras" para documentar el rol
                                               # Usuario y el flujo de solicitud
```

**Structure Decision**: Proyecto único (Next.js App Router), sin separación
frontend/backend — se extiende la estructura ya existente (`app/`, `src/`,
`supabase/migrations/`, `tests/`) sin introducir nuevos paquetes ni carpetas
de nivel superior. La única carpeta nueva de primer nivel dentro de `app/` es
`app/admin/solicitudes/`, siguiendo el patrón de rutas por página que ya usa
`app/mascotas/nueva/`.

## Complexity Tracking

*Sin violaciones sin justificar — tabla omitida.*
