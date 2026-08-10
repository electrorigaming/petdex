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
