// Único módulo del proyecto que instancia `Date` (research.md §2). Todo lo
// demás opera sobre strings "YYYY-MM-DD" y los compara lexicográficamente.

const LOCAL_OFFSET_HOURS = -3 // UTC-3 fijo — el barrio no observa horario de verano

const MONTH_NAMES = [
  "enero",
  "febrero",
  "marzo",
  "abril",
  "mayo",
  "junio",
  "julio",
  "agosto",
  "septiembre",
  "octubre",
  "noviembre",
  "diciembre",
]

function toDateString(date: Date): string {
  return date.toISOString().slice(0, 10)
}

export function todayLocal(): string {
  const now = new Date()
  const local = new Date(now.getTime() + LOCAL_OFFSET_HOURS * 3600_000)
  return toDateString(local)
}

export function isFuture(dateStr: string): boolean {
  return dateStr > todayLocal()
}

export function compareDates(a: string, b: string): -1 | 0 | 1 {
  if (a < b) return -1
  if (a > b) return 1
  return 0
}

export function addDays(dateStr: string, delta: number): string {
  const [year, month, day] = dateStr.split("-").map(Number)
  const date = new Date(Date.UTC(year, month - 1, day))
  date.setUTCDate(date.getUTCDate() + delta)
  return toDateString(date)
}

export function startOfMonth(dateStr: string): string {
  return `${dateStr.slice(0, 7)}-01`
}

export function daysInMonthRange(year: number, month: number): string[] {
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate()
  const monthStr = String(month).padStart(2, "0")
  return Array.from({ length: lastDay }, (_, i) => `${year}-${monthStr}-${String(i + 1).padStart(2, "0")}`)
}

export function monthLabel(year: number, month: number): string {
  return `${MONTH_NAMES[month - 1]} ${year}`
}

// 0 (domingo) a 6 (sábado) — para alinear la grilla del calendario bajo los
// encabezados de día de semana.
export function dayOfWeek(dateStr: string): number {
  const [year, month, day] = dateStr.split("-").map(Number)
  return new Date(Date.UTC(year, month - 1, day)).getUTCDay()
}
