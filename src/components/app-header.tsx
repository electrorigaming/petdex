"use client"

// Header persistente (Nocturne 1e, variante B — "buscador en el header",
// decisión ya tomada en el handoff). El buscador solo aparece en mobile
// cuando la ruta actual es el catálogo (research.md de la feature 003: el
// buscador filtra en cliente sobre datos ya cargados por <PetGrid>, así que
// en cualquier otra pantalla no tiene sentido mostrarlo); en desktop queda
// siempre visible y, si se escribe estando en otra ruta, el submit navega a
// "/" — el valor ya tipeado sigue ahí porque <CatalogSearchProvider> vive en
// el layout y no se desmonta en una navegación client-side.

import { type FormEvent } from "react"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { MagnifyingGlassIcon } from "@phosphor-icons/react/dist/ssr/MagnifyingGlass"
import { useSession } from "@/hooks/use-session"
import { useCatalogSearch } from "@/components/catalog-search-context"
import { LogoutButton } from "@/components/auth/logout-button"
import { AddPetButton } from "@/components/pets/add-pet-button"
import { ThemeToggle } from "@/components/theme-toggle"
import { Logo } from "@/components/logo"

function SearchField({ className }: { className?: string }) {
  const pathname = usePathname()
  const router = useRouter()
  const { query, setQuery } = useCatalogSearch()

  function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (pathname !== "/") router.push("/")
  }

  return (
    <form onSubmit={handleSubmit} className={className}>
      <div className="relative flex flex-1 items-center">
        <MagnifyingGlassIcon
          size={14}
          className="pointer-events-none absolute left-2.5 text-text-tertiary"
          aria-hidden="true"
        />
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Buscar por nombre o apodo"
          aria-label="Buscar mascota por nombre o apodo"
          className="min-h-9 w-full rounded-md border border-divider bg-card py-1.5 pl-8 pr-2.5 text-label text-card-foreground caret-accent placeholder:text-text-secondary hover:border-text/45 focus-visible:border-accent focus-visible:outline-0"
        />
      </div>
    </form>
  )
}

export function AppHeader() {
  const pathname = usePathname()
  const { isAuthenticated, loading, email } = useSession()
  const isCatalog = pathname === "/"

  return (
    <div>
      <nav className="flex items-center gap-3 px-4 py-2.5 md:gap-3.5 md:px-14 md:py-3">
        <Link href="/" className="mr-auto">
          <Logo variant="lockup" size={27} />
        </Link>

        <SearchField className="hidden max-w-[380px] flex-1 md:block" />

        {!loading && (
          <>
            {isAuthenticated ? (
              <>
                <AddPetButton />
                {email && (
                  <span className="hidden text-meta text-text-secondary md:inline">{email}</span>
                )}
                <LogoutButton iconOnly />
              </>
            ) : (
              <Link
                href="/login"
                className="text-label font-medium text-text underline-offset-4 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
              >
                Iniciar sesión
              </Link>
            )}
          </>
        )}

        <ThemeToggle />
      </nav>

      {isCatalog && <SearchField className="px-4 pb-2.5 md:hidden" />}

      <div className="divider-fade" />
    </div>
  )
}
