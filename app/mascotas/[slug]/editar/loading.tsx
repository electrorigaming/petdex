import { PetFormSkeleton } from "@/components/skeletons/pet-form-skeleton"

export default function Loading() {
  return (
    <main className="mx-auto max-w-[1040px] px-4 py-6 md:px-14">
      <PetFormSkeleton />
    </main>
  )
}
