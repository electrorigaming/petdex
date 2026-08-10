import Image from "next/image"
import Link from "next/link"
import { ImageOff, MapPin } from "lucide-react"
import type { PetSummary } from "@/lib/pets"

export function PetCard({ pet }: { pet: PetSummary }) {
  return (
    <Link
      href={`/mascotas/${pet.slug}`}
      className="pet-card flex flex-col overflow-hidden rounded-lg border border-border bg-card transition-colors duration-150 hover:border-accent focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
    >
      <div className="pet-card-media relative w-full bg-muted">
        {pet.photoUrl ? (
          <Image
            src={pet.photoUrl}
            alt={pet.name}
            fill
            sizes="(min-width: 1440px) 25vw, (min-width: 1024px) 33vw, (min-width: 768px) 50vw, 100vw"
            className="object-cover"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center">
            <ImageOff
              className="h-6 w-6 text-muted-foreground"
              aria-label="Sin foto"
            />
          </div>
        )}
      </div>
      <div className="flex flex-1 flex-col gap-1 p-4">
        <span className="text-h2 font-semibold text-card-foreground">
          {pet.name}
        </span>
        {pet.zone && (
          <span className="flex items-center gap-1 text-label text-muted-foreground">
            <MapPin className="h-3.5 w-3.5" aria-hidden="true" />
            {pet.zone}
          </span>
        )}
      </div>
    </Link>
  )
}
