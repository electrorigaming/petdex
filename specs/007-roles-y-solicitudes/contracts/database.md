# Contracts: Esquema y funciones de Postgres

SQL completo, con rationale y alternativas, en `research.md`. Este documento
es la referencia rápida de la superficie final — qué tabla, qué función, qué
policy — para escribir `tasks.md` y la migración.

## Tablas nuevas

| Tabla | Filas esperadas | Quién escribe | Quién lee |
|---|---|---|---|
| `app_users` | Decenas | Solo por SQL manual (alta inicial) o `claim_approved_account()` (usuario); `delete` vía RLS solo admin sobre `role='usuario'` | Su propia fila, o cualquier admin (todas) |
| `account_requests` | Decenas, la mayoría resueltas | `insert` público (`anon`+`authenticated`, siempre `status='pendiente'`); `update` (aprobar/rechazar) solo admin | Su propia fila (por email de JWT), o cualquier admin (todas) |
| `pet_activity_log` | Cientos por mascota en el tiempo | Solo triggers `security definer` en `pets`/`milestones`/`sightings` — ninguna policy de `insert`/`update`/`delete` para `authenticated`/`anon` | Solo admin |

## Tabla eliminada

`admins` — su contenido se migra a `app_users` (`role='admin'`) antes de
eliminarla. Ver research.md §1 para el `insert ... select` exacto.

## Funciones

| Función | Firma | `security` | Quién la ejecuta | Para qué |
|---|---|---|---|---|
| `is_admin()` | `() returns boolean` | `definer` | `authenticated`, `anon` | Ya existe — se redefine para leer `app_users` en vez de `admins`. Mismo contrato. |
| `is_editor()` | `() returns boolean` | `definer` | `authenticated`, `anon` | Nueva — admin **o** usuario. Reemplaza a `is_admin()` en las policies de `milestones`/`sightings`. |
| `claim_approved_account()` | `() returns void` | `definer` | `authenticated` | Se llama una vez por login exitoso desde `app/auth/callback/route.ts`. Idempotente. |
| `current_actor_label()` | `() returns text` | `definer` | uso interno (triggers) | No se expone al cliente — no necesita `grant` a `authenticated`/`anon`. |
| `pet_row_exists(pid uuid)` / `pet_is_own_private(pid uuid)` | `(uuid) returns boolean` | `definer` | usadas dentro de las policies de `storage.objects` | Reemplazan un `exists(...)` crudo que resultó frágil evaluado dentro de una policy de otra tabla (research.md §9, nota post-implementación). |
| `log_pet_activity()` / `log_milestone_activity()` / `log_sighting_activity()` | funciones de trigger | `definer` | disparadas automáticamente | Únicos escritores de `pet_activity_log`. |
| RPC de estado de cuenta (nombre a definir en `tasks.md`, p. ej. `my_account_status()`) | `() returns table(role text, request_status text)` | `definer`, `stable` | `authenticated` (y `anon`, devuelve todo `null`) | Reemplaza la llamada a `rpc("is_admin")` en `session-provider.tsx` — un único round-trip para resolver `role`/`requestStatus`. |

## Matriz de RLS resultante

| Tabla | `select` | `insert` | `update` | `delete` |
|---|---|---|---|---|
| `pets` | pública (`visibility`-aware, sin cambio) | `is_admin()` (cualquier Tipo) **OR** `is_editor()` sin admin + `visibility='privado'` propia | `is_admin()` + ownership **OR** `is_editor()` sin admin + propia privada (Tipo no puede cambiar, ver research.md §8) | `is_admin()` + ownership **OR** `is_editor()` sin admin + propia privada |
| `milestones` | pública (sin cambio) | `is_editor()` + ownership de la mascota | `is_editor()` + ownership | `is_editor()` + ownership |
| `sightings` | pública (sin cambio) | `is_editor()` + ownership de la mascota | `is_editor()` + ownership | `is_editor()` + ownership |
| `app_users` | propia fila, o `is_admin()` | — (ninguna) | — (ninguna) | `is_admin()` y `role='usuario'` |
| `account_requests` | propia (por email de JWT), o `is_admin()` | pública, solo `status='pendiente'` y sin campos de revisión | `is_admin()` | — (ninguna) |
| `pet_activity_log` | `is_admin()` | — (ninguna, solo triggers) | — (ninguna) | — (ninguna) |
| `storage.objects` (`pet-photos`) | pública (bucket público, sin cambio) | `is_admin()` **OR** `is_editor()` + ruta sin fila existente o propia privada | `is_admin()` **OR** `is_editor()` + ruta de propia privada | `is_admin()` **OR** `is_editor()` + ruta de propia privada |

## No-contrato: qué NO cambia

- `mark_sighting(p_pet_id, p_seen, p_date, p_note)` — sigue `security invoker`,
  sin cambios de firma; hereda automáticamente la nueva policy de `sightings`
  porque corre con los privilegios de quien la llama (research.md,
  `002-panel-administracion` ya documentó esta propiedad).
- `pets_overview` — sin columnas nuevas; ninguna historia de esta feature
  necesita datos de rol o historial en la cuadrícula.
- Las políticas de `insert`/`update`/`delete` de `pets` que ya existían
  (`pets_admin_*`) — sin cambios; se suman políticas nuevas al lado
  (`pets_usuario_*`, research.md §8), no se tocan ni se reemplazan las de
  administradora.
- `pets_select` — sin cambios; ya era agnóstica de rol desde
  `005-tipo-privado-publico`, así que ya cubre correctamente a una cuenta
  Usuario leyendo su propia Privada.
