import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import {
  addDays,
  compareDates,
  dayOfWeek,
  daysInMonthRange,
  isFuture,
  monthLabel,
  startOfMonth,
  todayLocal,
} from "@/lib/dates"

describe("todayLocal", () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it("a las 22:00 hora local (01:00 UTC del día siguiente) devuelve la fecha de hoy, no la de mañana", () => {
    // 2026-08-10 22:00 UTC-3 == 2026-08-11 01:00 UTC
    vi.useFakeTimers()
    vi.setSystemTime(new Date("2026-08-11T01:00:00.000Z"))
    expect(todayLocal()).toBe("2026-08-10")
  })

  it("al mediodía UTC (09:00 hora local) devuelve la fecha del día en curso", () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date("2026-08-10T12:00:00.000Z"))
    expect(todayLocal()).toBe("2026-08-10")
  })
})

describe("isFuture", () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date("2026-08-10T12:00:00.000Z")) // hoy local: 2026-08-10
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it("es true para una fecha posterior a hoy", () => {
    expect(isFuture("2026-08-11")).toBe(true)
  })

  it("es false para hoy", () => {
    expect(isFuture("2026-08-10")).toBe(false)
  })

  it("es false para una fecha pasada", () => {
    expect(isFuture("2026-08-09")).toBe(false)
  })
})

describe("compareDates", () => {
  it("devuelve -1 si a es anterior a b", () => {
    expect(compareDates("2026-08-01", "2026-08-02")).toBe(-1)
  })

  it("devuelve 1 si a es posterior a b", () => {
    expect(compareDates("2026-08-02", "2026-08-01")).toBe(1)
  })

  it("devuelve 0 si son iguales", () => {
    expect(compareDates("2026-08-01", "2026-08-01")).toBe(0)
  })
})

describe("addDays", () => {
  it("suma días dentro del mismo mes", () => {
    expect(addDays("2026-08-01", 3)).toBe("2026-08-04")
  })

  it("resta días cruzando el límite de mes", () => {
    expect(addDays("2026-08-01", -1)).toBe("2026-07-31")
  })

  it("suma días cruzando el límite de año", () => {
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01")
  })
})

describe("startOfMonth", () => {
  it("devuelve el primer día del mes de la fecha dada", () => {
    expect(startOfMonth("2026-08-17")).toBe("2026-08-01")
  })
})

describe("daysInMonthRange", () => {
  it("devuelve todos los días de un mes de 31 días", () => {
    const days = daysInMonthRange(2026, 8)
    expect(days).toHaveLength(31)
    expect(days[0]).toBe("2026-08-01")
    expect(days[30]).toBe("2026-08-31")
  })

  it("devuelve todos los días de febrero en año bisiesto", () => {
    const days = daysInMonthRange(2028, 2)
    expect(days).toHaveLength(29)
    expect(days[28]).toBe("2028-02-29")
  })

  it("devuelve todos los días de febrero en año no bisiesto", () => {
    const days = daysInMonthRange(2026, 2)
    expect(days).toHaveLength(28)
  })
})

describe("monthLabel", () => {
  it("devuelve el nombre del mes en español y el año", () => {
    expect(monthLabel(2026, 8)).toBe("agosto 2026")
  })
})

describe("dayOfWeek", () => {
  it("devuelve 0 para un domingo", () => {
    expect(dayOfWeek("2026-08-09")).toBe(0)
  })

  it("devuelve 6 para un sábado", () => {
    expect(dayOfWeek("2026-08-08")).toBe(6)
  })
})
