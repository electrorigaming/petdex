"use client"

// Mismo patrón que <DeletePetButton>: confirmar no borra al instante — el
// hito desaparece de la lista ya (optimista) y el borrado real en el
// servidor se programa 15s después vía <DeleteUndoProvider> (Nocturne 1k).

import { useState } from "react"
import { TrashIcon } from "@phosphor-icons/react/dist/ssr/Trash"
import { deleteMilestone } from "@/lib/actions/milestones"
import { useDeleteUndo } from "@/components/delete-undo-context"
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
  const { scheduleDelete } = useDeleteUndo()
  const [open, setOpen] = useState(false)

  function handleConfirm() {
    setOpen(false)
    onDeleted(milestoneId)
    scheduleDelete({
      message: `Se eliminó "${milestoneTitle}".`,
      commit: async () => {
        const result = await deleteMilestone(milestoneId, petSlug)
        if (!result.ok) {
          console.error("No se pudo eliminar el hito:", result.message)
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
        <DialogDescription>El hito desaparece de la ficha. No se puede deshacer.</DialogDescription>
        <DialogFooter>
          <Button variant="secondary" onClick={() => setOpen(false)}>
            Cancelar
          </Button>
          <Button variant="primary" onClick={handleConfirm}>
            Eliminar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
