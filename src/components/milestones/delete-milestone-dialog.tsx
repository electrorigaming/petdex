"use client"

import { useState } from "react"
import { Trash2 } from "lucide-react"
import { deleteMilestone } from "@/lib/actions/milestones"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogTrigger,
} from "@/components/ui/dialog"

export function DeleteMilestoneDialog({
  milestoneId,
  milestoneTitle,
  petSlug,
  onDeleted,
}: {
  milestoneId: string
  milestoneTitle: string
  petSlug: string
  onDeleted: (milestoneId: string) => void
}) {
  const [open, setOpen] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleConfirm() {
    setDeleting(true)
    setError(null)
    const result = await deleteMilestone(milestoneId, petSlug)
    setDeleting(false)

    if (!result.ok) {
      setError(result.message)
      return
    }
    setOpen(false)
    onDeleted(milestoneId)
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button type="button" variant="ghost" size="icon" aria-label={`Borrar el hito ${milestoneTitle}`}>
          <Trash2 className="h-4 w-4" aria-hidden="true" />
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>¿Borrar el hito &quot;{milestoneTitle}&quot;?</DialogTitle>
          <DialogDescription>Esta acción no se puede deshacer.</DialogDescription>
        </DialogHeader>
        {error && (
          <p role="alert" className="text-label text-destructive">
            {error}
          </p>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} disabled={deleting}>
            Cancelar
          </Button>
          <Button variant="default" onClick={handleConfirm} disabled={deleting}>
            {deleting ? "Borrando…" : "Confirmar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
