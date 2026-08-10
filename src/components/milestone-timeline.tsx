"use client"

import { useState } from "react"
import { ArrowUpDown, CalendarDays } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { sortMilestones, type Milestone } from "@/lib/milestones"

const CATEGORY_LABEL: Record<NonNullable<Milestone["category"]>, string> = {
  salud: "Salud",
  alimentacion: "Alimentación",
  comportamiento: "Comportamiento",
  otro: "Otro",
}

export function MilestoneTimeline({ milestones }: { milestones: Milestone[] }) {
  const [direction, setDirection] = useState<"desc" | "asc">("desc")
  const sorted = sortMilestones(milestones, direction)

  return (
    <section className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h2 className="text-h2 text-foreground">Hitos</h2>
        {milestones.length > 1 && (
          <Button
            type="button"
            variant="outline"
            size="icon"
            aria-label="Invertir orden de los hitos"
            onClick={() => setDirection((d) => (d === "desc" ? "asc" : "desc"))}
          >
            <ArrowUpDown className="h-4 w-4" aria-hidden="true" />
          </Button>
        )}
      </div>
      {sorted.length === 0 ? (
        <p className="text-body text-muted-foreground">
          Todavía no hay hitos registrados para esta mascota.
        </p>
      ) : (
        <ol className="flex flex-col gap-4">
          {sorted.map((milestone) => (
            <li
              key={milestone.id}
              className="flex flex-col gap-1 rounded-lg border border-border bg-card p-4"
            >
              <div className="flex items-center gap-2 text-label text-muted-foreground">
                <CalendarDays className="h-3.5 w-3.5" aria-hidden="true" />
                {milestone.occurredOn}
              </div>
              <p className="text-body font-medium text-card-foreground">
                {milestone.title}
              </p>
              {milestone.category && (
                <Badge>{CATEGORY_LABEL[milestone.category]}</Badge>
              )}
              {milestone.note && (
                <p className="text-label text-muted-foreground">{milestone.note}</p>
              )}
            </li>
          ))}
        </ol>
      )}
    </section>
  )
}
