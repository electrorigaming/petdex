# Contract: políticas RLS de `pets` / `milestones` / `sightings`

Esta feature no agrega ninguna Server Action ni endpoint nuevo — el único
"contrato" que cambia es el de acceso a datos vía el cliente Supabase
(anon/authenticated), gobernado enteramente por RLS (Principio I). Este
documento es la referencia de qué operación se permite a quién, después de
la migración — ver SQL completo y rationale en research.md §3–§4.

## `pets`

| Rol / sesión | `select` | `insert` | `update` | `delete` |
|---|---|---|---|---|
| `anon` (sin sesión) | Solo filas `visibility = 'publico'` | ❌ | ❌ | ❌ |
| `authenticated`, no admin | Solo filas `visibility = 'publico'` | ❌ | ❌ | ❌ |
| admin, dueña de la fila (`created_by = auth.uid()`) | Todo lo `publico` + sus propias `privado` | ✅ cualquier fila | ✅ | ✅ |
| admin, no dueña | Todo lo `publico`, ninguna `privado` ajena | ✅ cualquier fila (research.md §3) | Solo filas `publico` | Solo filas `publico` |

Una fila `privado` es indistinguible de "no existe" para cualquier sesión
que no sea su dueña: `select` no la devuelve, `update`/`delete` afectan cero
filas (mismo comportamiento que ya prueba `rls-pets-write.test.ts` para
anon), y no hay mensaje de error diferenciado — mismo criterio que "ocultar,
no informar" ya usado en el resto del proyecto.

**`visibility`/`created_by` son inmutables desde la API** — un trigger
(`pets_lock_visibility_trigger`, research.md §3.1) rechaza cualquier `update`
que las cambie cuando el rol de conexión es `authenticated` o `anon`
(los dos únicos roles que usa la aplicación), sin importar si esa sesión es
admin dueña, admin no-dueña, o pasa las políticas de arriba. Esto es lo que
garantiza FR-003 a nivel de base — no la ausencia de un campo en el
formulario. Solo una conexión con otro rol (SQL Editor de Supabase) puede
cambiarlas.

## `milestones` / `sightings`

Misma tabla de arriba, pero la condición de `visibility`/`created_by` se
evalúa sobre la mascota dueña del hito/avistamiento (`pet_id`), no sobre una
columna propia — estas tablas no tienen `visibility`/`created_by` propios.
Aplica también a escrituras hechas vía `rpc('mark_sighting', ...)`, que
corre `security invoker` y por lo tanto queda sujeta a `sightings_admin_write`
igual que un insert directo.

## Server Actions — sin cambios de firma

`createPet`, `updatePet`, `deletePet`, `restorePet`
(`src/lib/actions/pets.ts`) no cambian su input ni su output. Ninguna manda
`visibility`/`created_by` en su payload — quedan en el default de columna
(`insert`) o simplemente no se tocan (`update`). `restorePet` reinserta la
fila completa tal cual estaba (incluido `visibility`/`created_by` si la
snapshot los tenía), y sigue funcionando para mascotas públicas borradas por
una admin distinta de su creadora original porque `pets_admin_insert` no
exige `created_by = auth.uid()` (research.md §3).

`getMilestonesForPet`, `getPetBySlug`, `getPetSummaries`, `getPetCount`,
`getAllPetSlugs` (`src/lib/pets.ts`) tampoco cambian de firma — su resultado
cambia implícitamente porque ahora excluyen filas privadas ajenas, resuelto
100% por la policy `pets_select`/`milestones_select`/`sightings_select` al
consultar la vista/tablas, sin lógica adicional en el código.

`deletePet` (`src/lib/actions/pets.ts`), para una mascota privada ajena, ya
maneja bien el nuevo caso sin cambios: el `select("*").eq("id", id)` previo
devuelve `pet: null` (la fila no es visible), y `mapPostgresError(null)`
(verificado en `src/lib/errors.ts`) devuelve el mensaje genérico "Algo salió
mal. Intentá de nuevo." — no rompe ni expone que la fila existe. Mismo
criterio de "ocultar, no informar" que el resto del contrato.
