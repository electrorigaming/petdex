import { EmptyState } from "@/components/empty-states"
import { PetGrid } from "@/components/pet-grid"
import { getPetCount, getPetSummaries } from "@/lib/pets"

export default async function HomePage() {
  const [pets, total] = await Promise.all([getPetSummaries(), getPetCount()])

  return (
    <main className="mx-auto max-w-screen-xl px-4 py-6 md:px-6">
      {total === 0 ? <EmptyState /> : <PetGrid pets={pets} total={total} />}
    </main>
  )
}
