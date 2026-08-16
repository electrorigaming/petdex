import { PetGridSkeleton } from "@/components/skeletons/pet-grid-skeleton"

export default function Loading() {
  return (
    <main className="mx-auto max-w-screen-xl px-4 py-6 md:px-14 md:py-6">
      <PetGridSkeleton />
    </main>
  )
}
