import { notFound } from "next/navigation"
import { PetForm } from "@/components/pets/pet-form"
import { getPetBySlug } from "@/lib/pets"
import type { PetFormValues } from "@/lib/validation/pet-schema"

export default async function EditPetPage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const pet = await getPetBySlug(slug)

  if (!pet) notFound()

  const initialValues: PetFormValues = {
    name: pet.name,
    nicknames: pet.nicknames,
    zone: pet.zone ?? undefined,
    location: pet.location ?? undefined,
    registeredOn: new Date(pet.registeredOn),
    ageEstimate: pet.ageEstimate ?? undefined,
    weightKg: pet.weightKg,
    description: pet.description ?? undefined,
    status: pet.status,
    sterilized: pet.sterilized,
  }

  return (
    <main className="mx-auto max-w-[1040px] px-4 py-6 md:px-14">
      <PetForm
        mode="edit"
        petId={pet.id}
        slug={slug}
        initialValues={initialValues}
        initialPhotoUrl={pet.photoUrl}
      />
    </main>
  )
}
