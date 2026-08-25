"use client"

// Botón de un toque para marcar el día de hoy desde la cuadrícula, sin
// entrar a la ficha (misma lógica que <MarkTodayControl>: callMarkSighting,
// cola offline, estado optimista). A diferencia de la ficha, acá SÍ importa
// mostrar el valor real que trae el servidor al montar (pet.todayValue) —
// en la ficha el calendario de abajo es la fuente de verdad, pero acá la
// tarjeta es la única vista, así que el ícono tiene que reflejar lo que ya
// se marcó antes, no solo lo que se toca en esta sesión.
//
// Un solo botón, dos valores, nunca vuelve a "sin_registro": cada toque
// alterna entre "visto" y "revisado y no estaba" (decisión del producto,
// no técnica — mark_sighting no borra filas, solo hace upsert).

import { useEffect, useState } from "react"
import { CheckCircleIcon } from "@phosphor-icons/react/dist/ssr/CheckCircle"
import { XCircleIcon } from "@phosphor-icons/react/dist/ssr/XCircle"
import { CircleIcon } from "@phosphor-icons/react/dist/ssr/Circle"
import { createClient } from "@/lib/supabase/client"
import { callMarkSighting, type CalendarDayValue } from "@/lib/sightings"
import { mapPostgresError } from "@/lib/errors"
import { todayLocal } from "@/lib/dates"
import { enqueueSighting } from "@/lib/offline/queue"
import { subscribe } from "@/lib/offline/events"
import { usePendingSighting } from "@/hooks/use-pending-sighting"
import { EditorOnly } from "@/components/auth/editor-only"
import { cn } from "@/lib/utils"

const NEXT_SEEN: Record<CalendarDayValue, boolean> = {
  sin_registro: true,
  revisado_no_estaba: true,
  visto: false,
}

const LABEL: Record<CalendarDayValue, string> = {
  visto: "Visto hoy — tocar para marcar que no estaba",
  revisado_no_estaba: "No estaba hoy — tocar para marcar visto",
  sin_registro: "Sin marcar hoy — tocar para marcar visto",
}

export function MarkTodayToggle(props: {
  petId: string
  petSlug: string
  petName: string
  initialValue: CalendarDayValue
  className?: string
}) {
  return (
    <EditorOnly>
      <MarkTodayToggleInner {...props} />
    </EditorOnly>
  )
}

function MarkTodayToggleInner({
  petId,
  petSlug,
  petName,
  initialValue,
  className,
}: {
  petId: string
  petSlug: string
  petName: string
  initialValue: CalendarDayValue
  className?: string
}) {
  const [confirmed, setConfirmed] = useState<CalendarDayValue | null>(null)
  const [saving, setSaving] = useState(false)
  const pending = usePendingSighting(petId)

  // Misma reversión que <MarkTodayControl> ante un fallo permanente de sync:
  // sin esto el ícono quedaría "confirmado" para siempre aunque el día nunca
  // se haya guardado. El aviso global (<SyncFailureBanner>) ya cubre el
  // mensaje, acá solo importa no mentir sobre el estado.
  useEffect(() => {
    const today = todayLocal()
    return subscribe((event) => {
      if (event.type !== "sighting-sync-failed") return
      if (event.petId !== petId || event.seenOn !== today) return
      setConfirmed(null)
    })
  }, [petId])

  const value: CalendarDayValue =
    pending !== null ? (pending ? "visto" : "revisado_no_estaba") : (confirmed ?? initialValue)
  const isPending = pending !== null

  async function handleClick() {
    const seen = NEXT_SEEN[value]
    setSaving(true)
    const supabase = createClient()
    const date = todayLocal()
    const result = await callMarkSighting(supabase, { petId, seen, date })

    if ("error" in result) {
      if (!result.error.code) {
        await enqueueSighting({ petId, petSlug, petName, seenOn: date, seen })
        setConfirmed(seen ? "visto" : "revisado_no_estaba")
        setSaving(false)
        return
      }
      // Fallo online inmediato (RLS, FK): no hay mensaje inline por espacio
      // en la tarjeta — mismo criterio que el resto de la cuadrícula, que no
      // muestra errores por tarjeta. El error queda solo en consola.
      console.error(mapPostgresError(result.error))
      setSaving(false)
      return
    }

    setConfirmed(result.data.seen ? "visto" : "revisado_no_estaba")
    setSaving(false)
  }

  return (
    <button
      type="button"
      aria-label={LABEL[value]}
      aria-pressed={value === "visto"}
      disabled={saving}
      onClick={handleClick}
      className={cn(
        "relative inline-flex h-9 w-9 items-center justify-center rounded-full border border-divider bg-card text-text-secondary shadow-sm transition-colors duration-150 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:opacity-60",
        value === "visto" && "border-accent text-accent-text",
        value === "revisado_no_estaba" && "text-text",
        className
      )}
    >
      {value === "visto" && <CheckCircleIcon size={20} weight="fill" aria-hidden="true" />}
      {value === "revisado_no_estaba" && <XCircleIcon size={20} weight="fill" aria-hidden="true" />}
      {value === "sin_registro" && <CircleIcon size={20} aria-hidden="true" />}
      {isPending && (
        <span
          className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full bg-accent"
          aria-hidden="true"
        />
      )}
    </button>
  )
}
