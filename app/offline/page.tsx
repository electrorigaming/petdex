import { WifiSlashIcon } from "@phosphor-icons/react/dist/ssr/WifiSlash"

// Fallback precacheado del service worker (contracts/service-worker.md,
// `fallbacks` en app/sw.ts): se sirve cuando una navegación falla sin
// conexión y la página pedida nunca se cacheó — nunca una pantalla en
// blanco ni el error crudo del navegador (FR-017, spec.md Edge Cases).
// Misma figura de estado vacío que <EmptyState>/<NoResultsState> (Nocturne
// 1n, "△ vacíos con marca") — círculo punteado de 72px con un ícono.
export default function OfflinePage() {
  return (
    <main className="mx-auto flex max-w-screen-md flex-col items-center gap-3 px-4 py-16 text-center">
      <span className="flex h-[72px] w-[72px] items-center justify-center rounded-full border border-dashed border-hairline">
        <WifiSlashIcon size={28} className="text-text-tertiary" aria-hidden="true" />
      </span>
      <h1 className="text-[17px] font-medium text-card-foreground">Esta página no está guardada</h1>
      <p className="max-w-[38ch] text-caption text-text-secondary">
        Sin conexión solo podés abrir lo que ya visitaste. Volvé a intentar cuando tengas señal.
      </p>
    </main>
  )
}
