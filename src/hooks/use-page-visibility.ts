"use client"

import { useEffect, useState } from "react"

export function usePageVisibility(): boolean {
  // document no existe en SSR — el valor inicial siempre es `true` hasta
  // que el efecto corre en el navegador, mismo criterio que useOnlineStatus
  // (evita un mismatch de hidratación).
  const [isVisible, setIsVisible] = useState(true)

  useEffect(() => {
    setIsVisible(document.visibilityState === "visible")

    function handleVisibilityChange() {
      setIsVisible(document.visibilityState === "visible")
    }

    document.addEventListener("visibilitychange", handleVisibilityChange)
    return () => document.removeEventListener("visibilitychange", handleVisibilityChange)
  }, [])

  return isVisible
}
