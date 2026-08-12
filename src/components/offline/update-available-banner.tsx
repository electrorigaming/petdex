"use client"

import { RefreshCw } from "lucide-react"
import { useSwUpdate } from "@/hooks/use-sw-update"
import { Button } from "@/components/ui/button"

export function UpdateAvailableBanner() {
  const { updateAvailable, reload } = useSwUpdate()

  if (!updateAvailable) return null

  return (
    <div
      role="status"
      className="flex items-center justify-center gap-3 bg-accent px-4 py-2 text-caption text-accent-foreground"
    >
      Hay una versión nueva de PetDex disponible.
      <Button
        type="button"
        variant="outline"
        size="default"
        className="h-7 gap-1 border-accent-foreground/40 bg-transparent px-2 py-0 text-caption text-accent-foreground hover:bg-accent-foreground/10"
        onClick={reload}
      >
        <RefreshCw className="h-3 w-3" aria-hidden="true" />
        Recargar
      </Button>
    </div>
  )
}
