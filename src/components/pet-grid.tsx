"use client"

import { useMemo, useState } from "react"
import { Search } from "lucide-react"
import { NoResultsState } from "@/components/empty-states"
import { PetCard } from "@/components/pet-card"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Input } from "@/components/ui/input"
import { ViewToggle } from "@/components/view-toggle"
import { normalizeSearchText } from "@/lib/search"
import type { PetSummary } from "@/lib/pets"

export type PetGridProps = {
  pets: PetSummary[]
  total: number
}

const ALL_ZONES = "__all__"

export function PetGrid({ pets, total }: PetGridProps) {
  const [query, setQuery] = useState("")
  const [zone, setZone] = useState(ALL_ZONES)

  const zones = useMemo(
    () => [...new Set(pets.map((p) => p.zone).filter((z): z is string => Boolean(z)))],
    [pets]
  )

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

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between gap-4">
        <p className="text-display text-foreground">{total}</p>
        <ViewToggle />
      </div>

      <div className="flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden="true"
          />
          <Input
            type="search"
            placeholder="Buscar por nombre o apodo"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="pl-9"
            aria-label="Buscar mascota por nombre o apodo"
          />
        </div>
        {zones.length > 0 && (
          <Select value={zone} onValueChange={setZone}>
            <SelectTrigger className="sm:w-48" aria-label="Filtrar por zona">
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
      </div>

      {filtered.length === 0 ? (
        <NoResultsState />
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
