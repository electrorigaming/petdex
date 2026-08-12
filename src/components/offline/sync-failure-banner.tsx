"use client"

// Aviso global de falla permanente de sincronización (FR-023/024,
// data-model.md "Dónde se ve un failed"). Montado junto a
// <OfflineSyncProvider> en app/layout.tsx: la falla puede ocurrir mientras la
// administradora está en cualquier pantalla, no necesariamente en la ficha
// de la mascota afectada — por eso no vive dentro de <MarkTodayControl> ni
// de <SightingCalendar>. petSlug/petName vienen del propio evento (ya
// denormalizados en PendingSighting, contracts/offline-queue.md), sin
// consulta adicional.

import { useEffect, useState } from "react"
import { AlertTriangle, X as XIcon } from "lucide-react"
import Link from "next/link"
import { pendingKey, remove } from "@/lib/offline/queue"
import { subscribe } from "@/lib/offline/events"
import { Button } from "@/components/ui/button"

type Failure = {
  key: string
  petId: string
  petSlug: string
  petName: string
  seenOn: string
  reason: string
}

export function SyncFailureBanner() {
  const [failures, setFailures] = useState<Failure[]>([])

  useEffect(() => {
    return subscribe((event) => {
      if (event.type !== "sighting-sync-failed") return
      const key = pendingKey(event.petId, event.seenOn)
      setFailures((prev) => [
        ...prev.filter((f) => f.key !== key),
        {
          key,
          petId: event.petId,
          petSlug: event.petSlug,
          petName: event.petName,
          seenOn: event.seenOn,
          reason: event.reason,
        },
      ])
    })
  }, [])

  async function handleDiscard(key: string) {
    await remove(key)
    setFailures((prev) => prev.filter((f) => f.key !== key))
  }

  if (failures.length === 0) return null

  return (
    <div className="flex flex-col gap-2 bg-destructive/10 px-4 py-2">
      {failures.map((failure) => (
        <div
          key={failure.key}
          role="alert"
          className="flex items-center justify-between gap-3 text-label text-destructive"
        >
          <span className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 shrink-0" aria-hidden="true" />
            No se pudo registrar el avistamiento de{" "}
            <Link href={`/mascotas/${failure.petSlug}`} className="underline">
              {failure.petName}
            </Link>
            : {failure.reason}
          </span>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={() => handleDiscard(failure.key)}
            aria-label={`Descartar aviso de ${failure.petName}`}
          >
            <XIcon className="h-4 w-4" aria-hidden="true" />
          </Button>
        </div>
      ))}
    </div>
  )
}
