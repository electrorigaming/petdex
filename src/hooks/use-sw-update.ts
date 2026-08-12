"use client"

// Detecta un service worker nuevo en `waiting` y ofrece recargar. Nunca
// `skipWaiting()` automático (research.md §5) — reload() es la única forma
// de que el worker nuevo tome control, y solo corre cuando la
// administradora toca "Recargar" en <UpdateAvailableBanner>.

import { useEffect, useState } from "react"

export function useSwUpdate(): { updateAvailable: boolean; reload: () => void } {
  const [updateAvailable, setUpdateAvailable] = useState(false)

  useEffect(() => {
    if (!("serviceWorker" in navigator)) return

    function handleUpdateFound(registration: ServiceWorkerRegistration) {
      const installingWorker = registration.installing
      if (!installingWorker) return

      installingWorker.addEventListener("statechange", () => {
        if (installingWorker.state === "installed" && navigator.serviceWorker.controller) {
          setUpdateAvailable(true)
        }
      })
    }

    navigator.serviceWorker.ready.then((registration) => {
      if (registration.waiting && navigator.serviceWorker.controller) {
        setUpdateAvailable(true)
      }
      registration.addEventListener("updatefound", () => handleUpdateFound(registration))
    })

    function handleControllerChange() {
      window.location.reload()
    }
    navigator.serviceWorker.addEventListener("controllerchange", handleControllerChange)

    return () => {
      navigator.serviceWorker.removeEventListener("controllerchange", handleControllerChange)
    }
  }, [])

  function reload() {
    navigator.serviceWorker.ready.then((registration) => {
      registration.waiting?.postMessage({ type: "SKIP_WAITING" })
    })
  }

  return { updateAvailable, reload }
}
