import Image from "next/image"
import { ImageSquareIcon } from "@phosphor-icons/react/dist/ssr/ImageSquare"
import { MapPinIcon } from "@phosphor-icons/react/dist/ssr/MapPin"
import { Badge } from "@/components/ui/badge"
import type { PetDetail as PetDetailType } from "@/lib/pets"
import { PET_STATUS_DISPLAY_LABEL, PET_GENDER_LABEL } from "@/lib/validation/pet-schema"

export function PetDetail({ pet }: { pet: PetDetailType }) {
  return (
    <div className="flex flex-col gap-6">
      <div className="relative aspect-[3/2] w-full overflow-hidden rounded-md bg-sunken">
        {pet.photoUrl ? (
          <Image
            src={pet.photoUrl}
            alt={pet.name}
            fill
            unoptimized
            className="lighten object-cover"
            priority
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center">
            <ImageSquareIcon size={40} className="text-neutral-700" aria-label="Sin foto" />
          </div>
        )}
      </div>

      <div>
        <h1 className="text-h3 md:text-h2 mb-1 text-foreground">{pet.name}</h1>
        {pet.nicknames.length > 0 && (
          <p className="text-label text-neutral-500">
            {pet.nicknames.map((n) => `"${n}"`).join(", ")}
          </p>
        )}
        <div className="mt-2.5 flex items-center gap-2.5">
          {pet.zone && (
            <Badge variant="neutral">
              <MapPinIcon size={12} className="mr-1" aria-hidden="true" />
              {pet.zone}
            </Badge>
          )}
          <Badge variant="outline">{PET_STATUS_DISPLAY_LABEL[pet.status]}</Badge>
          <Badge variant="outline">{PET_GENDER_LABEL[pet.gender]}</Badge>
          <Badge variant="outline">
            {pet.sterilized ? "Esterilizada" : "No esterilizada"}
          </Badge>
        </div>
      </div>

      <dl className="grid grid-cols-2 gap-x-3.5 gap-y-3.5">
        {pet.location && (
          <div>
            <dt className="text-legend uppercase tracking-wide text-neutral-600">Ubicación</dt>
            <dd className="mt-0.5 text-[15px] text-card-foreground">{pet.location}</dd>
          </div>
        )}
        {pet.ageEstimate && (
          <div>
            <dt className="text-legend uppercase tracking-wide text-neutral-600">Edad estimada</dt>
            <dd className="mt-0.5 text-[15px] text-card-foreground">{pet.ageEstimate}</dd>
          </div>
        )}
        {pet.weightKg !== null && (
          <div>
            <dt className="text-legend uppercase tracking-wide text-neutral-600">Peso</dt>
            <dd className="mt-0.5 text-[15px] text-card-foreground">{pet.weightKg} kg</dd>
          </div>
        )}
        <div>
          <dt className="text-legend uppercase tracking-wide text-neutral-600">En el registro</dt>
          <dd className="mt-0.5 text-[15px] text-card-foreground">{pet.registeredOn}</dd>
        </div>
      </dl>

      {pet.description && (
        <p className="max-w-[44ch] text-body text-card-foreground/90">{pet.description}</p>
      )}
    </div>
  )
}
