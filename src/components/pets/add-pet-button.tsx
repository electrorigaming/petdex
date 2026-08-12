"use client"

// A propósito NO es <AdminOnly>{...JSX armado por un Server Component...}
// </AdminOnly>: los children de un Client Component pasados desde un
// Server Component se serializan igual en el payload RSC/HTML inicial,
// aunque el cliente después decida no renderizarlos — el string "Dar de
// alta" llegaría igual al navegador de un visitante sin sesión (verificado
// por tests/e2e/anonymous-visibility.spec.ts). Este botón arma su propio
// JSX enteramente del lado del cliente, así que si isAuthenticated es
// false no hay nada que serializar.

import Link from "next/link"
import { Plus } from "lucide-react"
import { useSession } from "@/hooks/use-session"
import { Button } from "@/components/ui/button"

export function AddPetButton() {
  const { isAuthenticated, loading } = useSession()
  if (loading || !isAuthenticated) return null

  return (
    <div className="mb-4 flex justify-end">
      <Button asChild>
        <Link href="/mascotas/nueva">
          <Plus className="h-4 w-4" aria-hidden="true" />
          Dar de alta
        </Link>
      </Button>
    </div>
  )
}
