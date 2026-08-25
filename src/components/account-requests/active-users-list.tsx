"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { ProhibitIcon } from "@phosphor-icons/react/dist/ssr/Prohibit"
import { WarningIcon } from "@phosphor-icons/react/dist/ssr/Warning"
import { revokeUsuario } from "@/lib/actions/account-requests"
import type { ActiveUsuario } from "@/lib/account-requests"
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

export function ActiveUsersList({ usuarios }: { usuarios: ActiveUsuario[] }) {
  return (
    <section className="flex flex-col gap-3">
      <h4 className="text-h5 text-text">Cuentas Usuario activas</h4>
      {usuarios.length === 0 ? (
        <p className="text-caption text-text-secondary">Todavía no hay ninguna cuenta Usuario.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {usuarios.map((usuario) => (
            <RevokeRow key={usuario.userId} usuario={usuario} />
          ))}
        </ul>
      )}
    </section>
  )
}

function RevokeRow({ usuario }: { usuario: ActiveUsuario }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [revoking, setRevoking] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleConfirm() {
    setRevoking(true)
    setError(null)
    const result = await revokeUsuario(usuario.userId)
    setRevoking(false)

    if (!result.ok) {
      setError(result.message)
      return
    }
    setOpen(false)
    router.refresh()
  }

  return (
    <li className="flex items-center justify-between gap-2 rounded-md bg-card px-3 py-2.5">
      <div>
        <p className="text-label font-medium text-card-foreground">{usuario.displayName}</p>
        <p className="text-meta text-text-secondary">{usuario.email}</p>
      </div>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          <Button type="button" variant="ghost" size="icon" title="Revocar acceso" aria-label={`Revocar acceso a ${usuario.displayName}`}>
            <ProhibitIcon size={16} className="text-text-tertiary" aria-hidden="true" />
          </Button>
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <ProhibitIcon size={20} className="text-accent-text" aria-hidden="true" />
            <DialogTitle>¿Revocar el acceso de {usuario.displayName}?</DialogTitle>
          </DialogHeader>
          <DialogDescription>
            Deja de poder agregar hitos, marcar avistamientos, o crear/editar/eliminar sus mascotas
            privadas. Sigue pudiendo iniciar sesión y mirar el registro público.
          </DialogDescription>
          {error && (
            <p role="alert" className="flex items-center gap-1.5 text-meta text-accent-text">
              <WarningIcon size={14} aria-hidden="true" />
              {error}
            </p>
          )}
          <DialogFooter>
            <Button variant="secondary" onClick={() => setOpen(false)} disabled={revoking}>
              Cancelar
            </Button>
            <Button variant="primary" onClick={handleConfirm} disabled={revoking}>
              {revoking ? "Revocando…" : "Sí, revocar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </li>
  )
}
