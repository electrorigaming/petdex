import Image from "next/image"
import Link from "next/link"
import { ImageSquareIcon } from "@phosphor-icons/react/dist/ssr/ImageSquare"
import { MapPinIcon } from "@phosphor-icons/react/dist/ssr/MapPin"
import { CheckCircleIcon } from "@phosphor-icons/react/dist/ssr/CheckCircle"
import { GenderNeuterIcon } from "@phosphor-icons/react/dist/ssr/GenderNeuter"
import { GenderMaleIcon } from "@phosphor-icons/react/dist/ssr/GenderMale"
import { GenderFemaleIcon } from "@phosphor-icons/react/dist/ssr/GenderFemale"
import { LockSimpleIcon } from "@phosphor-icons/react/dist/ssr/LockSimple"
import { Badge } from "@/components/ui/badge"
import { Logo } from "@/components/logo"
import { daysBetween, todayLocal } from "@/lib/dates"
import type { PetSummary } from "@/lib/pets"
import { PET_STATUS_DISPLAY_LABEL, PET_GENDER_LABEL } from "@/lib/validation/pet-schema"

// Sin ícono para "desconocido" — no ocupa espacio visual, mismo criterio
// que el resto de los indicadores de tarjeta.
function GenderIcon({ gender, size }: { gender: PetSummary["gender"]; size: number }) {
  if (gender === "macho") {
    return <GenderMaleIcon size={size} aria-label={PET_GENDER_LABEL[gender]} />
  }
  if (gender === "hembra") {
    return <GenderFemaleIcon size={size} aria-label={PET_GENDER_LABEL[gender]} />
  }
  return null
}

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
          <>
            {/* Cuadrícula: mismo ícono neutro de siempre. Lista: la marca
                corta como avatar por defecto (logo/README.md, paso 5) — dos
                bloques en el DOM, visibilidad la decide data-view en
                <html> (mismo criterio que .pet-card-row-text/-status). */}
            <div
              role="img"
              aria-label="Sin foto"
              className="pet-card-placeholder-grid flex h-full w-full items-center justify-center"
            >
              <ImageSquareIcon size={22} className="text-text-tertiary" aria-hidden="true" />
            </div>
            <div
              role="img"
              aria-label="Sin foto"
              className="pet-card-placeholder-list hidden h-full w-full items-center justify-center"
            >
              <span aria-hidden="true">
                <Logo variant="mark" size={20} />
              </span>
            </div>
          </>
        )}
      </div>

      {/* Cuadrícula: nombre/zona sobre un degradado encima de la foto — el
          texto siempre queda blanco acá (ver --photo-overlay-text), no
          reacciona al tema como el resto de la tarjeta. */}
      <div className="pet-card-overlay absolute inset-x-0 bottom-0 px-2.5 pb-2.5 pt-8">
        <div className="text-[15px] font-medium">{pet.name}</div>
        {pet.zone && (
          <div className="mt-0.5 flex items-center gap-1 text-caption opacity-80">
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
      {(pet.status !== "activo" ||
        pet.gender !== "desconocido" ||
        pet.sterilized ||
        pet.visibility === "privado") && (
        <div className="pet-card-tag absolute right-2 top-2 flex flex-col items-end gap-1">
          {pet.status !== "activo" && (
            <Badge variant="neutral">{PET_STATUS_DISPLAY_LABEL[pet.status]}</Badge>
          )}
          {pet.gender !== "desconocido" && (
            <Badge variant="neutral">
              <GenderIcon gender={pet.gender} size={12} />
            </Badge>
          )}
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
          {pet.gender !== "desconocido" && (
            <span className="shrink-0 text-text-tertiary">
              <GenderIcon gender={pet.gender} size={13} />
            </span>
          )}
          {pet.sterilized && (
            <GenderNeuterIcon
              size={13}
              className="shrink-0 text-text-tertiary"
              aria-label="Esterilizada"
            />
          )}
          {pet.visibility === "privado" && (
            <LockSimpleIcon size={13} className="shrink-0 text-text-tertiary" aria-label="Privada" />
          )}
        </div>
        <div className="mt-0.5 truncate text-caption text-text-secondary">
          {[pet.nicknames[0], pet.zone].filter(Boolean).join(" · ")}
        </div>
      </div>
      <span className="pet-card-row-status shrink-0 flex-col items-end gap-1 text-legend">
        {pet.status !== "activo" && (
          <Badge variant="neutral">{PET_STATUS_DISPLAY_LABEL[pet.status]}</Badge>
        )}
        {pet.seenToday ? (
          <span className="flex items-center gap-1 text-accent-text">
            <CheckCircleIcon size={14} aria-hidden="true" />
            hoy
          </span>
        ) : daysSinceSeen === 1 ? (
          <span className="text-text-secondary">ayer</span>
        ) : daysSinceSeen !== null ? (
          <span className="text-text-secondary">hace {daysSinceSeen} días</span>
        ) : null}
      </span>
    </Link>
  )
}
