"use client"

// Control de un toque para marcar el día de hoy (FR-010/FR-011). Un fallo
// con código de error (RLS, FK) se muestra como error inline; un fallo sin
// código (sin conexión) encola en vez de solo avisar (User Story 5,
// FR-019/020/021) — misma función callMarkSighting que reintenta
// src/lib/offline/sync.ts, research.md §6.

import { useEffect, useState } from "react"
import { Check, Clock, X } from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import { callMarkSighting } from "@/lib/sightings"
import { mapPostgresError } from "@/lib/errors"
import { todayLocal } from "@/lib/dates"
import { enqueueSighting } from "@/lib/offline/queue"
import { subscribe } from "@/lib/offline/events"
import { usePendingSighting } from "@/hooks/use-pending-sighting"
import { AdminOnly } from "@/components/auth/admin-only"
import { Button } from "@/components/ui/button"

type MarkState =
  | { status: "idle" }
  | { status: "saving"; seen: boolean }
  | { status: "confirmed"; seen: boolean }
  | { status: "error"; message: string }

export function MarkTodayControl({
  petId,
  petSlug,
  petName,
  onMarked,
}: {
  petId: string
  petSlug: string
  petName: string
  onMarked?: () => void
}) {
  return (
    <AdminOnly>
      <MarkTodayControlInner petId={petId} petSlug={petSlug} petName={petName} onMarked={onMarked} />
    </AdminOnly>
  )
}

function MarkTodayControlInner({
  petId,
  petSlug,
  petName,
  onMarked,
}: {
  petId: string
  petSlug: string
  petName: string
  onMarked?: () => void
}) {
  const [state, setState] = useState<MarkState>({ status: "idle" })
  const pending = usePendingSighting(petId)

  // Una falla permanente detectada por el motor de sync (User Story 5,
  // contracts/offline-queue.md) revierte el estado optimista local — sin
  // esto el botón quedaría marcado como "confirmado" para siempre aunque el
  // día nunca haya quedado registrado en el servidor (el aviso global,
  // <SyncFailureBanner>, cubre la otra pantalla; acá se cubre esta).
  useEffect(() => {
    const today = todayLocal()
    return subscribe((event) => {
      if (event.type !== "sighting-sync-failed") return
      if (event.petId !== petId || event.seenOn !== today) return
      setState({ status: "error", message: event.reason })
    })
  }, [petId])

  async function handleMark(seen: boolean) {
    setState({ status: "saving", seen })
    const supabase = createClient()
    const date = todayLocal()
    const result = await callMarkSighting(supabase, { petId, seen, date })

    if ("error" in result) {
      if (!result.error.code) {
        // Sin conexión: encolar en vez de solo avisar. Optimista (research.md
        // §8) — el botón queda marcado de inmediato, igual que un éxito
        // online; el badge de reloj (usePendingSighting) es lo que distingue
        // "pendiente" de "confirmado" hasta que el motor de sync lo resuelva.
        await enqueueSighting({ petId, petSlug, petName, seenOn: date, seen })
        setState({ status: "confirmed", seen })
        return
      }
      setState({ status: "error", message: mapPostgresError(result.error) })
      return
    }

    setState({ status: "confirmed", seen: result.data.seen })
    onMarked?.()
  }

  const isSaving = state.status === "saving"
  const confirmedSeen = state.status === "confirmed" ? state.seen : null
  const effectiveSeen = pending !== null ? pending : confirmedSeen
  const seenIsActive = effectiveSeen === true
  const notThereIsActive = effectiveSeen === false
  const isPending = pending !== null

  return (
    <div className="flex flex-col gap-2">
      <div className="flex gap-2">
        <Button
          type="button"
          variant={seenIsActive ? "default" : "outline"}
          className="relative h-12 flex-1"
          disabled={isSaving}
          onClick={() => handleMark(true)}
        >
          <Check className="h-4 w-4" aria-hidden="true" />
          Visto hoy
          {isPending && seenIsActive && <Clock className="h-3.5 w-3.5" aria-hidden="true" />}
        </Button>
        <Button
          type="button"
          variant={notThereIsActive ? "default" : "outline"}
          className="relative h-12 flex-1"
          disabled={isSaving}
          onClick={() => handleMark(false)}
        >
          <X className="h-4 w-4" aria-hidden="true" />
          Revisado y no estaba
          {isPending && notThereIsActive && <Clock className="h-3.5 w-3.5" aria-hidden="true" />}
        </Button>
      </div>
      {isPending && (
        <p role="status" className="text-label text-muted-foreground">
          Pendiente de sincronizar — se guardó en el celular, se envía solo cuando vuelva la señal.
        </p>
      )}
      {state.status === "error" && (
        <p role="alert" className="text-label text-destructive">
          {state.message}
        </p>
      )}
    </div>
  )
}
