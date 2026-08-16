import type { PetStatus, PetSummary } from "@/lib/pets"
import type { PetVisibility } from "@/lib/validation/pet-schema"

export type PetFilters = {
  estado: PetStatus[]
  esterilizado: boolean[]
  tipo: PetVisibility[]
}

export const EMPTY_PET_FILTERS: PetFilters = { estado: [], esterilizado: [], tipo: [] }

// Grupo vacío = sin filtrar por ese grupo (spec.md FR-008), nunca "sin
// resultados". Dentro de un grupo los chips se combinan con OR; entre grupos
// distintos, con AND (spec.md FR-006/FR-007).
export function matchesFilters(pet: PetSummary, filters: PetFilters): boolean {
  const matchesEstado = filters.estado.length === 0 || filters.estado.includes(pet.status)
  const matchesEsterilizado =
    filters.esterilizado.length === 0 || filters.esterilizado.includes(pet.sterilized)
  const matchesTipo = filters.tipo.length === 0 || filters.tipo.includes(pet.visibility)
  return matchesEstado && matchesEsterilizado && matchesTipo
}

export function countActiveFilters(filters: PetFilters): number {
  return filters.estado.length + filters.esterilizado.length + filters.tipo.length
}
