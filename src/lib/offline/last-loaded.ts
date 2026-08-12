// Lee el header `Date` de la respuesta ya cacheada por el service worker
// (Cache Storage API) en vez de duplicar el timestamp en localStorage — el
// dato ya existe en la respuesta HTTP que Serwist guardó (research.md §5,
// "Desde cuándo está desactualizado").
export async function getLastLoadedAt(): Promise<Date | null> {
  if (typeof caches === "undefined") return null

  const response = await caches.match(window.location.href, { ignoreSearch: true })
  const dateHeader = response?.headers.get("date")
  return dateHeader ? new Date(dateHeader) : null
}
