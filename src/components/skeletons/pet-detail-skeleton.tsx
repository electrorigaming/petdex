import { Skeleton } from "@/components/ui/skeleton"

// Misma grilla de dos columnas que <PetPage> (ficha): imagen + datos a la
// izquierda, avistamientos + hitos a la derecha.
export function PetDetailSkeleton() {
  return (
    <div className="flex flex-col gap-5 md:grid md:grid-cols-[472px_minmax(0,1fr)] md:items-start md:gap-14">
      <div className="flex flex-col gap-5">
        <Skeleton className="aspect-[3/2] w-full" />
        <div>
          <Skeleton className="h-7 w-2/3" />
          <div className="mt-2.5 flex gap-2.5">
            <Skeleton className="h-6 w-20" />
            <Skeleton className="h-6 w-24" />
            <Skeleton className="h-6 w-28" />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3.5">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
        </div>
      </div>
      <div className="flex flex-col gap-6">
        <Skeleton className="h-64 w-full" />
        <Skeleton className="h-40 w-full" />
      </div>
    </div>
  )
}
