import Link from "next/link"
import { Pencil } from "lucide-react"
import { notFound } from "next/navigation"
import { MilestoneTimeline } from "@/components/milestone-timeline"
import { PetDetail } from "@/components/pet-detail"
import { Button } from "@/components/ui/button"
import { getAllPetSlugs, getMilestonesForPet, getPetBySlug } from "@/lib/pets"
import { createClient } from "@/lib/supabase/server"

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

  const supabase = await createClient()
  const [milestones, { data: { user } }] = await Promise.all([
    getMilestonesForPet(pet.id),
    supabase.auth.getUser(),
  ])

  return (
    <main className="mx-auto max-w-screen-md px-4 py-6 md:px-6">
      {user && (
        <div className="mb-4 flex justify-end">
          <Button asChild variant="outline">
            <Link href={`/mascotas/${slug}/editar`}>
              <Pencil className="h-4 w-4" aria-hidden="true" />
              Editar
            </Link>
          </Button>
        </div>
      )}
      <PetDetail pet={pet} />
      <div className="mt-8">
        <MilestoneTimeline milestones={milestones} petSlug={slug} isAdmin={Boolean(user)} />
      </div>
    </main>
  )
}
