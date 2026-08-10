import Link from "next/link"

export default function PetNotFound() {
  return (
    <main className="mx-auto flex max-w-screen-md flex-col items-center gap-2 px-4 py-16 text-center">
      <p className="text-h1 text-foreground">Esta mascota no está en PetDex</p>
      <p className="text-body text-muted-foreground">
        Puede que el enlace esté mal escrito o que la mascota ya no esté registrada.
      </p>
      <Link href="/" className="text-body text-accent underline underline-offset-4">
        Volver al catálogo
      </Link>
    </main>
  )
}
