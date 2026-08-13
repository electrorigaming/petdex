"use client"

import { ArrowClockwiseIcon } from "@phosphor-icons/react/dist/ssr/ArrowClockwise"
import { useSwUpdate } from "@/hooks/use-sw-update"
import { Button } from "@/components/ui/button"

// Única franja tintada de acento (bg-accent-900) — todo el resto del
// sistema usa fondos hundidos neutros; esta es la excepción deliberada
// (Nocturne 1n, "los avisos son franjas de 1 línea: la de update es la
// única tintada de acento").
export function UpdateAvailableBanner() {
  const { updateAvailable, reload } = useSwUpdate()

  if (!updateAvailable) return null

  return (
    <div role="status" className="flex items-center gap-2 bg-accent-900 px-3.5 py-2 text-meta text-accent-300">
      <ArrowClockwiseIcon size={15} aria-hidden="true" />
      Hay una versión nueva de PetDex
      <Button type="button" variant="ghost" className="ml-auto text-meta" onClick={reload}>
        Recargar
      </Button>
    </div>
  )
}
