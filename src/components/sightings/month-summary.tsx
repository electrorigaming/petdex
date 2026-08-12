// Total del mes visto (incluye pendientes, Clarifications spec.md — FR-006)
// + racha actual, siempre relativa a hoy sin importar qué mes se navegue.

import type { CalendarDay } from "@/lib/sightings"

export function MonthSummary({
  days,
  streak,
}: {
  days: CalendarDay[]
  streak: number
}) {
  const totalSeenThisMonth = days.filter((day) => day.value === "visto").length

  return (
    <dl className="flex gap-6">
      <div>
        <dt className="text-caption text-muted-foreground">Vistos este mes</dt>
        <dd className="text-h2 text-foreground">{totalSeenThisMonth}</dd>
      </div>
      <div>
        <dt className="text-caption text-muted-foreground">Racha actual</dt>
        <dd className="text-h2 text-foreground">
          {streak} {streak === 1 ? "día" : "días"}
        </dd>
      </div>
    </dl>
  )
}
