# Contract: Cola offline (IndexedDB)

Contrato interno cliente-a-cliente (módulo de cola ↔ componentes de UI ↔
motor de sincronización) — no hay servidor involucrado hasta el momento del
intento de sync, que sigue `mark-sighting.md`.

## Base y store

```ts
// src/lib/offline/db.ts
import { openDB, type DBSchema } from "idb"

interface PetDexOfflineDB extends DBSchema {
  pending_sightings: {
    key: string // `${petId}:${seenOn}`
    value: PendingSighting // ver data-model.md
  }
}

const DB_NAME = "petdex-offline"
const DB_VERSION = 1
```

Una sola base, un solo store — no hay necesidad de índices adicionales: toda
lectura relevante es "todos los pendientes" (`getAll()`, para el motor de
sync) o "el pendiente de esta mascota" (`get(key)`, para la UI de un día).

## API del módulo (`src/lib/offline/queue.ts`)

```ts
function pendingKey(petId: string, seenOn: string): string

async function enqueueSighting(entry: {
  petId: string
  petSlug: string
  petName: string
  seenOn: string
  seen: boolean
}): Promise<void>
// put() sobre pendingKey(petId, seenOn) — sobrescribe si ya existía
// (pending o failed), status siempre vuelve a "pending", queuedAt = ahora.
// petSlug/petName vienen de la ficha ya cargada (nunca de una consulta
// nueva) — sirven solo para que <SyncFailureBanner> pueda mostrar un aviso
// legible sin depender de red si la sincronización falla más tarde.

async function getPendingForPet(petId: string, seenOn: string): Promise<PendingSighting | null>

async function getAllPending(): Promise<PendingSighting[]>
// usado solo por el motor de sync.

async function markSyncing(key: string): Promise<void>
async function markFailed(key: string, reason: string): Promise<void>
async function remove(key: string): Promise<void>
// remove() se llama tanto en éxito de sync como en descarte manual (FR-024)
// — el llamador decide cuál de los dos es.
```

Ninguna función de este módulo hace networking — es exclusivamente
almacenamiento. `src/lib/offline/sync.ts` es el único módulo que combina esta
API con `mark-sighting.md`.

## Motor de sincronización (`src/lib/offline/sync.ts`)

```ts
async function syncPendingSightings(): Promise<void>
```

1. Si `!navigator.onLine`, retorna sin hacer nada.
2. `entries = await getAllPending()`; si está vacío, retorna.
3. Para cada entrada con `status === "pending"` (las `"failed"` se saltan —
   no se reintentan solas, `sync-errors.md`/research.md §4):
   - `markSyncing(entry.key)`.
   - Llama `mark_sighting` con `{ p_pet_id: entry.petId, p_seen: entry.seen,
     p_date: entry.seenOn }` (`mark-sighting.md`).
   - Éxito → `remove(entry.key)`, emite `sighting-confirmed` (`events.ts`)
     con `{ petId, seenOn }`.
   - Error transitorio → vuelve a `status: "pending"` (no se toca
     `failureReason`), sin emitir evento — se reintenta en el próximo
     disparador.
   - Error permanente → `markFailed(entry.key, mapPostgresError(error))`,
     emite `sighting-sync-failed` con `{ petId, seenOn, reason }`.
4. Las entradas se procesan en secuencia, no en paralelo — evita saturar la
   conexión justo cuando se acaba de recuperar señal, que suele ser débil.

## Eventos (`src/lib/offline/events.ts`)

`EventTarget` mínimo, sin librería — alcanza para que los hooks de React
(`use-pending-sighting.ts`) reaccionen sin hacer poll sobre IndexedDB:

```ts
type SyncEvent =
  | { type: "sighting-enqueued"; petId: string; seenOn: string }
  | { type: "sighting-confirmed"; petId: string; seenOn: string }
  | { type: "sighting-sync-failed"; petId: string; seenOn: string; reason: string }

const syncEvents = new EventTarget()
export function emit(event: SyncEvent): void
export function subscribe(fn: (event: SyncEvent) => void): () => void // devuelve unsubscribe
```

Alcance de un solo tab/página — no hay requisito de sincronizar el estado
"pendiente" entre pestañas o dispositivos abiertos al mismo tiempo (spec.md
no lo pide; la resolución final en el servidor sigue siendo "gana el último
valor" sin importar cuántos clientes escribieron).

**Suscriptores de `sighting-sync-failed`**: no solo el día del calendario de
la mascota afectada (que puede no estar visible en ese momento) — también
`<SyncFailureBanner>`, montado globalmente junto a `<OfflineSyncProvider>`
(`app/layout.tsx`), que muestra el aviso de FR-023 sin importar en qué
pantalla esté la administradora cuando la falla ocurre, usando `petSlug` /
`petName` ya guardados en la propia `PendingSighting` (data-model.md) para
no depender de una consulta adicional. El control de descarte de FR-024 vive
ahí mismo — descartar llama `remove(key)` igual que un descarte hecho desde
la ficha.

## Disparadores (montados una sola vez, en `<OfflineSyncProvider>`)

```ts
window.addEventListener("online", syncPendingSightings)
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "visible") syncPendingSightings()
})
// + una llamada directa al montar el provider
```

## Lo que la UI puede asumir de este contrato

- Un día puede estar en, como mucho, uno de: sin registro, confirmado
  (visto/revisado), pendiente, o fallido — nunca dos a la vez, porque la
  clave de la cola coincide 1:1 con la clave única de `sightings`.
- El total del mes y la racha (`data-model.md`) leen `pending` como si fuera
  "visto" cuando corresponde, sin esperar a que este motor corra — la UI no
  necesita distinguir "todavía no intenté sincronizar" de "ya lo intenté y
  sigue pendiente", ambos se ven igual (Clarifications, spec.md).
- Una entrada `failed` nunca desaparece sola; solo por acción explícita de la
  administradora (descartar, o volver a marcar el mismo día).
