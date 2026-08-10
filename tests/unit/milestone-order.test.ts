import { describe, expect, it } from "vitest"
import { sortMilestones, type Milestone } from "@/lib/milestones"

const milestones: Milestone[] = [
  { id: "1", title: "Primera vacuna", occurredOn: "2026-01-10", category: "salud", note: null },
  { id: "2", title: "Castración", occurredOn: "2026-03-05", category: "salud", note: null },
  { id: "3", title: "Cambio de dieta", occurredOn: "2026-02-01", category: "alimentacion", note: null },
]

describe("sortMilestones", () => {
  it("ordena de más reciente a más antigua por defecto", () => {
    const sorted = sortMilestones(milestones, "desc")
    expect(sorted.map((m) => m.id)).toEqual(["2", "3", "1"])
  })

  it("invierte a más antigua a más reciente", () => {
    const sorted = sortMilestones(milestones, "asc")
    expect(sorted.map((m) => m.id)).toEqual(["1", "3", "2"])
  })
})
