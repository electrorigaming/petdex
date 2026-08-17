// Total del mes visto (incluye pendientes, Clarifications spec.md — FR-006)
// + racha actual, siempre relativa a hoy sin importar qué mes se navegue.
// "Corregir otro día…" (Nocturne 1g) vive acá, a la derecha de las dos
// cifras — mismo ícono (pencil-simple) que la affordance de hover de
// <DayCell> sobre un día pasado, para que los dos caminos se lean como la
// misma acción.

import { PencilSimpleIcon } from "@phosphor-icons/react/dist/ssr/PencilSimple"
import { Button } from "@/components/ui/button"
import type { CalendarDay } from "@/lib/sightings"

export function MonthSummary({
  days,
  streak,
  onCorrectDay,
}: {
  days: CalendarDay[]
  streak: number
  onCorrectDay?: () => void
}) {
  const totalSeenThisMonth = days.filter((day) => day.value === "visto").length

  return (
    <div className="flex items-center justify-between gap-5">
      <dl className="flex gap-8">
        <div>
          <dd className="text-stat md:text-stat-lg text-text">{totalSeenThisMonth}</dd>
          <dt className="mt-1 text-meta text-text-secondary">vistas este mes</dt>
        </div>
        <div>
          <dd className="text-stat md:text-stat-lg text-text">
            {streak} <span className="text-[15px] text-text-secondary">{streak === 1 ? "día" : "días"}</span>
          </dd>
          <dt className="mt-1 text-meta text-text-secondary">racha actual</dt>
        </div>
      </dl>
      {onCorrectDay && (
        <Button type="button" variant="ghost" className="shrink-0 text-meta" onClick={onCorrectDay}>
          <PencilSimpleIcon size={15} aria-hidden="true" />
          Corregir otro día…
        </Button>
      )}
    </div>
  )
}
