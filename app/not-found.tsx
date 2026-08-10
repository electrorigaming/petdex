import Link from "next/link"

export default function NotFound() {
  return (
    <main className="mx-auto flex max-w-screen-md flex-col items-center gap-2 px-4 py-16 text-center">
      <p className="text-h1 text-foreground">Página no encontrada</p>
      <p className="text-body text-muted-foreground">
        La página que buscás no existe en PetDex.
      </p>
      <Link href="/" className="text-body text-accent underline underline-offset-4">
        Volver al catálogo
      </Link>
    </main>
  )
}
