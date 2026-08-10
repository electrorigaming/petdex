type PostgrestLikeError = { code?: string | null; message?: string } | null | undefined

const MESSAGES: Record<string, string> = {
  "23505": "Ese identificador ya está en uso. Probá con otro.",
  "42501": "No tenés permiso para hacer esto. Iniciá sesión con una cuenta autorizada.",
}

const GENERIC_MESSAGE = "Algo salió mal. Intentá de nuevo."

export function mapPostgresError(error: PostgrestLikeError): string {
  // El mensaje crudo de Postgres nunca llega a la interfaz (Principio I /
  // FR-025) pero sí queda en consola para poder diagnosticar.
  console.error(error)

  if (!error?.code) return GENERIC_MESSAGE
  return MESSAGES[error.code] ?? GENERIC_MESSAGE
}
