"use client"

// "Sin conexión, mostrando datos de las HH:mm" (FR-018).

import { useEffect, useState } from "react"
import { WifiOff } from "lucide-react"
import { useOnlineStatus } from "@/hooks/use-online-status"
import { getLastLoadedAt } from "@/lib/offline/last-loaded"

export function OfflineBanner() {
  const isOnline = useOnlineStatus()
  const [lastLoadedAt, setLastLoadedAt] = useState<Date | null>(null)

  useEffect(() => {
    if (isOnline) return
    getLastLoadedAt().then(setLastLoadedAt)
  }, [isOnline])

  if (isOnline) return null

  const time = lastLoadedAt?.toLocaleTimeString("es-AR", {
    hour: "2-digit",
    minute: "2-digit",
  })

  return (
    <div
      role="status"
      className="flex items-center justify-center gap-2 bg-muted px-4 py-2 text-caption text-muted-foreground"
    >
      <WifiOff className="h-3.5 w-3.5" aria-hidden="true" />
      {time
        ? `Sin conexión — mostrando datos de las ${time}`
        : "Sin conexión — mostrando datos guardados"}
    </div>
  )
}
