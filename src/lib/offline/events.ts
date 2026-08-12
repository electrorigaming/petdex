// EventTarget mínimo, sin librería — alcanza para que los hooks de React
// (use-pending-sighting.ts) reaccionen a cambios en la cola sin hacer poll
// sobre IndexedDB (contracts/offline-queue.md). Alcance de un solo
// tab/página, a propósito: spec.md no pide sincronizar el estado "pendiente"
// entre pestañas o dispositivos.

export type SyncEvent =
  | { type: "sighting-enqueued"; petId: string; seenOn: string }
  | { type: "sighting-confirmed"; petId: string; seenOn: string }
  | { type: "sighting-sync-failed"; petId: string; seenOn: string; petSlug: string; petName: string; reason: string }

const CUSTOM_EVENT_NAME = "petdex-sync"
const target = new EventTarget()

export function emit(event: SyncEvent): void {
  target.dispatchEvent(new CustomEvent(CUSTOM_EVENT_NAME, { detail: event }))
}

export function subscribe(fn: (event: SyncEvent) => void): () => void {
  function listener(e: Event) {
    fn((e as CustomEvent<SyncEvent>).detail)
  }
  target.addEventListener(CUSTOM_EVENT_NAME, listener)
  return () => target.removeEventListener(CUSTOM_EVENT_NAME, listener)
}
