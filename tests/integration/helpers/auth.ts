import { createClient } from "@supabase/supabase-js"
import type { Database } from "@/types/database"

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

// Los tests de integración de 007-roles-y-solicitudes multiplicaron la
// cantidad de sign-in por corrida (varios archivos, cada uno con su propio
// ciclo admin/usuario) y eso expuso un rate-limit intermitente de Supabase
// Auth ante logins repetidos de la misma cuenta en poco tiempo — no un bug
// de la app. Un reintento corto con backoff alcanza.
export async function signInWithRetry(email: string, password: string) {
  const client = createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
  let lastError: unknown = null
  for (let attempt = 0; attempt < 3; attempt++) {
    const { data, error } = await client.auth.signInWithPassword({ email, password })
    if (!error && data.user) return { client, uid: data.user.id }
    lastError = error
    await sleep(500 * (attempt + 1))
  }
  throw new Error(`No se pudo iniciar sesión como ${email} tras 3 intentos: ${JSON.stringify(lastError)}`)
}
