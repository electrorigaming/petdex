"use client"

// Monta los tres disparadores de sincronización de la cola offline
// (research.md §3): evento `online`, `visibilitychange` al volver a
// primer plano, y un intento al montar (cubre abrir la app ya con conexión
// y una cola pendiente de la sesión anterior). Nunca Background Sync API —
// sin soporte en Safari/iOS.

import { useEffect } from "react"
import { syncPendingSightings } from "@/lib/offline/sync"

export function OfflineSyncProvider() {
  useEffect(() => {
    syncPendingSightings()

    function handleOnline() {
      syncPendingSightings()
    }
    function handleVisibilityChange() {
      if (document.visibilityState === "visible") syncPendingSightings()
    }

    window.addEventListener("online", handleOnline)
    document.addEventListener("visibilitychange", handleVisibilityChange)
    return () => {
      window.removeEventListener("online", handleOnline)
      document.removeEventListener("visibilitychange", handleVisibilityChange)
    }
  }, [])

  return null
}
