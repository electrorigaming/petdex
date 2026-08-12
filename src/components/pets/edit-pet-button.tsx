"use client"

// Mismo motivo que <AddPetButton>: arma su propio JSX del lado del cliente
// en vez de recibirlo como children de un Server Component, para que el
// payload RSC/HTML inicial no filtre "Editar" a un visitante sin sesión.
// `slug` es un dato plano (string), no JSX — serializarlo no filtra nada.

import Link from "next/link"
import { Pencil } from "lucide-react"
import { useSession } from "@/hooks/use-session"
import { Button } from "@/components/ui/button"

export function EditPetButton({ slug }: { slug: string }) {
  const { isAuthenticated, loading } = useSession()
  if (loading || !isAuthenticated) return null

  return (
    <div className="mb-4 flex justify-end">
      <Button asChild variant="outline">
        <Link href={`/mascotas/${slug}/editar`}>
          <Pencil className="h-4 w-4" aria-hidden="true" />
          Editar
        </Link>
      </Button>
    </div>
  )
}
