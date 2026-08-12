// API de almacenamiento de la cola offline (contracts/offline-queue.md).
// Ninguna función de este módulo hace networking — src/lib/offline/sync.ts
// es el único módulo que combina esta API con mark-sighting.md.

import { getOfflineDB, STORE_NAME, type PendingSighting } from "@/lib/offline/db"
import { emit } from "@/lib/offline/events"

export type { PendingSighting }

export function pendingKey(petId: string, seenOn: string): string {
  return `${petId}:${seenOn}`
}

export async function enqueueSighting(entry: {
  petId: string
  petSlug: string
  petName: string
  seenOn: string
  seen: boolean
}): Promise<void> {
  const db = await getOfflineDB()
  const key = pendingKey(entry.petId, entry.seenOn)

  await db.put(STORE_NAME, {
    key,
    petId: entry.petId,
    petSlug: entry.petSlug,
    petName: entry.petName,
    seenOn: entry.seenOn,
    seen: entry.seen,
    queuedAt: new Date().toISOString(),
    status: "pending",
    failureReason: null,
  })

  emit({ type: "sighting-enqueued", petId: entry.petId, seenOn: entry.seenOn })
}

export async function getPendingForPet(
  petId: string,
  seenOn: string
): Promise<PendingSighting | null> {
  const db = await getOfflineDB()
  const entry = await db.get(STORE_NAME, pendingKey(petId, seenOn))
  return entry ?? null
}

export async function getAllPending(): Promise<PendingSighting[]> {
  const db = await getOfflineDB()
  return db.getAll(STORE_NAME)
}

export async function markSyncing(key: string): Promise<void> {
  const db = await getOfflineDB()
  const entry = await db.get(STORE_NAME, key)
  if (!entry) return
  await db.put(STORE_NAME, { ...entry, status: "syncing" })
}

export async function markPending(key: string): Promise<void> {
  const db = await getOfflineDB()
  const entry = await db.get(STORE_NAME, key)
  if (!entry) return
  await db.put(STORE_NAME, { ...entry, status: "pending" })
}

export async function markFailed(key: string, reason: string): Promise<void> {
  const db = await getOfflineDB()
  const entry = await db.get(STORE_NAME, key)
  if (!entry) return
  await db.put(STORE_NAME, { ...entry, status: "failed", failureReason: reason })
}

export async function remove(key: string): Promise<void> {
  const db = await getOfflineDB()
  await db.delete(STORE_NAME, key)
}
