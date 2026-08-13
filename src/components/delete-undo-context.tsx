"use client"

// Patrón único de borrado (Nocturne 1k, "△"): confirmar en el diálogo no
// borra al instante — programa el borrado real 15s más tarde y muestra una
// franja de Deshacer. Si se toca "Deshacer" dentro de la ventana, se cancela
// el timer y la fila nunca se tocó en el servidor — no hace falta ningún
// mecanismo de "restaurar" porque nunca se llegó a borrar. Es la única red
// de seguridad post-borrado (no hay papelera ni versión anterior guardada).
// Compartido por <DeletePetButton> y <DeleteMilestoneDialog>.

import { createContext, useContext, useRef, useState, type ReactNode } from "react"
import { CheckCircleIcon } from "@phosphor-icons/react/dist/ssr/CheckCircle"
import { XIcon } from "@phosphor-icons/react/dist/ssr/X"
import { Button } from "@/components/ui/button"

const UNDO_WINDOW_MS = 15_000

type PendingDelete = {
  id: string
  message: string
  commit: () => void | Promise<void>
}

type DeleteUndoContextValue = {
  scheduleDelete: (entry: { message: string; commit: () => void | Promise<void> }) => void
}

const DeleteUndoContext = createContext<DeleteUndoContextValue>({
  scheduleDelete: () => {},
})

export function DeleteUndoProvider({ children }: { children: ReactNode }) {
  const [pending, setPending] = useState<PendingDelete | null>(null)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  function scheduleDelete({
    message,
    commit,
  }: {
    message: string
    commit: () => void | Promise<void>
  }) {
    // Si ya había un borrado programado (poco probable, pero posible si se
    // encadenan dos borrados rápido), lo confirmamos ya — no hay lugar para
    // dos franjas de Deshacer a la vez.
    if (timerRef.current) {
      clearTimeout(timerRef.current)
      pending?.commit()
    }

    const id = crypto.randomUUID()
    setPending({ id, message, commit })
    timerRef.current = setTimeout(() => {
      commit()
      timerRef.current = null
      setPending((current) => (current?.id === id ? null : current))
    }, UNDO_WINDOW_MS)
  }

  function handleUndo() {
    if (timerRef.current) {
      clearTimeout(timerRef.current)
      timerRef.current = null
    }
    setPending(null)
  }

  // Descartar el aviso solo lo oculta — el borrado programado sigue su
  // curso en segundo plano. "Deshacer" es la única forma de cancelarlo.
  function handleDismiss() {
    setPending(null)
  }

  return (
    <DeleteUndoContext.Provider value={{ scheduleDelete }}>
      {children}
      {pending && (
        <div className="fixed inset-x-0 bottom-4 z-50 mx-auto flex w-fit max-w-[calc(100%-2rem)] items-center gap-2.5 rounded-md bg-sunken px-3.5 py-2.5 shadow-sm">
          <CheckCircleIcon size={17} className="shrink-0 text-accent" aria-hidden="true" />
          <span className="flex-1 text-meta text-neutral-300">{pending.message}</span>
          <Button type="button" variant="ghost" className="text-meta" onClick={handleUndo}>
            Deshacer
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={handleDismiss}
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
