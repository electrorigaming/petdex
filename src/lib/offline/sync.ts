// Motor de sincronización de la cola offline (contracts/offline-queue.md).
// Único módulo que combina src/lib/offline/queue.ts (almacenamiento puro) con
// callMarkSighting (networking) — mismo código que <MarkTodayControl> llama
// online, la cola simplemente reintenta la misma función (research.md §6).

import { createClient } from "@/lib/supabase/client"
import { callMarkSighting } from "@/lib/sightings"
import { mapPostgresError } from "@/lib/errors"
import { emit } from "@/lib/offline/events"
import { classifySyncError } from "@/lib/offline/sync-errors"
import { getAllPending, markFailed, markPending, markSyncing, remove } from "@/lib/offline/queue"

export async function syncPendingSightings(): Promise<void> {
  if (typeof navigator !== "undefined" && !navigator.onLine) return

  const entries = await getAllPending()
  if (entries.length === 0) return

  const supabase = createClient()

  // "syncing" se incluye a propósito, no solo "pending": una entrada puede
  // quedar varada en "syncing" si la app se cierra a mitad de un intento
  // (por ejemplo, el celular se queda sin batería) — sin este tratamiento
  // esa entrada nunca se reintenta de nuevo, permanece "pendiente" en la UI
  // para siempre sin que ningún disparador vuelva a tocarla.
  const retryable = entries.filter((entry) => entry.status === "pending" || entry.status === "syncing")

  // Secuencial, nunca Promise.all — evita saturar la conexión justo cuando
  // se acaba de recuperar señal, que suele ser débil (contracts/offline-queue.md).
  for (const entry of retryable) {
    await markSyncing(entry.key)
    const result = await callMarkSighting(supabase, {
      petId: entry.petId,
      seen: entry.seen,
      date: entry.seenOn,
    })

    if (!("error" in result)) {
      await remove(entry.key)
      emit({ type: "sighting-confirmed", petId: entry.petId, seenOn: entry.seenOn })
      continue
    }

    if (classifySyncError(result.error) === "transient") {
      await markPending(entry.key)
      continue
    }

    const reason = mapPostgresError(result.error)
    await markFailed(entry.key, reason)
    emit({
      type: "sighting-sync-failed",
      petId: entry.petId,
      seenOn: entry.seenOn,
      petSlug: entry.petSlug,
      petName: entry.petName,
      reason,
    })
  }
}
