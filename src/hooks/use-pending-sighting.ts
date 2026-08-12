"use client"

// Estado "pendiente de hoy" para una mascota, leído de la cola offline y
// mantenido al día por los eventos de src/lib/offline/events.ts en vez de
// hacer poll sobre IndexedDB (contracts/offline-queue.md). Devuelve `null`
// tanto para "no hay nada pendiente" como para una entrada "failed" — un
// fallido no cuenta como marcado (FR-024, data-model.md "CalendarDay.pending":
// solo status pending/syncing, nunca failed) y no debe sumar en el total del
// mes ni en la racha vía todayPendingValue (bridge US2 → US5,
// contracts/sightings-read.md).

import { useEffect, useState } from "react"
import { todayLocal } from "@/lib/dates"
import { getPendingForPet } from "@/lib/offline/queue"
import { subscribe } from "@/lib/offline/events"

export function usePendingSighting(petId: string): boolean | null {
  const [pending, setPending] = useState<boolean | null>(null)

  useEffect(() => {
    let cancelled = false
    const today = todayLocal()

    function refresh() {
      getPendingForPet(petId, today).then((entry) => {
        if (cancelled) return
        const isPending = entry !== null && (entry.status === "pending" || entry.status === "syncing")
        setPending(isPending ? entry.seen : null)
      })
    }

    refresh()

    const unsubscribe = subscribe((event) => {
      if (event.petId !== petId || event.seenOn !== today) return
      refresh()
    })

    return () => {
      cancelled = true
      unsubscribe()
    }
  }, [petId])

  return pending
}
