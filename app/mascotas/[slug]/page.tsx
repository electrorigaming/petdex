import { notFound } from "next/navigation"
import { MilestoneTimeline } from "@/components/milestone-timeline"
import { PetDetail } from "@/components/pet-detail"
import { EditPetButton } from "@/components/pets/edit-pet-button"
import { PetSightingsSection } from "@/components/sightings/pet-sightings-section"
import { getAllPetSlugs, getMilestonesForPet, getPetBySlug } from "@/lib/pets"

export const dynamicParams = true
export const revalidate = 0

export async function generateStaticParams() {
  const slugs = await getAllPetSlugs()
  return slugs.map((slug) => ({ slug }))
}

export default async function PetPage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const pet = await getPetBySlug(slug)

  if (!pet) notFound()

  const milestones = await getMilestonesForPet(pet.id)

  return (
    <main className="mx-auto max-w-screen-md px-4 py-6 md:px-6">
      <EditPetButton slug={slug} />
      <PetDetail pet={pet} />
      <div className="mt-6">
        <PetSightingsSection
          petId={pet.id}
          petSlug={slug}
          petName={pet.name}
          registeredOn={pet.registeredOn}
        />
      </div>
      <div className="mt-8">
        <MilestoneTimeline milestones={milestones} petSlug={slug} />
      </div>
    </main>
  )
}
