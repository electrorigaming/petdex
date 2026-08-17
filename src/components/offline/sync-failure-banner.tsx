"use client"

// Aviso global de falla permanente de sincronización (FR-023/024,
// data-model.md "Dónde se ve un failed"). Montado junto a
// <OfflineSyncProvider> en app/layout.tsx: la falla puede ocurrir mientras la
// administradora está en cualquier pantalla, no necesariamente en la ficha
// de la mascota afectada — por eso no vive dentro de <MarkTodayControl> ni
// de <SightingCalendar>. petSlug/petName vienen del propio evento (ya
// denormalizados en PendingSighting, contracts/offline-queue.md), sin
// consulta adicional. Esta paleta no tiene color de peligro: el ícono de
// advertencia usa accent-text, nunca rojo.

import { useEffect, useState } from "react"
import { WarningIcon } from "@phosphor-icons/react/dist/ssr/Warning"
import { XIcon } from "@phosphor-icons/react/dist/ssr/X"
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
    <div className="flex flex-col gap-1.5 border-b border-hairline bg-surface px-3.5 py-2">
      {failures.map((failure) => (
        <div key={failure.key} role="alert" className="flex items-center gap-2.5 text-meta text-text">
          <WarningIcon size={15} className="shrink-0 text-accent-text" aria-hidden="true" />
          <span className="flex-1">
            No se pudo guardar el avistamiento de{" "}
            <Link href={`/mascotas/${failure.petSlug}`} className="text-accent-text hover:underline">
              {failure.petName}
            </Link>{" "}
            — {failure.reason}
          </span>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={() => handleDiscard(failure.key)}
            aria-label={`Descartar aviso de ${failure.petName}`}
          >
            <XIcon size={14} className="text-text-tertiary" aria-hidden="true" />
          </Button>
        </div>
      ))}
    </div>
  )
}
