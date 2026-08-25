"use client"

// Agrupa <EditPetButton>/<DeletePetButton> en una sola fila, mostrada solo
// con sesión — evita que app/mascotas/[slug]/page.tsx (Server Component)
// renderice un contenedor vacío con margen para un visitante sin sesión.
// Mismo motivo que esos dos componentes: arma su JSX enteramente en cliente
// a partir de datos planos (slug/petId/petName), nunca recibe JSX como
// children de un Server Component. Separador vertical entre editar/eliminar
// (Nocturne 1g, "△ patrón único de acciones destructivas") — sin color de
// peligro, la jerarquía la da el aislamiento del ícono de tacho.

import { useSession } from "@/hooks/use-session"
import { EditPetButton } from "@/components/pets/edit-pet-button"
import { DeletePetButton } from "@/components/pets/delete-pet-button"
import type { PetVisibility } from "@/lib/validation/pet-schema"

export function PetAdminActions({
  slug,
  petId,
  petName,
  visibility,
}: {
  slug: string
  petId: string
  petName: string
  visibility: PetVisibility
}) {
  // Una cuenta Usuario solo edita/elimina su propia mascota Privada — si
  // `visibility` es "privado" y esta cuenta pudo cargar la ficha, por RLS ya
  // es su creadora (007-roles-y-solicitudes, research.md §8).
  const { isAdmin, isEditor, loading } = useSession()
  const canWrite = isAdmin || (isEditor && visibility === "privado")
  if (loading || !canWrite) return null

  return (
    <div className="flex items-center justify-end gap-1">
      <EditPetButton slug={slug} visibility={visibility} />
      <span className="mx-1.5 h-[18px] w-px bg-divider" aria-hidden="true" />
      <DeletePetButton petId={petId} petName={petName} visibility={visibility} />
    </div>
  )
}
