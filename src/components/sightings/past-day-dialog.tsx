"use client"

// Corrección de un día pasado (User Story 3, FR-014). Siempre requiere
// conexión: un fallo se muestra inline y el diálogo no se cierra solo — no
// hay cola offline para este camino (Clarifications, spec.md;
// contracts/mark-sighting.md).
//
// Dos entradas, un solo diálogo (Nocturne 1l, "△"): abrirse ya apuntando a
// un día puntual (click en <DayCell>, fecha fija) o en modo "elegir
// cualquier fecha" (`editableDate`, botón "Corregir otro día…" — para no
// tener que navegar el calendario mes a mes buscando un día olvidado).
// Mismo flujo de callMarkSighting en ambos casos.

import { useState } from "react"
import { CheckIcon } from "@phosphor-icons/react/dist/ssr/Check"
import { XIcon } from "@phosphor-icons/react/dist/ssr/X"
import { WarningIcon } from "@phosphor-icons/react/dist/ssr/Warning"
import { WifiHighIcon } from "@phosphor-icons/react/dist/ssr/WifiHigh"
import { createClient } from "@/lib/supabase/client"
import { callMarkSighting } from "@/lib/sightings"
import { mapPostgresError } from "@/lib/errors"
import { formatLongDate } from "@/lib/dates"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

export function PastDayDialog({
  petId,
  date,
  editableDate = false,
  minDate,
  maxDate,
  onDateChange,
  onClose,
  onSaved,
}: {
  petId: string
  date: string | null
  editableDate?: boolean
  minDate?: string
  maxDate?: string
  onDateChange?: (date: string) => void
  onClose: () => void
  onSaved: () => void
}) {
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleMark(seen: boolean) {
    if (!date) return
    setSaving(true)
    setError(null)
    const supabase = createClient()
    const result = await callMarkSighting(supabase, { petId, seen, date })
    setSaving(false)

    if ("error" in result) {
      setError(
        result.error.code
          ? mapPostgresError(result.error)
          : "Sin conexión. Intentá de nuevo."
      )
      return
    }

    onSaved()
  }

  function handleOpenChange(open: boolean) {
    if (!open) {
      setError(null)
      onClose()
    }
  }

  return (
    <Dialog open={date !== null} onOpenChange={handleOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="text-[18px]">
            {editableDate ? "Corregir otro día" : date && formatLongDate(date)}
          </DialogTitle>
        </DialogHeader>
        {editableDate && date ? (
          <div className="field">
            <Label htmlFor="past-day-manual-date">Día</Label>
            <Input
              id="past-day-manual-date"
              type="date"
              value={date}
              min={minDate}
              max={maxDate}
              onChange={(e) => e.target.value && onDateChange?.(e.target.value)}
            />
          </div>
        ) : (
          <DialogDescription>Sin registro. ¿Qué pasó ese día?</DialogDescription>
        )}
        {error && (
          <p role="alert" className="flex items-center gap-1.5 text-meta text-accent-400">
            <WarningIcon size={14} aria-hidden="true" />
            {error}
          </p>
        )}
        <div className="flex gap-2.5">
          <Button
            type="button"
            variant="primary"
            className="min-h-11 flex-1"
            disabled={saving}
            onClick={() => handleMark(true)}
          >
            <CheckIcon size={15} aria-hidden="true" />
            Visto
          </Button>
          <Button
            type="button"
            variant="secondary"
            className="min-h-11 flex-1"
            disabled={saving}
            onClick={() => handleMark(false)}
          >
            <XIcon size={15} aria-hidden="true" />
            No Visto
          </Button>
        </div>
        <p className="flex items-center gap-1.5 text-meta text-neutral-600">
          <WifiHighIcon size={14} aria-hidden="true" />
          Corregir días pasados requiere conexión.
        </p>
      </DialogContent>
    </Dialog>
  )
}
