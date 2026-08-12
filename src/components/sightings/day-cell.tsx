// Un día del calendario: forma + ícono distinguen los tres estados además
// del color (FR-003/SC-002, research.md §8) — nunca solo tono. La prop
// `pending` ya está presente en la firma pero ningún llamador la activa
// hasta User Story 5 (tasks.md T052): projectMonth() siempre resuelve
// `pending: false` mientras <SightingCalendar> le pase `todayPendingValue:
// null` (User Story 2).

import type { ReactNode } from "react"
import { Check, Clock, X } from "lucide-react"
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
        "relative flex h-9 w-9 items-center justify-center rounded-full text-caption transition-colors duration-150 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:cursor-default",
        !day.selectable && "opacity-40",
        STATE_CLASSES[day.value],
        isInteractive && "hover:opacity-80"
      )}
    >
      {STATE_ICON[day.value]}
      {day.pending && (
        <span
          className="absolute -right-0.5 -top-0.5 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-card"
          aria-hidden="true"
        >
          <Clock className="h-3 w-3 text-muted-foreground" />
        </span>
      )}
    </button>
  )
}

const STATE_LABEL: Record<CalendarDay["value"], string> = {
  visto: "visto",
  revisado_no_estaba: "revisado y no estaba",
  sin_registro: "sin registro",
}

const STATE_CLASSES: Record<CalendarDay["value"], string> = {
  visto: "bg-accent text-accent-foreground",
  revisado_no_estaba: "border-2 border-secondary text-secondary",
  sin_registro: "border border-dashed border-border text-transparent",
}

const STATE_ICON: Record<CalendarDay["value"], ReactNode> = {
  visto: <Check className="h-4 w-4" aria-hidden="true" />,
  revisado_no_estaba: <X className="h-4 w-4" aria-hidden="true" />,
  sin_registro: null,
}
