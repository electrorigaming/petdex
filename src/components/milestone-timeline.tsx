"use client"

import { useState } from "react"
import Link from "next/link"
import { ArrowsDownUpIcon } from "@phosphor-icons/react/dist/ssr/ArrowsDownUp"
import { CalendarBlankIcon } from "@phosphor-icons/react/dist/ssr/CalendarBlank"
import { PencilSimpleIcon } from "@phosphor-icons/react/dist/ssr/PencilSimple"
import { PlusIcon } from "@phosphor-icons/react/dist/ssr/Plus"
import { useSession } from "@/hooks/use-session"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { DeleteMilestoneDialog } from "@/components/milestones/delete-milestone-dialog"
import { sortMilestones, type Milestone } from "@/lib/milestones"

const CATEGORY_LABEL: Record<NonNullable<Milestone["category"]>, string> = {
  salud: "Salud",
  alimentacion: "Alimentación",
  comportamiento: "Comportamiento",
  otro: "Otro",
}

export function MilestoneTimeline({
  milestones: initialMilestones,
  petSlug,
}: {
  milestones: Milestone[]
  petSlug: string
}) {
  // isEditor ya no llega del servidor (research.md §1, 002-panel-administracion):
  // el HTML de /mascotas/[slug] no puede variar por sesión para poder
  // cachearlo con el service worker. Admin y Usuario comparten estos
  // controles por igual (007-roles-y-solicitudes).
  const { isEditor } = useSession()
  const [milestones, setMilestones] = useState(initialMilestones)
  const [direction, setDirection] = useState<"desc" | "asc">("desc")
  const sorted = sortMilestones(milestones, direction)

  function handleDeleted(milestoneId: string) {
    setMilestones((prev) => prev.filter((m) => m.id !== milestoneId))
  }

  function handleRestored(milestone: Milestone) {
    setMilestones((prev) => [...prev, milestone])
  }

  return (
    <section className="flex flex-col gap-3.5 md:max-w-[560px]">
      <div className="flex items-center justify-between">
        <span className="text-h5 text-text">Hitos</span>
        <div className="flex items-center gap-1.5">
          {milestones.length > 1 && (
            <Button
              type="button"
              variant="ghost"
              className="text-meta"
              onClick={() => setDirection((d) => (d === "desc" ? "asc" : "desc"))}
            >
              <ArrowsDownUpIcon size={15} aria-hidden="true" />
              Invertir orden
            </Button>
          )}
          {isEditor && (
            <Button asChild variant="secondary">
              <Link href={`/mascotas/${petSlug}/hitos/nuevo`}>
                <PlusIcon size={14} aria-hidden="true" />
                Agregar hito
              </Link>
            </Button>
          )}
        </div>
      </div>
      {sorted.length === 0 ? (
        <p className="text-caption text-text-secondary">Todavía no hay hitos registrados para esta mascota.</p>
      ) : (
        <ol className="flex flex-col gap-3">
          {sorted.map((milestone) => (
            <li key={milestone.id} className="flex flex-col gap-1.5 rounded-md bg-card p-3">
              <div className="flex items-center gap-2.5">
                <span className="flex items-center gap-1.5 text-caption text-text-secondary">
                  <CalendarBlankIcon size={12} aria-hidden="true" />
                  {milestone.occurredOn}
                </span>
                {milestone.category && (
                  <Badge variant="accent">{CATEGORY_LABEL[milestone.category]}</Badge>
                )}
                {isEditor && (
                  <span className="ml-auto flex items-center gap-0.5">
                    <Button
                      asChild
                      variant="ghost"
                      size="icon"
                      className="h-[30px] w-[30px]"
                      aria-label={`Editar el hito ${milestone.title}`}
                    >
                      <Link href={`/mascotas/${petSlug}/hitos/${milestone.id}/editar`}>
                        <PencilSimpleIcon size={15} aria-hidden="true" />
                      </Link>
                    </Button>
                    <DeleteMilestoneDialog
                      milestoneId={milestone.id}
                      milestoneTitle={milestone.title}
                      petSlug={petSlug}
                      onDeleted={handleDeleted}
                      onRestored={handleRestored}
                    />
                  </span>
                )}
              </div>
              <p className="text-[16px] font-medium text-card-foreground">{milestone.title}</p>
              {milestone.note && <p className="text-meta text-text-secondary">{milestone.note}</p>}
            </li>
          ))}
        </ol>
      )}
    </section>
  )
}
