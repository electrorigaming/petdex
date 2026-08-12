// Regla fijada en la Clarification de spec.md (research.md §4): un error es
// "permanent" si el servidor respondió con un rechazo explícito (siempre
// trae `code`, ya sea un PostgrestError real o el objeto con `code: ""` que
// supabase-js resuelve para un fetch fallido — verificado a mano contra un
// host inalcanzable). "transient" es la ausencia de respuesta: sin conexión,
// timeout, o un TypeError nativo si algo más arriba en la cadena sí llega a
// tirar en vez de resolver con `{ error }`.

export type SyncErrorKind = "transient" | "permanent"

export function classifySyncError(error: unknown): SyncErrorKind {
  const code = (error as { code?: string } | null | undefined)?.code
  return code ? "permanent" : "transient"
}
