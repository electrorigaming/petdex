"use client"

// A propósito NO es <AdminOnly>{...JSX armado por un Server Component...}
// </AdminOnly>: los children de un Client Component pasados desde un
// Server Component se serializan igual en el payload RSC/HTML inicial,
// aunque el cliente después decida no renderizarlos — el string "Agregar"
// llegaría igual al navegador de un visitante sin sesión (verificado por
// tests/e2e/anonymous-visibility.spec.ts). Este botón arma su propio JSX
// enteramente del lado del cliente, así que si isAuthenticated es false no
// hay nada que serializar. Vive en <AppHeader> (Nocturne 1b/1c/1e-B: la
// acción de agregar se movió del cuerpo del catálogo al header) — icono
// solo en mobile, con texto en desktop.

import Link from "next/link"
import { PlusIcon } from "@phosphor-icons/react/dist/ssr/Plus"
import { useSession } from "@/hooks/use-session"
import { Button } from "@/components/ui/button"

export function AddPetButton() {
  const { isEditor, loading } = useSession()
  if (loading || !isEditor) return null

  return (
    <>
      <Button asChild variant="primary" size="icon" className="md:hidden" title="Agregar">
        <Link href="/mascotas/nueva" aria-label="Agregar">
          <PlusIcon size={16} aria-hidden="true" />
        </Link>
      </Button>
      <Button asChild variant="primary" className="hidden md:inline-flex">
        <Link href="/mascotas/nueva">
          <PlusIcon size={14} aria-hidden="true" />
          Agregar
        </Link>
      </Button>
    </>
  )
}
