import Link from "next/link"
import { LoginButton } from "@/components/auth/login-button"
import { AccountRequestForm } from "@/components/account-requests/account-request-form"
import { Logo } from "@/components/logo"

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>
}) {
  const { next } = await searchParams

  return (
    <main className="mx-auto flex min-h-[70vh] max-w-sm flex-col justify-center gap-5 px-4 py-6">
      <div className="flex justify-center">
        <Logo variant="symbol" size={128} />
      </div>
      <div>
        <h4 className="mb-1.5 text-h4 text-text">Entrar para editar</h4>
        <p className="text-body text-text-secondary">
          Ver el Registro no necesita cuenta. Solicita una cuenta para agregar hitos, editar y
          marcar avistamientos.
        </p>
      </div>
      <LoginButton next={next} />
      <div className="divider-fade" />
      <AccountRequestForm />
      <Link href="/" className="text-center text-meta text-text-secondary hover:text-text">
        Volver al registro
      </Link>
    </main>
  )
}
