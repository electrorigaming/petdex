"use client"

// Grilla mensual + navegación a meses anteriores. Client Component: cada
// navegación de mes dispara una nueva getSightingsForMonth() desde el
// navegador (contracts/sightings-read.md) — deliberado para que esas
// requests pasen por la misma ruta NetworkFirst que el service worker cachea
// (research.md §5), no por una recarga de página.

import { useEffect, useMemo, useState } from "react"
import { ChevronLeft, ChevronRight } from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import {
  computeStreak,
  getSightingsForMonth,
  getStreakWindow,
  projectMonth,
} from "@/lib/sightings"
import { dayOfWeek, daysInMonthRange, monthLabel, todayLocal } from "@/lib/dates"
import { usePendingSighting } from "@/hooks/use-pending-sighting"
import { DayCell } from "@/components/sightings/day-cell"
import { MonthSummary } from "@/components/sightings/month-summary"
import { Button } from "@/components/ui/button"

const WEEKDAY_LABELS = ["D", "L", "M", "M", "J", "V", "S"]

export function SightingCalendar({
  petId,
  registeredOn,
  onDaySelect,
  refreshKey,
}: {
  petId: string
  registeredOn: string
  onDaySelect?: (date: string) => void
  // Incrementado por un llamador externo (p. ej. <PetSightingsSection> tras
  // un marcado online exitoso) para forzar un refetch sin recargar la
  // página — projectMonth/computeStreak no tienen forma de enterarse solos
  // de una escritura que ocurrió fuera de este componente.
  refreshKey?: number
}) {
  const today = useMemo(() => todayLocal(), [])
  const [year, setYear] = useState(() => Number(today.slice(0, 4)))
  const [month, setMonth] = useState(() => Number(today.slice(5, 7)))
  const [rows, setRows] = useState<Map<string, boolean>>(new Map())
  const [streakWindow, setStreakWindow] = useState<Map<string, boolean>>(new Map())
  const [loading, setLoading] = useState(true)
  // Estado "pendiente de hoy" de la cola offline (User Story 5) — reactivo a
  // los eventos de src/lib/offline/events.ts, no requiere un refetch de red
  // para reflejarse acá (a diferencia de rows/streakWindow). En User Story 2
  // este valor siempre es null (bridge, contracts/sightings-read.md).
  const todayPendingValue = usePendingSighting(petId)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    const supabase = createClient()

    getSightingsForMonth(supabase, petId, year, month).then((data) => {
      if (!cancelled) {
        setRows(data)
        setLoading(false)
      }
    })

    return () => {
      cancelled = true
    }
  }, [petId, year, month, refreshKey])

  useEffect(() => {
    let cancelled = false
    const supabase = createClient()

    getStreakWindow(supabase, petId, registeredOn, today).then((window) => {
      if (!cancelled) setStreakWindow(window)
    })

    return () => {
      cancelled = true
    }
  }, [petId, registeredOn, today, refreshKey])

  const days = useMemo(
    () => projectMonth(year, month, rows, registeredOn, today, todayPendingValue),
    [year, month, rows, registeredOn, today, todayPendingValue]
  )

  // Puro, sin red — recalcula de inmediato apenas todayPendingValue cambia
  // (por ejemplo, al confirmar la sincronización), sin esperar el próximo
  // refetch de streakWindow.
  const streak = useMemo(
    () => computeStreak(streakWindow, registeredOn, today, todayPendingValue),
    [streakWindow, registeredOn, today, todayPendingValue]
  )

  const leadingBlanks = dayOfWeek(daysInMonthRange(year, month)[0])

  const canGoPrevious = registeredOn.slice(0, 7) < `${year}-${String(month).padStart(2, "0")}`
  const canGoNext = today.slice(0, 7) > `${year}-${String(month).padStart(2, "0")}`

  function goToPreviousMonth() {
    if (month === 1) {
      setYear((y) => y - 1)
      setMonth(12)
    } else {
      setMonth((m) => m - 1)
    }
  }

  function goToNextMonth() {
    if (month === 12) {
      setYear((y) => y + 1)
      setMonth(1)
    } else {
      setMonth((m) => m + 1)
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          disabled={!canGoPrevious}
          onClick={goToPreviousMonth}
          aria-label="Mes anterior"
        >
          <ChevronLeft className="h-4 w-4" aria-hidden="true" />
        </Button>
        <span className="text-label font-medium capitalize text-foreground">
          {monthLabel(year, month)}
        </span>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          disabled={!canGoNext}
          onClick={goToNextMonth}
          aria-label="Mes siguiente"
        >
          <ChevronRight className="h-4 w-4" aria-hidden="true" />
        </Button>
      </div>

      <div
        className="grid grid-cols-7 place-items-center gap-1"
        aria-busy={loading}
        aria-label={`Calendario de avistamientos de ${monthLabel(year, month)}`}
      >
        {WEEKDAY_LABELS.map((label, i) => (
          <span
            key={i}
            className="text-caption text-muted-foreground"
            aria-hidden="true"
          >
            {label}
          </span>
        ))}
        {Array.from({ length: leadingBlanks }, (_, i) => (
          <span key={`blank-${i}`} />
        ))}
        {days.map((day) => (
          <DayCell key={day.date} day={day} onSelect={onDaySelect} />
        ))}
      </div>

      <MonthSummary days={days} streak={streak} />
    </div>
  )
}
