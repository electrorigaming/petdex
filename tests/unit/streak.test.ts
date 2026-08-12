import { describe, expect, it } from "vitest"
import { computeStreak } from "@/lib/sightings"

function lookupFrom(entries: Record<string, boolean>): Map<string, boolean> {
  return new Map(Object.entries(entries))
}

describe("computeStreak", () => {
  it("cuenta días 'visto' consecutivos hacia atrás desde hoy", () => {
    const lookup = lookupFrom({
      "2026-08-08": true,
      "2026-08-09": true,
      "2026-08-10": true,
    })
    expect(computeStreak(lookup, "2026-08-01", "2026-08-10")).toBe(3)
  })

  it("corta la racha en 'revisado_no_estaba'", () => {
    const lookup = lookupFrom({
      "2026-08-06": true,
      "2026-08-07": true,
      "2026-08-08": true,
      "2026-08-09": false, // corta acá
      "2026-08-10": true,
    })
    expect(computeStreak(lookup, "2026-08-01", "2026-08-10")).toBe(1)
  })

  it("el día sin registro ni corta ni extiende la racha (escenario completo de quickstart.md)", () => {
    // 3 días "visto" consecutivos, revisado_no_estaba, sin_registro, 2 "visto" (hoy incluido)
    const lookup = lookupFrom({
      "2026-08-03": true,
      "2026-08-04": true,
      "2026-08-05": true,
      "2026-08-06": false,
      // 2026-08-07 sin registro — ausencia de entrada en el mapa
      "2026-08-08": true,
      "2026-08-09": true,
    })
    expect(computeStreak(lookup, "2026-07-01", "2026-08-09")).toBe(2)
  })

  it("la racha se corta en registered_on aunque haya más historial hipotético antes", () => {
    const lookup = lookupFrom({
      "2026-08-08": true,
      "2026-08-09": true,
      "2026-08-10": true,
    })
    expect(computeStreak(lookup, "2026-08-09", "2026-08-10")).toBe(2)
  })

  it("hoy sin registro no corta la racha: sigue contando hacia atrás", () => {
    const lookup = lookupFrom({ "2026-08-09": true })
    expect(computeStreak(lookup, "2026-08-01", "2026-08-10")).toBe(1)
  })

  it("devuelve 0 si no hay ningún día 'visto' en toda la ventana", () => {
    const lookup = lookupFrom({ "2026-08-09": false })
    expect(computeStreak(lookup, "2026-08-01", "2026-08-10")).toBe(0)
  })

  it("una racha puede cruzar el límite de un mes", () => {
    const lookup = lookupFrom({
      "2026-07-30": true,
      "2026-07-31": true,
      "2026-08-01": true,
      "2026-08-02": true,
    })
    expect(computeStreak(lookup, "2026-07-01", "2026-08-02")).toBe(4)
  })

  it("todayPendingValue=true cuenta hoy como visto aunque no haya fila en el lookup", () => {
    const lookup = lookupFrom({ "2026-08-09": true })
    expect(computeStreak(lookup, "2026-08-01", "2026-08-10", true)).toBe(2)
  })

  it("todayPendingValue=false corta la racha en hoy aunque el lookup tenga hoy como visto", () => {
    const lookup = lookupFrom({ "2026-08-09": true, "2026-08-10": true })
    expect(computeStreak(lookup, "2026-08-01", "2026-08-10", false)).toBe(0)
  })

  it("todayPendingValue=null (default) usa el lookup para hoy", () => {
    const lookup = lookupFrom({ "2026-08-10": true })
    expect(computeStreak(lookup, "2026-08-01", "2026-08-10", null)).toBe(1)
  })
})
