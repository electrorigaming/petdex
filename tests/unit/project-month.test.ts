import { describe, expect, it } from "vitest"
import { projectMonth } from "@/lib/sightings"

describe("projectMonth", () => {
  it("proyecta 'sin_registro' para un día sin fila ni pendiente", () => {
    const rows = new Map<string, boolean>()
    const days = projectMonth(2026, 8, rows, "2026-08-01", "2026-08-15")
    const day10 = days.find((d) => d.date === "2026-08-10")!
    expect(day10.value).toBe("sin_registro")
    expect(day10.pending).toBe(false)
  })

  it("mapea seen=true a 'visto' y seen=false a 'revisado_no_estaba'", () => {
    const rows = new Map([
      ["2026-08-05", true],
      ["2026-08-06", false],
    ])
    const days = projectMonth(2026, 8, rows, "2026-08-01", "2026-08-15")
    expect(days.find((d) => d.date === "2026-08-05")!.value).toBe("visto")
    expect(days.find((d) => d.date === "2026-08-06")!.value).toBe("revisado_no_estaba")
  })

  it("un día anterior a registered_on no es seleccionable", () => {
    const rows = new Map<string, boolean>()
    const days = projectMonth(2026, 8, rows, "2026-08-10", "2026-08-20")
    expect(days.find((d) => d.date === "2026-08-05")!.selectable).toBe(false)
    expect(days.find((d) => d.date === "2026-08-10")!.selectable).toBe(true)
  })

  it("un día futuro (posterior a hoy) no es seleccionable", () => {
    const rows = new Map<string, boolean>()
    const days = projectMonth(2026, 8, rows, "2026-08-01", "2026-08-15")
    expect(days.find((d) => d.date === "2026-08-20")!.selectable).toBe(false)
    expect(days.find((d) => d.date === "2026-08-15")!.selectable).toBe(true)
  })

  it("todayPendingValue !== null tiene prioridad sobre una fila ya confirmada de hoy", () => {
    const rows = new Map([["2026-08-15", false]])
    const days = projectMonth(2026, 8, rows, "2026-08-01", "2026-08-15", true)
    const today = days.find((d) => d.date === "2026-08-15")!
    expect(today.value).toBe("visto")
    expect(today.pending).toBe(true)
  })

  it("todayPendingValue=null (default) no afecta el día de hoy", () => {
    const rows = new Map([["2026-08-15", false]])
    const days = projectMonth(2026, 8, rows, "2026-08-01", "2026-08-15")
    const today = days.find((d) => d.date === "2026-08-15")!
    expect(today.value).toBe("revisado_no_estaba")
    expect(today.pending).toBe(false)
  })

  it("devuelve una celda por cada día del mes, sin huecos", () => {
    const rows = new Map<string, boolean>()
    const days = projectMonth(2026, 8, rows, "2026-08-01", "2026-08-31")
    expect(days).toHaveLength(31)
  })
})
