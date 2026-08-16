import Image from "next/image"
import Link from "next/link"
import { ImageSquareIcon } from "@phosphor-icons/react/dist/ssr/ImageSquare"
import { MapPinIcon } from "@phosphor-icons/react/dist/ssr/MapPin"
import { CheckCircleIcon } from "@phosphor-icons/react/dist/ssr/CheckCircle"
import { GenderNeuterIcon } from "@phosphor-icons/react/dist/ssr/GenderNeuter"
import { LockSimpleIcon } from "@phosphor-icons/react/dist/ssr/LockSimple"
import { Badge } from "@/components/ui/badge"
import { daysBetween, todayLocal } from "@/lib/dates"
import type { PetSummary } from "@/lib/pets"

// Un solo árbol de DOM sirve para las dos vistas (cuadrícula = retrato 4:5
// con overlay, lista = fila con thumb) — el layout lo decide app/globals.css
// vía el atributo data-view en <html>, nunca un re-render condicional, así
// que no hay riesgo de parpadeo/mismatch de hidratación entre SSR y cliente
// (mismo criterio que ya usaba el componente antes de este rediseño).
export function PetCard({ pet }: { pet: PetSummary }) {
  const today = todayLocal()
  const daysSinceSeen = pet.lastSeenOn ? daysBetween(pet.lastSeenOn, today) : null

  return (
    <Link
      href={`/mascotas/${pet.slug}`}
      className="pet-card group relative flex flex-col overflow-hidden rounded-md bg-card transition-colors duration-150 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
    >
      <div className="pet-card-media relative w-full">
        {pet.photoUrl ? (
          <Image src={pet.photoUrl} alt={pet.name} fill unoptimized className="lighten object-cover" />
        ) : (
          <div className="flex h-full w-full items-center justify-center">
            <ImageSquareIcon size={22} className="text-neutral-800" aria-label="Sin foto" />
          </div>
        )}
      </div>

      {/* Cuadrícula: nombre/zona sobre un degradado encima de la foto. */}
      <div
        className="pet-card-overlay absolute inset-x-0 bottom-0 px-2.5 pb-2.5 pt-8"
        style={{
          background:
            "linear-gradient(to top, #12131f 12%, rgba(18,19,31,.7) 55%, transparent)",
        }}
      >
        <div className="text-[15px] font-medium text-text">{pet.name}</div>
        {pet.zone && (
          <div className="mt-0.5 flex items-center gap-1 text-caption text-neutral-300">
            <MapPinIcon size={12} aria-hidden="true" />
            {pet.zone}
          </div>
        )}
      </div>
      {pet.seenToday ? (
        <Badge variant="accent" className="pet-card-tag absolute left-2 top-2">
          Hoy
        </Badge>
      ) : (
        daysSinceSeen === 1 && (
          <Badge variant="neutral" className="pet-card-tag absolute left-2 top-2">
            Ayer
          </Badge>
        )
      )}
      {(pet.sterilized || pet.visibility === "privado") && (
        <div className="pet-card-tag absolute right-2 top-2 flex flex-col items-end gap-1">
          {pet.sterilized && (
            <Badge variant="neutral" aria-label="Esterilizada">
              <GenderNeuterIcon size={12} aria-hidden="true" />
            </Badge>
          )}
          {pet.visibility === "privado" && (
            <Badge variant="neutral" aria-label="Privada">
              <LockSimpleIcon size={12} aria-hidden="true" />
            </Badge>
          )}
        </div>
      )}

      {/* Lista: nombre + apodo · zona a la izquierda, estado a la derecha. */}
      <div className="pet-card-row-text min-w-0 flex-1">
        <div className="flex items-center gap-1 text-[15px] font-medium text-text">
          <span className="truncate">{pet.name}</span>
          {pet.sterilized && (
            <GenderNeuterIcon
              size={13}
              className="shrink-0 text-neutral-500"
              aria-label="Esterilizada"
            />
          )}
          {pet.visibility === "privado" && (
            <LockSimpleIcon size={13} className="shrink-0 text-neutral-500" aria-label="Privada" />
          )}
        </div>
        <div className="mt-0.5 truncate text-caption text-neutral-500">
          {[pet.nicknames[0], pet.zone].filter(Boolean).join(" · ")}
        </div>
      </div>
      <span className="pet-card-row-status shrink-0 items-center gap-1 text-legend">
        {pet.seenToday ? (
          <span className="flex items-center gap-1 text-accent-400">
            <CheckCircleIcon size={14} aria-hidden="true" />
            hoy
          </span>
        ) : daysSinceSeen === 1 ? (
          <span className="text-neutral-600">ayer</span>
        ) : daysSinceSeen !== null ? (
          <span className="text-neutral-600">hace {daysSinceSeen} días</span>
        ) : null}
      </span>
    </Link>
  )
}
