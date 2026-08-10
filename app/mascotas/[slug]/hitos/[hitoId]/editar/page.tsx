import { notFound } from "next/navigation"
import { MilestoneForm } from "@/components/milestones/milestone-form"
import { getMilestoneById } from "@/lib/pets"
import type { MilestoneFormValues } from "@/lib/validation/milestone-schema"

export default async function EditMilestonePage({
  params,
}: {
  params: Promise<{ slug: string; hitoId: string }>
}) {
  const { slug, hitoId } = await params
  const milestone = await getMilestoneById(hitoId)

  if (!milestone) notFound()

  const initialValues: MilestoneFormValues = {
    title: milestone.title,
    occurredOn: new Date(milestone.occurredOn),
    category: milestone.category ?? undefined,
    note: milestone.note ?? undefined,
  }

  return (
    <main className="mx-auto max-w-screen-sm px-4 py-6 md:px-6">
      <h1 className="mb-6 text-h1 text-foreground">Editar hito</h1>
      <MilestoneForm
        mode="edit"
        milestoneId={hitoId}
        petSlug={slug}
        initialValues={initialValues}
      />
    </main>
  )
}
