import { WifiOff } from "lucide-react"

// Fallback precacheado del service worker (contracts/service-worker.md,
// `fallbacks` en app/sw.ts): se sirve cuando una navegación falla sin
// conexión y la página pedida nunca se cacheó — nunca una pantalla en
// blanco ni el error crudo del navegador (FR-017, spec.md Edge Cases).
export default function OfflinePage() {
  return (
    <main className="mx-auto flex max-w-screen-md flex-col items-center gap-4 px-4 py-16 text-center">
      <WifiOff className="h-10 w-10 text-muted-foreground" aria-hidden="true" />
      <h1 className="text-h1 text-foreground">Sin conexión</h1>
      <p className="text-body text-muted-foreground">
        Esta página todavía no se guardó para verla sin conexión. Volvé a
        intentarlo cuando recuperes señal, o abrí una ficha que ya hayas
        visitado antes.
      </p>
    </main>
  )
}
