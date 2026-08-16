import { Skeleton } from "@/components/ui/skeleton"

// Misma forma que <MilestoneForm>: título de la página + campos angostos
// en una sola columna (max-w-[420px] en el form real).
export function MilestoneFormSkeleton() {
  return (
    <div>
      <Skeleton className="mb-4 h-6 w-48" />
      <div className="flex max-w-[420px] flex-col gap-4">
        <div>
          <Skeleton className="mb-1.5 h-4 w-14" />
          <Skeleton className="h-10 w-full" />
        </div>
        <div>
          <Skeleton className="mb-1.5 h-4 w-14" />
          <Skeleton className="h-10 w-full" />
        </div>
        <div>
          <Skeleton className="mb-1.5 h-4 w-20" />
          <div className="mt-1.5 flex flex-wrap gap-2">
            <Skeleton className="h-7 w-16" />
            <Skeleton className="h-7 w-20" />
            <Skeleton className="h-7 w-28" />
            <Skeleton className="h-7 w-16" />
          </div>
        </div>
        <div>
          <Skeleton className="mb-1.5 h-4 w-12" />
          <Skeleton className="h-20 w-full" />
        </div>
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Skeleton className="h-10 w-24" />
          <Skeleton className="h-10 w-24" />
        </div>
      </div>
    </div>
  )
}
