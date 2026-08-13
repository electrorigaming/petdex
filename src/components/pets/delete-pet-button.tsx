"use client"

// Mismo motivo que <EditPetButton>: arma su propio JSX del lado del
// cliente, no lo recibe como children de un Server Component (evita la
// filtración del payload RSC/HTML documentada ahí). `petId`/`petName` son
// datos planos, no JSX — serializarlos no filtra nada.
//
// Confirmar no borra al instante: navega a "/" y programa el borrado real
// 15s más tarde vía <DeleteUndoProvider> (Nocturne 1k, franja de Deshacer)
// — mismo patrón que <DeleteMilestoneDialog>.

import { useState } from "react"
import { useRouter } from "next/navigation"
import { TrashIcon } from "@phosphor-icons/react/dist/ssr/Trash"
import { deletePet } from "@/lib/actions/pets"
import { useSession } from "@/hooks/use-session"
import { useDeleteUndo } from "@/components/delete-undo-context"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"

export function DeletePetButton({ petId, petName }: { petId: string; petName: string }) {
  const { isAuthenticated, loading } = useSession()
  const router = useRouter()
  const { scheduleDelete } = useDeleteUndo()
  const [open, setOpen] = useState(false)

  if (loading || !isAuthenticated) return null

  function handleConfirm() {
    setOpen(false)
    router.push("/")
    router.refresh()
    scheduleDelete({
      message: `Se eliminó a ${petName}.`,
      commit: async () => {
        const result = await deletePet(petId)
        if (!result.ok) {
          // No hay dónde mostrar este error 15s después de cerrado el
          // diálogo — queda en consola para diagnóstico (mapPostgresError ya
          // se aplicó del lado de la Server Action, research.md Principio I).
          console.error("No se pudo eliminar la mascota:", result.message)
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
          title="Eliminar"
          aria-label={`Eliminar a ${petName}`}
        >
          <TrashIcon size={16} className="text-neutral-500" aria-hidden="true" />
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <TrashIcon size={20} className="text-accent-400" aria-hidden="true" />
          <DialogTitle>¿Eliminar a {petName}?</DialogTitle>
        </DialogHeader>
        <DialogDescription>
          Se borran también sus hitos y avistamientos. No se puede deshacer desde la app.
        </DialogDescription>
        <DialogFooter>
          <Button variant="secondary" onClick={() => setOpen(false)}>
            Cancelar
          </Button>
          <Button variant="primary" onClick={handleConfirm}>
            Sí, eliminar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
