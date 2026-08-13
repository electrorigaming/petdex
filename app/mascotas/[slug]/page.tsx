import { notFound } from "next/navigation"
import Link from "next/link"
import { CaretLeftIcon } from "@phosphor-icons/react/dist/ssr/CaretLeft"
import { MilestoneTimeline } from "@/components/milestone-timeline"
import { PetDetail } from "@/components/pet-detail"
import { PetAdminActions } from "@/components/pets/pet-admin-actions"
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
    <main className="mx-auto max-w-[1180px] px-4 py-5 md:px-14 md:py-6">
      <Link
        href="/"
        className="mb-5 inline-flex w-fit items-center gap-1.5 text-meta text-neutral-500 hover:text-text"
      >
        <CaretLeftIcon size={14} aria-hidden="true" />
        Registro
      </Link>
      <div className="flex flex-col gap-5 md:grid md:grid-cols-[472px_minmax(0,1fr)] md:items-start md:gap-14">
        <div className="flex flex-col gap-5">
          <PetAdminActions slug={slug} petId={pet.id} petName={pet.name} />
          <PetDetail pet={pet} />
        </div>
        <div className="flex flex-col gap-6">
          <PetSightingsSection
            petId={pet.id}
            petSlug={slug}
            petName={pet.name}
            registeredOn={pet.registeredOn}
          />
          <MilestoneTimeline milestones={milestones} petSlug={slug} />
        </div>
      </div>
    </main>
  )
}
