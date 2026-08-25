"use client"

import { useEffect, useMemo, useRef, useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { ArrowsClockwiseIcon } from "@phosphor-icons/react/dist/ssr/ArrowsClockwise"
import { FunnelSimpleIcon } from "@phosphor-icons/react/dist/ssr/FunnelSimple"
import { XIcon } from "@phosphor-icons/react/dist/ssr/X"
import { EmptyState, NoResultsState } from "@/components/empty-states"
import { PetCard } from "@/components/pet-card"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { FilterChip } from "@/components/ui/filter-chip"
import { ViewToggle } from "@/components/view-toggle"
import { useCatalogSearch } from "@/components/catalog-search-context"
import { useSession } from "@/hooks/use-session"
import { useOnlineStatus } from "@/hooks/use-online-status"
import { usePageVisibility } from "@/hooks/use-page-visibility"
import { normalizeSearchText } from "@/lib/search"
import { matchesFilters, countActiveFilters, EMPTY_PET_FILTERS, type PetFilters } from "@/lib/pet-filters"
import {
  PET_STATUS_OPTIONS,
  PET_STATUS_LABEL,
  PET_VISIBILITY_OPTIONS,
  PET_VISIBILITY_LABEL,
  PET_GENDER_OPTIONS,
  PET_GENDER_LABEL,
  type PetVisibility,
  type PetGender,
} from "@/lib/validation/pet-schema"
import type { PetSummary, PetStatus } from "@/lib/pets"

export type PetGridProps = {
  pets: PetSummary[]
  total: number
}

const ALL_ZONES = "__all__"

// Silencioso a propósito (sin indicador de "actualizado hace N min") — el
// mismo criterio minimalista que ya usa el resto de la cuadrícula.
const AUTO_REFRESH_INTERVAL_MS = 15 * 60 * 1000

// Vista inicial: activas y públicas. "Limpiar filtros" sigue llevando a
// EMPTY_PET_FILTERS (ver todo) — este es solo el punto de partida la primera
// vez que se abre la pantalla, antes de que haya algo guardado en
// localStorage (FILTERS_STORAGE_KEY).
const DEFAULT_PET_FILTERS: PetFilters = {
  estado: ["activo"],
  esterilizado: [],
  tipo: ["publico"],
  genero: [],
}

// Filtros elegidos a mano: se recuerdan entre visitas (mismo criterio que
// petdex:view para la vista grid/lista). Se lee después del primer render
// (no en el estado inicial) para que el HTML del cliente coincida con el
// del servidor y no dispare un warning de hidratación — el filtro guardado
// se aplica un instante después, como un segundo render.
const FILTERS_STORAGE_KEY = "petdex:filters"

function isPetFilters(value: unknown): value is PetFilters {
  if (typeof value !== "object" || value === null) return false
  const v = value as Record<string, unknown>
  return (
    Array.isArray(v.estado) &&
    v.estado.every((s) => PET_STATUS_OPTIONS.includes(s)) &&
    Array.isArray(v.esterilizado) &&
    v.esterilizado.every((s) => typeof s === "boolean") &&
    Array.isArray(v.tipo) &&
    v.tipo.every((s) => PET_VISIBILITY_OPTIONS.includes(s)) &&
    Array.isArray(v.genero) &&
    v.genero.every((s) => PET_GENDER_OPTIONS.includes(s))
  )
}

function loadStoredFilters(): PetFilters | null {
  try {
    const raw = localStorage.getItem(FILTERS_STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    return isPetFilters(parsed) ? parsed : null
  } catch {
    return null
  }
}

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
  const [filters, setFilters] = useState<PetFilters>(DEFAULT_PET_FILTERS)
  const [filtersOpen, setFiltersOpen] = useState(false)
  const { isEditor } = useSession()

  const router = useRouter()
  const [isRefreshing, startRefresh] = useTransition()
  const isOnline = useOnlineStatus()
  const isPageVisible = usePageVisibility()

  function refresh() {
    startRefresh(() => router.refresh())
  }

  // Se lee recién en un efecto (no en el estado inicial) para que el primer
  // render del cliente coincida con el del servidor. skipNextPersist evita
  // que el efecto de guardado de abajo corra con el valor por defecto
  // todavía en `filters` antes de que el setFilters de acá se aplique — sin
  // el guard, esa escritura pisa el valor recién leído de localStorage.
  const skipNextPersist = useRef(true)

  useEffect(() => {
    const stored = loadStoredFilters()
    if (stored) setFilters(stored)
  }, [])

  useEffect(() => {
    if (skipNextPersist.current) {
      skipNextPersist.current = false
      return
    }
    localStorage.setItem(FILTERS_STORAGE_KEY, JSON.stringify(filters))
  }, [filters])

  // Pausado sin conexión y con la pestaña en segundo plano — mismo criterio
  // event-driven que <OfflineSyncProvider>, no un timer incondicional.
  useEffect(() => {
    if (!isOnline || !isPageVisible) return
    const id = setInterval(() => {
      startRefresh(() => router.refresh())
    }, AUTO_REFRESH_INTERVAL_MS)
    return () => clearInterval(id)
  }, [isOnline, isPageVisible, router, startRefresh])

  const filtered = useMemo(() => {
    const normalizedQuery = normalizeSearchText(query.trim())
    return pets.filter((pet) => {
      const matchesZone = zone === ALL_ZONES || pet.zone === zone
      if (!matchesZone) return false
      if (!matchesFilters(pet, filters)) return false
      if (!normalizedQuery) return true
      const haystack = normalizeSearchText([pet.name, ...pet.nicknames].join(" "))
      return haystack.includes(normalizedQuery)
    })
  }, [pets, query, zone, filters])

  const trimmedQuery = query.trim()
  const activeFilterCount = countActiveFilters(filters)
  const isFiltered = trimmedQuery.length > 0 || zone !== ALL_ZONES || activeFilterCount > 0

  function clearFilters() {
    setQuery("")
    setZoneState(ALL_ZONES)
    setFilters(EMPTY_PET_FILTERS)
  }

  function toggleEstado(status: PetStatus) {
    setFilters((f) => ({
      ...f,
      estado: f.estado.includes(status) ? f.estado.filter((s) => s !== status) : [...f.estado, status],
    }))
  }

  function toggleEsterilizado(value: boolean) {
    setFilters((f) => ({
      ...f,
      esterilizado: f.esterilizado.includes(value)
        ? f.esterilizado.filter((v) => v !== value)
        : [...f.esterilizado, value],
    }))
  }

  function toggleTipo(value: PetVisibility) {
    setFilters((f) => ({
      ...f,
      tipo: f.tipo.includes(value) ? f.tipo.filter((v) => v !== value) : [...f.tipo, value],
    }))
  }

  function toggleGenero(value: PetGender) {
    setFilters((f) => ({
      ...f,
      genero: f.genero.includes(value) ? f.genero.filter((v) => v !== value) : [...f.genero, value],
    }))
  }

  return (
    <div className="flex flex-col gap-4">
      <div>
        {isFiltered ? (
          <>
            <p className="text-counter md:text-counter-lg text-foreground">{filtered.length}</p>
            <p className="mt-1 text-meta text-text-secondary">
              {trimmedQuery
                ? `resultados para "${trimmedQuery}"${zone !== ALL_ZONES ? ` en ${zone}` : ""}`
                : zone !== ALL_ZONES
                  ? `mascotas en ${zone}`
                  : "resultados con los filtros activos"}
            </p>
          </>
        ) : (
          <>
            <p className="text-counter md:text-counter-lg text-foreground">{total}</p>
            <p className="mt-1 text-meta text-text-secondary">mascotas en el registro</p>
          </>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2.5">
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
        <button
          type="button"
          aria-pressed={filtersOpen}
          aria-expanded={filtersOpen}
          onClick={() => setFiltersOpen((open) => !open)}
          className="inline-flex h-9 items-center gap-1.5 rounded-md border border-divider px-3 text-label text-text transition-colors duration-150 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring data-[active=true]:border-accent data-[active=true]:text-accent-text"
          data-active={activeFilterCount > 0}
        >
          <FunnelSimpleIcon size={15} aria-hidden="true" />
          Filtros{activeFilterCount > 0 ? ` (${activeFilterCount})` : ""}
        </button>
        {isFiltered && (
          <button
            type="button"
            onClick={clearFilters}
            className="inline-flex h-9 items-center gap-1.5 rounded-md px-3 text-label text-accent-text transition-colors duration-150 hover:bg-accent/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
          >
            <XIcon size={15} aria-hidden="true" />
            Limpiar filtros
          </button>
        )}
        <button
          type="button"
          onClick={refresh}
          disabled={isRefreshing || !isOnline}
          aria-label="Actualizar registro"
          title={isOnline ? "Actualizar" : "Sin conexión"}
          className="inline-flex h-9 items-center gap-1.5 rounded-md border border-divider px-3 text-label text-text transition-colors duration-150 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:opacity-50"
        >
          <ArrowsClockwiseIcon
            size={15}
            aria-hidden="true"
            className={isRefreshing ? "animate-spin" : undefined}
          />
          Actualizar
        </button>
        <ViewToggle className="md:ml-auto" />
      </div>

      {filtersOpen && (
        <div className="flex flex-col gap-3 rounded-md border border-divider p-3">
          <div>
            <p className="mb-1.5 text-legend uppercase tracking-wide text-text-secondary">Estado</p>
            <div className="flex flex-wrap gap-2">
              {PET_STATUS_OPTIONS.map((status) => (
                <FilterChip
                  key={status}
                  aria-pressed={filters.estado.includes(status)}
                  onClick={() => toggleEstado(status)}
                >
                  {PET_STATUS_LABEL[status]}
                </FilterChip>
              ))}
            </div>
          </div>
          <div>
            <p className="mb-1.5 text-legend uppercase tracking-wide text-text-secondary">Esterilizado</p>
            <div className="flex flex-wrap gap-2">
              <FilterChip
                aria-pressed={filters.esterilizado.includes(true)}
                onClick={() => toggleEsterilizado(true)}
              >
                Esterilizado
              </FilterChip>
              <FilterChip
                aria-pressed={filters.esterilizado.includes(false)}
                onClick={() => toggleEsterilizado(false)}
              >
                No esterilizado
              </FilterChip>
            </div>
          </div>
          <div>
            <p className="mb-1.5 text-legend uppercase tracking-wide text-text-secondary">Género</p>
            <div className="flex flex-wrap gap-2">
              {PET_GENDER_OPTIONS.map((gender) => (
                <FilterChip
                  key={gender}
                  aria-pressed={filters.genero.includes(gender)}
                  onClick={() => toggleGenero(gender)}
                >
                  {PET_GENDER_LABEL[gender]}
                </FilterChip>
              ))}
            </div>
          </div>
          {isEditor && (
            <div>
              <p className="mb-1.5 text-legend uppercase tracking-wide text-text-secondary">Tipo</p>
              <div className="flex flex-wrap gap-2">
                {PET_VISIBILITY_OPTIONS.map((visibility) => (
                  <FilterChip
                    key={visibility}
                    aria-pressed={filters.tipo.includes(visibility)}
                    onClick={() => toggleTipo(visibility)}
                  >
                    {PET_VISIBILITY_LABEL[visibility]}
                  </FilterChip>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

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
