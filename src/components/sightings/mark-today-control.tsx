"use client"

// Control de un toque para marcar el día de hoy (FR-010/FR-011). Un fallo
// con código de error (RLS, FK) se muestra como error inline; un fallo sin
// código (sin conexión) encola en vez de solo avisar (User Story 5,
// FR-019/020/021) — misma función callMarkSighting que reintenta
// src/lib/offline/sync.ts, research.md §6. Copy y botones per Nocturne 1g:
// "Vista hoy" (btn-primary) / "Pasé y no estaba" (btn-secondary) — el
// tratamiento relleno adicional (bg-accent-fill / bg-text/7) marca cuál de
// los dos está confirmado hoy, sin abandonar el lenguaje de botón delineado.

import { useEffect, useState } from "react"
import { CheckIcon } from "@phosphor-icons/react/dist/ssr/Check"
import { XIcon } from "@phosphor-icons/react/dist/ssr/X"
import { WarningIcon } from "@phosphor-icons/react/dist/ssr/Warning"
import { createClient } from "@/lib/supabase/client"
import { callMarkSighting } from "@/lib/sightings"
import { mapPostgresError } from "@/lib/errors"
import { todayLocal } from "@/lib/dates"
import { enqueueSighting } from "@/lib/offline/queue"
import { subscribe } from "@/lib/offline/events"
import { usePendingSighting } from "@/hooks/use-pending-sighting"
import { EditorOnly } from "@/components/auth/editor-only"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

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
    <EditorOnly>
      <MarkTodayControlInner petId={petId} petSlug={petSlug} petName={petName} onMarked={onMarked} />
    </EditorOnly>
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
        // online; el punto de acento (usePendingSighting) es lo que
        // distingue "pendiente" de "confirmado" hasta que el motor de sync
        // lo resuelva.
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
    <div className="flex flex-col gap-3">
      <span className="text-h5 text-text">¿La viste hoy?</span>
      <div className="flex gap-2.5">
        <Button
          type="button"
          variant="primary"
          aria-pressed={seenIsActive}
          className={cn("min-h-12 flex-1 text-[15px]", seenIsActive && "bg-accent-fill")}
          disabled={isSaving}
          onClick={() => handleMark(true)}
        >
          <CheckIcon size={17} aria-hidden="true" />
          Visto
        </Button>
        <Button
          type="button"
          variant="secondary"
          aria-pressed={notThereIsActive}
          className={cn("min-h-12 flex-1 text-[15px]", notThereIsActive && "bg-text/[.07]")}
          disabled={isSaving}
          onClick={() => handleMark(false)}
        >
          <XIcon size={16} aria-hidden="true" />
          No Visto
        </Button>
      </div>
      {isPending && (
        <p role="status" className="flex items-center gap-1.5 text-meta text-text-secondary">
          <span className="h-2 w-2 rounded-full bg-accent" aria-hidden="true" />
          Marcada hoy sin conexión — se sincroniza sola cuando vuelva la señal.
        </p>
      )}
      {state.status === "error" && (
        <p role="alert" className="flex items-center gap-1.5 text-meta text-accent-text">
          <WarningIcon size={14} aria-hidden="true" />
          {state.message}
        </p>
      )}
    </div>
  )
}
