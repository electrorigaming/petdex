"use client"

// Figura común de estado vacío (Nocturne 1n, "△ Vacíos con marca"): círculo
// punteado de 72px con un ícono, título, una línea de explicación y como
// mucho una acción — la misma forma que el círculo "sin registro" del
// calendario, para que el vocabulario visual cierre en toda la app.

import type { ReactNode } from "react"
import Link from "next/link"
import { PawPrintIcon } from "@phosphor-icons/react/dist/ssr/PawPrint"
import { MagnifyingGlassIcon } from "@phosphor-icons/react/dist/ssr/MagnifyingGlass"
import { PlusIcon } from "@phosphor-icons/react/dist/ssr/Plus"
import { useSession } from "@/hooks/use-session"
import { Button } from "@/components/ui/button"

function EmptyFigure({
  icon,
  title,
  description,
  children,
}: {
  icon: ReactNode
  title: string
  description: string
  children?: ReactNode
}) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-md bg-card px-6 py-8 text-center shadow-sm">
      <span className="flex h-[72px] w-[72px] items-center justify-center rounded-full border border-dashed border-neutral-800">
        {icon}
      </span>
      <div className="text-[17px] font-medium text-card-foreground">{title}</div>
      <p className="text-caption text-neutral-500">{description}</p>
      {children}
    </div>
  )
}

export function EmptyState() {
  const { isAuthenticated } = useSession()

  return (
    <EmptyFigure
      icon={<PawPrintIcon size={30} className="text-neutral-700" aria-hidden="true" />}
      title="Todavía no hay ninguna mascota"
      description="Empezá por la que más ves: nombre, zona y una foto alcanzan."
    >
      {isAuthenticated && (
        <Button asChild variant="primary" className="mt-0.5">
          <Link href="/mascotas/nueva">
            <PlusIcon size={15} aria-hidden="true" />
            Agregar la primera
          </Link>
        </Button>
      )}
    </EmptyFigure>
  )
}

export function NoResultsState({
  query,
  onClearFilters,
}: {
  query?: string
  onClearFilters?: () => void
}) {
  return (
    <EmptyFigure
      icon={<MagnifyingGlassIcon size={28} className="text-neutral-700" aria-hidden="true" />}
      title={query ? `Nada con "${query}"` : "Sin resultados para tu búsqueda"}
      description="Probá con un apodo, o mirá todas las zonas."
    >
      {onClearFilters && (
        <Button variant="ghost" className="mt-0.5" onClick={onClearFilters}>
          Limpiar filtros
        </Button>
      )}
    </EmptyFigure>
  )
}
