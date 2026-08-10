import Image from "next/image"
import { CalendarDays, ImageOff, MapPin } from "lucide-react"
import type { PetDetail as PetDetailType } from "@/lib/pets"

export function PetDetail({ pet }: { pet: PetDetailType }) {
  return (
    <div className="flex flex-col gap-6">
      <div className="relative aspect-[3/2] w-full overflow-hidden rounded-lg bg-muted">
        {pet.photoUrl ? (
          <Image
            src={pet.photoUrl}
            alt={pet.name}
            fill
            sizes="(min-width: 768px) 768px, 100vw"
            className="object-cover"
            priority
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center">
            <ImageOff className="h-10 w-10 text-muted-foreground" aria-label="Sin foto" />
          </div>
        )}
      </div>

      <div className="flex flex-col gap-2">
        <h1 className="text-h1 text-foreground">{pet.name}</h1>
        {pet.nicknames.length > 0 && (
          <p className="text-label text-muted-foreground">
            También conocido como {pet.nicknames.join(", ")}
          </p>
        )}
        {pet.zone && (
          <span className="flex items-center gap-1 text-label text-muted-foreground">
            <MapPin className="h-3.5 w-3.5" aria-hidden="true" />
            {pet.zone}
          </span>
        )}
        <span className="flex items-center gap-1 text-label text-muted-foreground">
          <CalendarDays className="h-3.5 w-3.5" aria-hidden="true" />
          Registrada el {pet.registeredOn}
        </span>
      </div>

      {(pet.location || pet.ageEstimate || pet.weightKg !== null) && (
        <dl className="grid grid-cols-2 gap-4">
          {pet.location && (
            <div>
              <dt className="text-caption text-muted-foreground">Ubicación</dt>
              <dd className="text-body text-card-foreground">{pet.location}</dd>
            </div>
          )}
          {pet.ageEstimate && (
            <div>
              <dt className="text-caption text-muted-foreground">Edad estimada</dt>
              <dd className="text-body text-card-foreground">{pet.ageEstimate}</dd>
            </div>
          )}
          {pet.weightKg !== null && (
            <div>
              <dt className="text-caption text-muted-foreground">Peso</dt>
              <dd className="text-body text-card-foreground">{pet.weightKg} kg</dd>
            </div>
          )}
        </dl>
      )}

      {pet.description && (
        <p className="text-body text-card-foreground">{pet.description}</p>
      )}
    </div>
  )
}
