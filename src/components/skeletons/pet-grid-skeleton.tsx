import { Skeleton } from "@/components/ui/skeleton"

// Misma forma que <PetGrid> en su estado sin filtrar: contador + fila de
// controles + grilla de tarjetas. No replica el toggle grid/lista (es
// transitorio, no vale la complejidad) — siempre en forma de grilla.
export function PetGridSkeleton() {
  return (
    <div className="flex flex-col gap-4">
      <div>
        <Skeleton className="h-9 w-14" />
        <Skeleton className="mt-2 h-4 w-40" />
      </div>

      <div className="flex flex-wrap items-center gap-2.5">
        <Skeleton className="h-9 w-[130px] md:w-[190px]" />
        <Skeleton className="h-9 w-24" />
        <Skeleton className="h-9 w-28" />
        <Skeleton className="ml-auto h-9 w-[72px]" />
      </div>

      <div className="grid grid-cols-2 gap-[11px] md:grid-cols-3 md:gap-4 lg:grid-cols-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <Skeleton key={i} className="aspect-[4/5] w-full" />
        ))}
      </div>
    </div>
  )
}
