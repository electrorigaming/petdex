import { PetGrid } from "@/components/pet-grid"
import { getPetCount, getPetSummaries } from "@/lib/pets"

export default async function HomePage() {
  const [pets, total] = await Promise.all([getPetSummaries(), getPetCount()])

  return (
    <main className="mx-auto max-w-screen-xl px-4 py-6 md:px-14 md:py-6">
      <PetGrid pets={pets} total={total} />
    </main>
  )
}
