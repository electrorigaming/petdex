"use client"

// Coordina <MarkTodayControl> y <SightingCalendar>: un marcado online
// exitoso (User Story 1) sube el contador del mes y la racha en la misma
// vista, sin recargar la página (quickstart.md Validación 1) — ninguno de
// los dos componentes sabe del otro por su cuenta, así que este wrapper es
// el que traduce "se guardó" en "refetch del calendario". También refetchea
// cuando la cola offline confirma un marcado en segundo plano (User Story 5):
// sin esto, la fila de `rows` que <SightingCalendar> ya cargó (de antes del
// sync) no tiene el día de hoy, y en cuanto usePendingSighting vuelve a null
// tras la confirmación, projectMonth() volvería a mostrar "sin registro" en
// vez de "visto" hasta la próxima navegación de mes.

import { useEffect, useState } from "react"
import { useSession } from "@/hooks/use-session"
import { todayLocal } from "@/lib/dates"
import { subscribe } from "@/lib/offline/events"
import { MarkTodayControl } from "@/components/sightings/mark-today-control"
import { PastDayDialog } from "@/components/sightings/past-day-dialog"
import { SightingCalendar } from "@/components/sightings/sighting-calendar"

export function PetSightingsSection({
  petId,
  petSlug,
  petName,
  registeredOn,
}: {
  petId: string
  petSlug: string
  petName: string
  registeredOn: string
}) {
  const { isAuthenticated } = useSession()
  const [refreshKey, setRefreshKey] = useState(0)
  const [selectedPastDate, setSelectedPastDate] = useState<string | null>(null)

  useEffect(() => {
    return subscribe((event) => {
      if (event.type !== "sighting-confirmed") return
      if (event.petId !== petId) return
      setRefreshKey((k) => k + 1)
    })
  }, [petId])

  function handleDaySelect(date: string) {
    // Hoy ya tiene su propio control (<MarkTodayControl>) — el diálogo es
    // solo para corregir un día pasado (User Story 3, FR-014).
    if (date === todayLocal()) return
    setSelectedPastDate(date)
  }

  return (
    <div className="flex flex-col gap-6">
      <MarkTodayControl
        petId={petId}
        petSlug={petSlug}
        petName={petName}
        onMarked={() => setRefreshKey((k) => k + 1)}
      />
      <SightingCalendar
        petId={petId}
        registeredOn={registeredOn}
        refreshKey={refreshKey}
        // Corregir un día pasado es una acción de escritura — igual que
        // <MarkTodayControl> (<AdminOnly>), no se ofrece a quien no tiene
        // sesión (RLS igual la rechazaría, pero no tiene sentido abrir el
        // diálogo para que falle).
        onDaySelect={isAuthenticated ? handleDaySelect : undefined}
      />
      {isAuthenticated && (
        <PastDayDialog
          petId={petId}
          date={selectedPastDate}
          onClose={() => setSelectedPastDate(null)}
          onSaved={() => {
            setSelectedPastDate(null)
            setRefreshKey((k) => k + 1)
          }}
        />
      )}
    </div>
  )
}
