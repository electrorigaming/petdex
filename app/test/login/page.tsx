import { notFound } from "next/navigation"
import { TestLoginForm } from "@/components/auth/test-login-form"

// Existe únicamente para que tests/e2e/global-setup.ts obtenga una sesión de
// administrador real sin automatizar el consentimiento de Google, que no es
// viable de forma confiable en CI (research.md §6). No se linkea desde
// ninguna otra pantalla y no otorga nada que la política RLS no volviera a
// exigir igual — no es un atajo de seguridad.
export default async function TestLoginPage({
  searchParams,
}: {
  searchParams: Promise<{ email?: string; password?: string }>
}) {
  if (process.env.NODE_ENV === "production") {
    notFound()
  }

  const { email, password } = await searchParams
  return <TestLoginForm email={email} password={password} />
}
