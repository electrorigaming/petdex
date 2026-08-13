"use client"

// Mismo patrón que <DeletePetButton>: confirmar borra de verdad ya
// (deleteMilestone trae una copia antes de borrar) — el hito desaparece de
// la lista al instante (optimista) y "Deshacer" restaura desde esa copia
// vía <DeleteUndoProvider> (Nocturne 1k). Un borrado diferido con setTimeout
// no sobrevive a un reload, así que ya no se usa ese enfoque.

import { useState } from "react"
import { TrashIcon } from "@phosphor-icons/react/dist/ssr/Trash"
import { deleteMilestone, restoreMilestone } from "@/lib/actions/milestones"
import { useDeleteUndo } from "@/components/delete-undo-context"
import { Button } from "@/components/ui/button"
import type { Milestone } from "@/lib/milestones"
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
  onRestored,
}: {
  milestoneId: string
  milestoneTitle: string
  petSlug: string
  onDeleted: (milestoneId: string) => void
  onRestored?: (milestone: Milestone) => void
}) {
  const { announceUndo } = useDeleteUndo()
  const [open, setOpen] = useState(false)
  const [deleting, setDeleting] = useState(false)

  async function handleConfirm() {
    setDeleting(true)
    const result = await deleteMilestone(milestoneId, petSlug)
    setDeleting(false)

    if (!result.ok) {
      console.error("No se pudo eliminar el hito:", result.message)
      return
    }

    setOpen(false)
    onDeleted(milestoneId)

    const { snapshot } = result
    announceUndo({
      message: `Se eliminó "${milestoneTitle}".`,
      restore: async () => {
        const restored = await restoreMilestone(snapshot, petSlug)
        if (restored.ok) {
          onRestored?.({
            id: snapshot.id,
            title: snapshot.title,
            occurredOn: snapshot.occurred_on,
            category: snapshot.category as Milestone["category"],
            note: snapshot.note,
          })
        } else {
          console.error("No se pudo restaurar el hito:", restored.message)
        }
      },
    })
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-[30px] w-[30px]"
          aria-label={`Borrar el hito ${milestoneTitle}`}
        >
          <TrashIcon size={15} className="text-neutral-500" aria-hidden="true" />
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <TrashIcon size={18} className="text-accent-400" aria-hidden="true" />
          <DialogTitle className="text-[18px]">¿Eliminar &quot;{milestoneTitle}&quot;?</DialogTitle>
        </DialogHeader>
        <DialogDescription>
          El hito desaparece de la ficha. Podés deshacerlo un rato después de confirmar.
        </DialogDescription>
        <DialogFooter>
          <Button variant="secondary" onClick={() => setOpen(false)} disabled={deleting}>
            Cancelar
          </Button>
          <Button variant="primary" onClick={handleConfirm} disabled={deleting}>
            {deleting ? "Eliminando…" : "Eliminar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
