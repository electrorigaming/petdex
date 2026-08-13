"use client"

import { useMemo, useState } from "react"
import { EmptyState, NoResultsState } from "@/components/empty-states"
import { PetCard } from "@/components/pet-card"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { ViewToggle } from "@/components/view-toggle"
import { useCatalogSearch } from "@/components/catalog-search-context"
import { normalizeSearchText } from "@/lib/search"
import type { PetSummary } from "@/lib/pets"

export type PetGridProps = {
  pets: PetSummary[]
  total: number
}

const ALL_ZONES = "__all__"

export function PetGrid({ pets, total }: PetGridProps) {
  const { query, setQuery } = useCatalogSearch()

  if (total === 0) return <EmptyState />

  return <FilterablePetGrid pets={pets} total={total} query={query} setQuery={setQuery} />
}

function FilterablePetGrid({
  pets,
  total,
  query,
  setQuery,
}: PetGridProps & { query: string; setQuery: (q: string) => void }) {
  const zones = useMemo(
    () => [...new Set(pets.map((p) => p.zone).filter((z): z is string => Boolean(z)))],
    [pets]
  )

  // El estado de la zona no se comparte con el header (a diferencia del
  // buscador) — solo tiene sentido en esta pantalla, así que se queda local.
  const [zone, setZoneState] = useState(ALL_ZONES)

  const filtered = useMemo(() => {
    const normalizedQuery = normalizeSearchText(query.trim())
    return pets.filter((pet) => {
      const matchesZone = zone === ALL_ZONES || pet.zone === zone
      if (!matchesZone) return false
      if (!normalizedQuery) return true
      const haystack = normalizeSearchText([pet.name, ...pet.nicknames].join(" "))
      return haystack.includes(normalizedQuery)
    })
  }, [pets, query, zone])

  const trimmedQuery = query.trim()
  const isFiltered = trimmedQuery.length > 0 || zone !== ALL_ZONES

  function clearFilters() {
    setQuery("")
    setZoneState(ALL_ZONES)
  }

  return (
    <div className="flex flex-col gap-4">
      <div>
        {isFiltered ? (
          <>
            <p className="text-counter md:text-counter-lg text-foreground">{filtered.length}</p>
            <p className="mt-1 text-meta text-neutral-500">
              {trimmedQuery
                ? `resultados para "${trimmedQuery}"${zone !== ALL_ZONES ? ` en ${zone}` : ""}`
                : `mascotas en ${zone}`}
            </p>
          </>
        ) : (
          <>
            <p className="text-counter md:text-counter-lg text-foreground">{total}</p>
            <p className="mt-1 text-meta text-neutral-500">mascotas en el registro</p>
          </>
        )}
      </div>

      <div className="flex items-center gap-2.5">
        {zones.length > 0 && (
          <Select value={zone} onValueChange={setZoneState}>
            <SelectTrigger className="flex-1 md:w-[190px] md:flex-none" aria-label="Filtrar por zona">
              <SelectValue placeholder="Todas las zonas" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL_ZONES}>Todas las zonas</SelectItem>
              {zones.map((z) => (
                <SelectItem key={z} value={z}>
                  {z}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
        <ViewToggle className="md:ml-auto" />
      </div>

      {filtered.length === 0 ? (
        <NoResultsState query={trimmedQuery} onClearFilters={clearFilters} />
      ) : (
        <div className="pet-collection">
          {filtered.map((pet) => (
            <PetCard key={pet.slug} pet={pet} />
          ))}
        </div>
      )}
    </div>
  )
}
