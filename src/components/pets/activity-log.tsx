"use client"

// Sección "Historial" (feature 007-roles-y-solicitudes) — solo admin. No
// recibe datos como prop desde el Server Component de la ficha: los pide
// desde el navegador recién cuando isAdmin es true, para no filtrar
// pet_activity_log al HTML/RSC inicial de una cuenta sin ese permiso (mismo
// motivo que <PetAdminActions>, research.md §5).

import { useEffect, useState } from "react"
import { ClockCounterClockwiseIcon } from "@phosphor-icons/react/dist/ssr/ClockCounterClockwise"
import { useSession } from "@/hooks/use-session"
import { createClient } from "@/lib/supabase/client"
import { getActivityLog, ACTIVITY_ACTION_LABEL, type ActivityEvent } from "@/lib/activity-log"

function formatEventDate(iso: string): string {
  return new Date(iso).toLocaleString("es-AR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })
}

export function ActivityLog({ petId }: { petId: string }) {
  const { isAdmin, loading } = useSession()
  const [events, setEvents] = useState<ActivityEvent[] | null>(null)

  useEffect(() => {
    if (loading || !isAdmin) return
    let cancelled = false
    const supabase = createClient()
    getActivityLog(supabase, petId).then((data) => {
      if (!cancelled) setEvents(data)
    })
    return () => {
      cancelled = true
    }
  }, [loading, isAdmin, petId])

  if (loading || !isAdmin) return null

  return (
    <section className="flex flex-col gap-3.5 md:max-w-[560px]">
      <div className="flex items-center gap-1.5">
        <ClockCounterClockwiseIcon size={16} className="text-text-secondary" aria-hidden="true" />
        <span className="text-h5 text-text">Historial</span>
      </div>
      {events === null ? (
        <p className="text-caption text-text-secondary">Cargando…</p>
      ) : events.length === 0 ? (
        <p className="text-caption text-text-secondary">Todavía no hay eventos registrados.</p>
      ) : (
        <ol className="flex flex-col gap-2">
          {events.map((event) => (
            <li
              key={event.id}
              className="flex flex-col gap-0.5 rounded-md bg-card px-3 py-2.5 text-meta text-card-foreground"
            >
              <span>
                <span className="font-medium">{event.actorLabel}</span>{" "}
                {ACTIVITY_ACTION_LABEL[event.action]}
                {event.detail ? `: ${event.detail}` : ""}
              </span>
              <span className="text-caption text-text-secondary">{formatEventDate(event.createdAt)}</span>
            </li>
          ))}
        </ol>
      )}
    </section>
  )
}
