import { Skeleton } from "@/components/ui/skeleton"

export default function Loading() {
  return (
    <main className="mx-auto flex min-h-[70vh] max-w-sm flex-col justify-center gap-5 px-4 py-6">
      <Skeleton className="h-7 w-32" />
      <div>
        <Skeleton className="h-6 w-48" />
        <Skeleton className="mt-2 h-4 w-full" />
        <Skeleton className="mt-1 h-4 w-3/4" />
      </div>
      <Skeleton className="h-10 w-full" />
      <Skeleton className="mx-auto h-4 w-28" />
    </main>
  )
}
