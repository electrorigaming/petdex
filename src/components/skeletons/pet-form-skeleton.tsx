import { Skeleton } from "@/components/ui/skeleton"

function FieldSkeleton() {
  return (
    <div>
      <Skeleton className="mb-1.5 h-4 w-20" />
      <Skeleton className="h-10 w-full" />
    </div>
  )
}

function RadioGroupSkeleton({ options = 3 }: { options?: number }) {
  return (
    <div>
      <Skeleton className="mb-1.5 h-4 w-16" />
      <div className="mt-1.5 flex flex-wrap gap-4">
        {Array.from({ length: options }).map((_, i) => (
          <Skeleton key={i} className="h-5 w-16" />
        ))}
      </div>
    </div>
  )
}

// Misma forma que <PetForm>: título, campos a la izquierda, foto a la
// derecha en desktop, botones abajo.
export function PetFormSkeleton() {
  return (
    <div className="flex flex-col gap-6">
      <Skeleton className="h-7 w-56" />

      <div className="grid grid-cols-1 items-start gap-6 md:grid-cols-[minmax(0,1fr)_320px] md:gap-10">
        <div className="flex flex-col gap-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <FieldSkeleton />
            <FieldSkeleton />
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <FieldSkeleton />
            <FieldSkeleton />
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <FieldSkeleton />
            <FieldSkeleton />
            <FieldSkeleton />
          </div>
          <RadioGroupSkeleton options={4} />
          <RadioGroupSkeleton />
          <RadioGroupSkeleton options={2} />
          <RadioGroupSkeleton options={2} />
          <div>
            <Skeleton className="mb-1.5 h-4 w-24" />
            <Skeleton className="h-24 w-full" />
          </div>
        </div>

        <Skeleton className="aspect-square w-full" />
      </div>

      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <Skeleton className="h-10 w-24" />
        <Skeleton className="h-10 w-24" />
      </div>
    </div>
  )
}
