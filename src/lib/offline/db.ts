// Base IndexedDB de la cola offline (contracts/offline-queue.md). Una sola
// base, un solo store: toda lectura relevante es "todos los pendientes"
// (motor de sync) o "el pendiente de esta mascota" (UI de un día), ninguna
// necesita un índice adicional.

import { openDB, type DBSchema, type IDBPDatabase } from "idb"

export type PendingSighting = {
  key: string // `${petId}:${seenOn}`
  petId: string
  petSlug: string
  petName: string
  seenOn: string // YYYY-MM-DD, capturado con todayLocal() al marcar
  seen: boolean
  queuedAt: string // ISO 8601, solo para UI — nunca se envía a mark_sighting
  status: "pending" | "syncing" | "failed"
  failureReason: string | null
}

interface PetDexOfflineDB extends DBSchema {
  pending_sightings: {
    key: string
    value: PendingSighting
  }
}

const DB_NAME = "petdex-offline"
const DB_VERSION = 1
const STORE_NAME = "pending_sightings"

let dbPromise: Promise<IDBPDatabase<PetDexOfflineDB>> | null = null

export function getOfflineDB(): Promise<IDBPDatabase<PetDexOfflineDB>> {
  dbPromise ??= openDB<PetDexOfflineDB>(DB_NAME, DB_VERSION, {
    upgrade(db) {
      db.createObjectStore(STORE_NAME, { keyPath: "key" })
    },
  })
  return dbPromise
}

export { STORE_NAME }
