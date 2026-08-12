# Contract: Marcar un avistamiento (`rpc mark_sighting`)

No es un contrato nuevo — `mark_sighting` ya existe y está aplicado
(`petdex-schema.sql`). Este documento fija cómo esta feature lo llama desde
tres lugares distintos con la misma forma, para que los tres queden cubiertos
por el mismo comportamiento del servidor.

## Firma (ya existente, sin cambios)

```
mark_sighting(
  p_pet_id  uuid,
  p_seen    boolean default true,
  p_date    date    default current_date,
  p_note    text    default null
) returns sightings
```

`security invoker` — evalúa la política `sightings_admin_write` contra la
sesión de quien efectivamente llama, sin importar si la llamada sale del
navegador o de un servidor.

**Regla de esta feature, no del RPC**: `p_date` se pasa **siempre explícito**,
nunca se confía en el default `current_date` (que es UTC). El valor viene de
`todayLocal()` (marcado de hoy) o del día elegido en el calendario
(corrección de un día pasado) — research.md §2.

## Los tres llamadores

| Llamador | Cuándo | `p_date` | Conexión requerida |
|---|---|---|---|
| `<MarkTodayControl>` (marcado directo) | Se toca "Visto" / "Revisado y no estaba" con conexión | `todayLocal()` | Si falla por red, no se rechaza: pasa a la cola offline (ver `offline-queue.md`) |
| `syncPendingSightings()` (cola offline) | Al recuperar señal, por cada `PendingSighting` con `status: "pending"` | El `seenOn` guardado en la entrada de la cola — el momento en que se marcó, no el de sincronizar (FR-021) | Sí — es la sincronización misma |
| `<PastDayDialog>` (corrección desde el calendario) | Se elige un día pasado y un valor, dentro del calendario | El día elegido | Sí, siempre — sin cola, sin reintento (Clarifications, spec.md) |

Los tres usan el mismo wrapper delgado (`src/lib/sightings.ts`):

```ts
async function callMarkSighting(
  supabase: SupabaseClient<Database>,
  args: { petId: string; seen: boolean; date: string }
): Promise<{ data: Sighting } | { error: PostgrestError }>
```

Nunca se arma un `insert`/`update` a mano contra `sightings` en ningún punto
de esta feature.

## Respuestas y qué hace cada llamador con ellas

**Éxito** (`data` con la fila resultante): el `seen` devuelto reemplaza el
valor optimista que ya se mostraba; si venía de la cola, la entrada
`PendingSighting` correspondiente se elimina.

**Error con `code`** (rechazo explícito del servidor — típicamente `42501`
si la sesión no es admin o expiró, o una violación de FK si la mascota fue
eliminada):
- Desde `<MarkTodayControl>` con conexión: se traduce con `mapPostgresError`
  y se muestra inline, sin encolar (hubo respuesta, no es un caso offline).
- Desde `syncPendingSightings()`: `classifySyncError` → `"permanent"` → la
  entrada pasa a `status: "failed"` con `failureReason` (research.md §4).
- Desde `<PastDayDialog>`: se traduce y se muestra inline; el diálogo no se
  cierra hasta que la administradora lo cierra o reintenta.

**Error sin `code`** (falla de red — no hubo respuesta):
- Desde `<MarkTodayControl>`: se encola como `PendingSighting` (`status:
  "pending"`), la UI pasa al estado "pendiente" (`offline-queue.md`).
- Desde `syncPendingSightings()`: `classifySyncError` → `"transient"` → la
  entrada queda en `pending`, se reintenta en el próximo disparador
  (`online`/`visibilitychange`/mount).
- Desde `<PastDayDialog>`: se muestra "sin conexión, intentá de nuevo" — no
  hay cola para este camino.

## Invariante que ningún llamador puede romper

Marcar el mismo `(pet_id, seen_on)` más de una vez —desde cualquier
combinación de los tres llamadores, online u offline— nunca produce más de
una fila en `sightings` para ese par. Lo garantiza la restricción `unique` de
la tabla vía el `on conflict ... do update` del RPC; ningún llamador necesita
(ni debe) chequear existencia antes de llamar.
