"use client"

import { useEffect, useState } from "react"

export function useOnlineStatus(): boolean {
  // navigator.onLine no existe en SSR — el valor inicial siempre es `true`
  // hasta que el efecto corre en el navegador, evitando un mismatch de
  // hidratación (el servidor no puede saber el estado de red real).
  const [isOnline, setIsOnline] = useState(true)

  useEffect(() => {
    setIsOnline(navigator.onLine)

    function handleOnline() {
      setIsOnline(true)
    }
    function handleOffline() {
      setIsOnline(false)
    }

    window.addEventListener("online", handleOnline)
    window.addEventListener("offline", handleOffline)
    return () => {
      window.removeEventListener("online", handleOnline)
      window.removeEventListener("offline", handleOffline)
    }
  }, [])

  return isOnline
}
