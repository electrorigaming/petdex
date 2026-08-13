"use client"

// Mismo motivo que <AddPetButton>: arma su propio JSX del lado del
// cliente, no lo recibe como children de un Server Component (evita la
// filtración del payload RSC/HTML documentada ahí). `slug` es un dato plano
// (string), no JSX — serializarlo no filtra nada.

import Link from "next/link"
import { PencilSimpleIcon } from "@phosphor-icons/react/dist/ssr/PencilSimple"
import { useSession } from "@/hooks/use-session"
import { Button } from "@/components/ui/button"

export function EditPetButton({ slug }: { slug: string }) {
  const { isAuthenticated, loading } = useSession()
  if (loading || !isAuthenticated) return null

  return (
    <Button asChild variant="ghost" className="text-meta">
      <Link href={`/mascotas/${slug}/editar`}>
        <PencilSimpleIcon size={15} aria-hidden="true" />
        Editar
      </Link>
    </Button>
  )
}
