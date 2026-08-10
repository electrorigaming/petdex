import Link from "next/link"
import { Plus } from "lucide-react"
import { EmptyState } from "@/components/empty-states"
import { PetGrid } from "@/components/pet-grid"
import { Button } from "@/components/ui/button"
import { getPetCount, getPetSummaries } from "@/lib/pets"
import { createClient } from "@/lib/supabase/server"

export default async function HomePage() {
  const supabase = await createClient()
  const [
    {
      data: { user },
    },
    pets,
    total,
  ] = await Promise.all([supabase.auth.getUser(), getPetSummaries(), getPetCount()])

  return (
    <main className="mx-auto max-w-screen-xl px-4 py-6 md:px-6">
      {user && (
        <div className="mb-4 flex justify-end">
          <Button asChild>
            <Link href="/mascotas/nueva">
              <Plus className="h-4 w-4" aria-hidden="true" />
              Dar de alta
            </Link>
          </Button>
        </div>
      )}
      {total === 0 ? <EmptyState /> : <PetGrid pets={pets} total={total} />}
    </main>
  )
}
