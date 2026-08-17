"use client"

// "Sin conexión, mostrando datos de las HH:mm" (FR-018).

import { useEffect, useState } from "react"
import { WifiSlashIcon } from "@phosphor-icons/react/dist/ssr/WifiSlash"
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
    <div role="status" className="flex items-center gap-2 border-b border-hairline bg-surface px-3.5 py-2 text-meta text-text-secondary">
      <WifiSlashIcon size={15} className="text-accent" aria-hidden="true" />
      {time
        ? `Sin conexión — mostrando datos de las ${time}`
        : "Sin conexión — mostrando datos guardados"}
    </div>
  )
}
