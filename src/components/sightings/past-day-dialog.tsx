"use client"

// Corrección de un día pasado desde el calendario (User Story 3, FR-014).
// Siempre requiere conexión: un fallo se muestra inline y el diálogo no se
// cierra solo — no hay cola offline para este camino (Clarifications,
// spec.md; contracts/mark-sighting.md).

import { useState } from "react"
import { Check, X } from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import { callMarkSighting } from "@/lib/sightings"
import { mapPostgresError } from "@/lib/errors"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

export function PastDayDialog({
  petId,
  date,
  onClose,
  onSaved,
}: {
  petId: string
  date: string | null
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
          <DialogTitle>Registrar el {date}</DialogTitle>
          <DialogDescription>Elegí el estado de ese día.</DialogDescription>
        </DialogHeader>
        {error && (
          <p role="alert" className="text-label text-destructive">
            {error}
          </p>
        )}
        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            disabled={saving}
            onClick={() => handleMark(false)}
          >
            <X className="h-4 w-4" aria-hidden="true" />
            Revisado y no estaba
          </Button>
          <Button type="button" variant="default" disabled={saving} onClick={() => handleMark(true)}>
            <Check className="h-4 w-4" aria-hidden="true" />
            Visto
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
