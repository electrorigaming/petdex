// Módulo client-safe a propósito (mismo motivo que el comentario ya
// existente en src/lib/milestones.ts): <MarkTodayControl>, <SightingCalendar>
// y <PastDayDialog> son Client Components y lo importan como valor, no solo
// como tipo. No debe importar src/lib/supabase/server.ts ni ninguna función
// server-only — a diferencia de src/lib/pets.ts —, porque arrastraría código
// de servidor al bundle de cliente. El cliente de Supabase se recibe como
// parámetro (siempre src/lib/supabase/client.ts del lado del llamador, nunca
// instanciado acá) para que la cola offline (src/lib/offline/sync.ts) pueda
// reutilizar exactamente la misma función (contracts/mark-sighting.md).

import type { PostgrestError, SupabaseClient } from "@supabase/supabase-js"
import type { Database } from "@/types/database"
import { addDays, daysInMonthRange } from "@/lib/dates"

export type Sighting = {
  id: string
  petId: string
  seenOn: string
  seen: boolean
}

export type CalendarDayValue = "visto" | "revisado_no_estaba" | "sin_registro"

export type CalendarDay = {
  date: string
  value: CalendarDayValue
  pending: boolean
  selectable: boolean
}

export async function callMarkSighting(
  supabase: SupabaseClient<Database>,
  args: { petId: string; seen: boolean; date: string }
): Promise<{ data: Sighting } | { error: PostgrestError }> {
  const { data, error } = await supabase.rpc("mark_sighting", {
    p_pet_id: args.petId,
    p_seen: args.seen,
    p_date: args.date,
  })

  if (error) return { error }

  return {
    data: {
      id: data.id,
      petId: data.pet_id,
      seenOn: data.seen_on,
      seen: data.seen,
    },
  }
}

// Una sola consulta por mes visible, filtrada por rango — nunca una consulta
// por día ni una fila pregenerada para "sin registro" (contracts/sightings-read.md).
export async function getSightingsForMonth(
  supabase: SupabaseClient<Database>,
  petId: string,
  year: number,
  month: number
): Promise<Map<string, boolean>> {
  const days = daysInMonthRange(year, month)
  const firstDay = days[0]
  const lastDay = days[days.length - 1]

  const { data, error } = await supabase
    .from("sightings")
    .select("seen_on, seen")
    .eq("pet_id", petId)
    .gte("seen_on", firstDay)
    .lte("seen_on", lastDay)

  if (error) throw error

  return new Map((data ?? []).map((row) => [row.seen_on, row.seen]))
}

// Proyección en memoria, nunca en SQL (contracts/sightings-read.md).
// todayPendingValue ya presente en la firma desde User Story 2, pero
// User Story 2 siempre lo llama con null — recién User Story 5 (tasks.md
// T052) empieza a pasar un valor real, sin tocar esta función.
export function projectMonth(
  year: number,
  month: number,
  rows: Map<string, boolean>,
  registeredOn: string,
  today: string,
  todayPendingValue: boolean | null = null
): CalendarDay[] {
  return daysInMonthRange(year, month).map((date) => {
    const selectable = date >= registeredOn && date <= today

    if (date === today && todayPendingValue !== null) {
      return {
        date,
        value: todayPendingValue ? "visto" : "revisado_no_estaba",
        pending: true,
        selectable,
      }
    }

    if (rows.has(date)) {
      return {
        date,
        value: rows.get(date) ? "visto" : "revisado_no_estaba",
        pending: false,
        selectable,
      }
    }

    return { date, value: "sin_registro", pending: false, selectable }
  })
}

// Ventana completa [registered_on, hoy], sin tope adicional — alimenta
// computeStreak(), que puede necesitar ver más allá del mes en curso
// (data-model.md, "Algoritmo de racha").
export async function getStreakWindow(
  supabase: SupabaseClient<Database>,
  petId: string,
  registeredOn: string,
  today: string
): Promise<Map<string, boolean>> {
  const { data, error } = await supabase
    .from("sightings")
    .select("seen_on, seen")
    .eq("pet_id", petId)
    .gte("seen_on", registeredOn)
    .lte("seen_on", today)

  if (error) throw error

  return new Map((data ?? []).map((row) => [row.seen_on, row.seen]))
}

// Pura y testeada (tests/unit/streak.test.ts) — no toca IndexedDB ni
// Supabase, recibe el mapa de días ya cargado (data-model.md, "Algoritmo de
// racha"). Mismo bridge US2 → US5 que projectMonth: el parámetro ya está
// presente, pero solo User Story 5 le pasa algo distinto de null.
export function computeStreak(
  lookup: Map<string, boolean>,
  registeredOn: string,
  today: string,
  todayPendingValue: boolean | null = null
): number {
  let streak = 0
  let cursor = today

  while (cursor >= registeredOn) {
    const seen =
      cursor === today && todayPendingValue !== null ? todayPendingValue : lookup.get(cursor)

    if (seen === false) break // "revisado_no_estaba" corta la racha
    if (seen === true) streak += 1 // "visto" (incluye pendiente) la extiende
    // undefined ("sin_registro") no hace nada, sigue

    cursor = addDays(cursor, -1)
  }

  return streak
}
