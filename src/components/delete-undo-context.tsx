"use client"

// Patrón único de borrado (Nocturne 1k, "△"): el borrado ya pasó de verdad
// en el servidor cuando este componente entra en juego — no hay nada
// diferido acá. Un setTimeout que recién dispara el borrado real 15s
// después no sobrevive a un reload ni a cerrar la pestaña (el timer muere
// con el proceso de JS), así que la mascota/hito quedaba "a medio borrar"
// de forma indefinida si la administradora recargaba antes de esos 15s —
// bug real reportado en producción con la primera versión de este patrón.
// Ahora "Deshacer" restaura desde una copia (snapshot) que cada llamador ya
// trajo del servidor antes de borrar; si se recarga antes de deshacer, el
// borrado simplemente queda firme — nunca en un estado intermedio.

import { createContext, useContext, useRef, useState, type ReactNode } from "react"
import { CheckCircleIcon } from "@phosphor-icons/react/dist/ssr/CheckCircle"
import { XIcon } from "@phosphor-icons/react/dist/ssr/X"
import { Button } from "@/components/ui/button"

const UNDO_WINDOW_MS = 15_000

type PendingUndo = {
  id: string
  message: string
  restore: () => void | Promise<void>
}

type DeleteUndoContextValue = {
  announceUndo: (entry: { message: string; restore: () => void | Promise<void> }) => void
}

const DeleteUndoContext = createContext<DeleteUndoContextValue>({
  announceUndo: () => {},
})

export function DeleteUndoProvider({ children }: { children: ReactNode }) {
  const [pending, setPending] = useState<PendingUndo | null>(null)
  const [restoring, setRestoring] = useState(false)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  function announceUndo({
    message,
    restore,
  }: {
    message: string
    restore: () => void | Promise<void>
  }) {
    if (timerRef.current) clearTimeout(timerRef.current)

    const id = crypto.randomUUID()
    setPending({ id, message, restore })
    timerRef.current = setTimeout(() => {
      timerRef.current = null
      setPending((current) => (current?.id === id ? null : current))
    }, UNDO_WINDOW_MS)
  }

  async function handleUndo() {
    if (!pending) return
    if (timerRef.current) {
      clearTimeout(timerRef.current)
      timerRef.current = null
    }
    setRestoring(true)
    await pending.restore()
    setRestoring(false)
    setPending(null)
  }

  function handleDismiss() {
    if (timerRef.current) {
      clearTimeout(timerRef.current)
      timerRef.current = null
    }
    setPending(null)
  }

  return (
    <DeleteUndoContext.Provider value={{ announceUndo }}>
      {children}
      {pending && (
        <div className="fixed inset-x-0 bottom-4 z-50 mx-auto flex w-fit max-w-[calc(100%-2rem)] items-center gap-2.5 rounded-md bg-sunken px-3.5 py-2.5 shadow-sm">
          <CheckCircleIcon size={17} className="shrink-0 text-accent" aria-hidden="true" />
          <span className="flex-1 text-meta text-neutral-300">{pending.message}</span>
          <Button
            type="button"
            variant="ghost"
            className="text-meta"
            onClick={handleUndo}
            disabled={restoring}
          >
            {restoring ? "Restaurando…" : "Deshacer"}
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={handleDismiss}
            disabled={restoring}
            aria-label="Descartar aviso"
          >
            <XIcon size={14} className="text-neutral-600" aria-hidden="true" />
          </Button>
        </div>
      )}
    </DeleteUndoContext.Provider>
  )
}

export function useDeleteUndo() {
  return useContext(DeleteUndoContext)
}
