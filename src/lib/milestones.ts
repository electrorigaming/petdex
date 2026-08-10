// Módulo client-safe a propósito: milestone-timeline.tsx (Client Component)
// importa sortMilestones como valor real, no como tipo. Cualquier función
// server-only (que use createClient/next/headers) que se agregue acá
// arrastraría todo el archivo al bundle de cliente — ver research.md §5.
// Esas funciones van en src/lib/pets.ts (solo importado por tipo desde
// componentes cliente) o en src/lib/actions/milestones.ts.

export type Milestone = {
  id: string
  title: string
  occurredOn: string
  category: "salud" | "alimentacion" | "comportamiento" | "otro" | null
  note: string | null
}

export function sortMilestones(
  milestones: Milestone[],
  direction: "desc" | "asc"
): Milestone[] {
  const sorted = [...milestones].sort((a, b) =>
    a.occurredOn < b.occurredOn ? -1 : a.occurredOn > b.occurredOn ? 1 : 0
  )
  return direction === "desc" ? sorted.reverse() : sorted
}

export type MilestoneWriteResult =
  | { ok: true; milestone: Milestone }
  | { ok: false; message: string }
