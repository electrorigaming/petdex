// Celda del calendario (Nocturne 1f/1g, "△ celda rediseñada"): número del
// día siempre arriba, la marca (círculo) abajo — separados, no superpuestos
// como en el diseño anterior. Un día no seleccionable (futuro o anterior al
// registro) no dibuja círculo, solo el número, para no sugerir una acción
// posible. "Pendiente de sincronizar" pasa de un badge de reloj superpuesto
// a un punto de acento en la esquina de la celda (más chico, menos ruido).
// El hover de un día interactivo cambia el borde del círculo a acento y
// muestra un lápiz — misma affordance que "Corregir otro día…"
// (<PetSightingsSection>), para que los dos caminos a corregir un día se
// lean como la misma acción.

import type { ReactNode } from "react"
import { CheckIcon } from "@phosphor-icons/react/dist/ssr/Check"
import { XIcon } from "@phosphor-icons/react/dist/ssr/X"
import { PencilSimpleIcon } from "@phosphor-icons/react/dist/ssr/PencilSimple"
import { cn } from "@/lib/utils"
import type { CalendarDay } from "@/lib/sightings"

export function DayCell({
  day,
  onSelect,
}: {
  day: CalendarDay
  onSelect?: (date: string) => void
}) {
  const dayNumber = Number(day.date.slice(8, 10))
  const isInteractive = day.selectable && Boolean(onSelect)

  const label = `${dayNumber} — ${STATE_LABEL[day.value]}${day.pending ? " (pendiente de sincronizar)" : ""}`

  return (
    <button
      type="button"
      disabled={!isInteractive}
      onClick={isInteractive ? () => onSelect?.(day.date) : undefined}
      aria-label={label}
      title={label}
      className={cn(
        "group relative flex h-[46px] flex-col items-center justify-center gap-1 rounded-md focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:cursor-default md:h-[58px]",
        isInteractive && "cursor-pointer"
      )}
    >
      <span className="text-kicker leading-none text-neutral-600" aria-hidden="true">
        {dayNumber}
      </span>
      <span
        className={cn(
          "relative flex h-6 w-6 items-center justify-center rounded-full transition-colors duration-150 md:h-7 md:w-7",
          day.selectable ? MARK_CLASSES[day.value] : "invisible",
          isInteractive && "group-hover:border-solid group-hover:border-accent"
        )}
      >
        {day.selectable && (
          <span className="group-hover:opacity-0">{STATE_ICON[day.value]}</span>
        )}
        {isInteractive && (
          <PencilSimpleIcon
            size={11}
            className="absolute inset-0 m-auto text-accent opacity-0 transition-opacity duration-150 group-hover:opacity-100"
            aria-hidden="true"
          />
        )}
      </span>
      {day.pending && (
        <span
          className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-accent shadow-[0_0_0_2px_rgb(22,24,38)] md:right-2 md:top-2"
          aria-hidden="true"
        />
      )}
    </button>
  )
}

const STATE_LABEL: Record<CalendarDay["value"], string> = {
  visto: "visto",
  revisado_no_estaba: "revisado y no estaba",
  sin_registro: "sin registro",
}

const MARK_CLASSES: Record<CalendarDay["value"], string> = {
  visto: "bg-accent-800 border border-accent",
  revisado_no_estaba: "border border-neutral-700",
  sin_registro: "border border-dashed border-neutral-800",
}

const STATE_ICON: Record<CalendarDay["value"], ReactNode> = {
  visto: <CheckIcon weight="bold" size={11} className="text-accent-300" aria-hidden="true" />,
  revisado_no_estaba: <XIcon size={11} className="text-neutral-500" aria-hidden="true" />,
  sin_registro: null,
}
