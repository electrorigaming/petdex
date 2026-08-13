"use client"

// Mismo motivo que <EditPetButton>: arma su propio JSX del lado del
// cliente, no lo recibe como children de un Server Component (evita la
// filtración del payload RSC/HTML documentada ahí). `petId`/`petName` son
// datos planos, no JSX — serializarlos no filtra nada.
//
// Confirmar borra de verdad ya (deletePet trae una copia completa antes de
// borrar); "Deshacer" restaura desde esa copia vía <DeleteUndoProvider>
// (Nocturne 1k, franja de Deshacer) — mismo patrón que
// <DeleteMilestoneDialog>. Ver delete-undo-context.tsx: un borrado diferido
// con setTimeout no sobrevive a un reload, así que ya no se usa ese enfoque.

import { useState } from "react"
import { useRouter } from "next/navigation"
import { TrashIcon } from "@phosphor-icons/react/dist/ssr/Trash"
import { WarningIcon } from "@phosphor-icons/react/dist/ssr/Warning"
import { deletePet, restorePet } from "@/lib/actions/pets"
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
  const { announceUndo } = useDeleteUndo()
  const [open, setOpen] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (loading || !isAuthenticated) return null

  async function handleConfirm() {
    setDeleting(true)
    setError(null)
    const result = await deletePet(petId)
    setDeleting(false)

    if (!result.ok) {
      setError(result.message)
      return
    }

    setOpen(false)
    router.push("/")
    router.refresh()

    const { snapshot } = result
    announceUndo({
      message: `Se eliminó a ${petName}.`,
      restore: async () => {
        const restored = await restorePet(snapshot)
        if (restored.ok) {
          router.push(`/mascotas/${restored.slug}`)
          router.refresh()
        } else {
          console.error("No se pudo restaurar la mascota:", restored.message)
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
          Se borran también sus hitos y avistamientos. Podés deshacerlo un rato después de
          confirmar.
        </DialogDescription>
        {error && (
          <p role="alert" className="flex items-center gap-1.5 text-meta text-accent-400">
            <WarningIcon size={14} aria-hidden="true" />
            {error}
          </p>
        )}
        <DialogFooter>
          <Button variant="secondary" onClick={() => setOpen(false)} disabled={deleting}>
            Cancelar
          </Button>
          <Button variant="primary" onClick={handleConfirm} disabled={deleting}>
            {deleting ? "Eliminando…" : "Sí, eliminar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
