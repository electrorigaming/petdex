import { notFound } from "next/navigation"
import { MilestoneForm } from "@/components/milestones/milestone-form"
import { getPetBySlug } from "@/lib/pets"

export default async function NewMilestonePage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const pet = await getPetBySlug(slug)

  if (!pet) notFound()

  return (
    <main className="mx-auto max-w-screen-sm px-4 py-6 md:px-6">
      <h1 className="mb-6 text-h1 text-foreground">Agregar hito a {pet.name}</h1>
      <MilestoneForm mode="create" petId={pet.id} petSlug={slug} />
    </main>
  )
}
