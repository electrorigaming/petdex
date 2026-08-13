import Link from "next/link"
import { PawPrintIcon } from "@phosphor-icons/react/dist/ssr/PawPrint"
import { LoginButton } from "@/components/auth/login-button"

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>
}) {
  const { next } = await searchParams

  return (
    <main className="mx-auto flex min-h-[70vh] max-w-sm flex-col justify-center gap-5 px-4 py-6">
      <div className="flex items-center gap-2.5">
        <PawPrintIcon weight="fill" size={26} className="text-accent" aria-hidden="true" />
        <span className="text-h4 text-text">PetDex</span>
      </div>
      <div>
        <h4 className="mb-1.5 text-h4 text-text">Entrar para editar</h4>
        <p className="text-body text-neutral-500">
          Mirar el registro no necesita cuenta. Solo las personas autorizadas del barrio pueden
          agregar mascotas y marcar avistamientos.
        </p>
      </div>
      <LoginButton next={next} />
      <Link href="/" className="text-center text-meta text-neutral-500 hover:text-text">
        Volver al registro
      </Link>
    </main>
  )
}
