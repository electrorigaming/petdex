"use client"

// Mismo motivo que <AddPetButton>: arma su propio JSX del lado del
// cliente, no lo recibe como children de un Server Component (evita la
// filtración del payload RSC/HTML documentada ahí). `slug`/`visibility` son
// datos planos, no JSX — serializarlos no filtra nada. Una cuenta Usuario
// solo edita su propia mascota Privada — si `visibility` es "privado" y esta
// cuenta pudo cargar la ficha, por RLS ya es su creadora
// (007-roles-y-solicitudes, research.md §8).

import Link from "next/link"
import { PencilSimpleIcon } from "@phosphor-icons/react/dist/ssr/PencilSimple"
import { useSession } from "@/hooks/use-session"
import { Button } from "@/components/ui/button"
import type { PetVisibility } from "@/lib/validation/pet-schema"

export function EditPetButton({ slug, visibility }: { slug: string; visibility: PetVisibility }) {
  const { isAdmin, isEditor, loading } = useSession()
  const canWrite = isAdmin || (isEditor && visibility === "privado")
  if (loading || !canWrite) return null

  return (
    <Button asChild variant="ghost" className="text-meta">
      <Link href={`/mascotas/${slug}/editar`}>
        <PencilSimpleIcon size={15} aria-hidden="true" />
        Editar
      </Link>
    </Button>
  )
}
