import { Skeleton } from "@/components/ui/skeleton"
import { PetDetailSkeleton } from "@/components/skeletons/pet-detail-skeleton"

export default function Loading() {
  return (
    <main className="mx-auto max-w-[1180px] px-4 py-5 md:px-14 md:py-6">
      <Skeleton className="mb-5 h-4 w-20" />
      <PetDetailSkeleton />
    </main>
  )
}
