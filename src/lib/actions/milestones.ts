"use server"

// Archivo separado de src/lib/milestones.ts a propósito: Next.js no permite
// una Server Action inline ("use server" dentro del cuerpo de la función) en
// un módulo que un Client Component también importa por un export
// sincrónico (acá, milestone-timeline.tsx importa sortMilestones). El
// directive "use server" a nivel de archivo evita ese conflicto.

import { revalidatePath } from "next/cache"
import { createClient } from "@/lib/supabase/server"
import { mapPostgresError } from "@/lib/errors"
import { milestoneFieldsSchema, type MilestoneFormValues } from "@/lib/validation/milestone-schema"
import type { Milestone, MilestoneWriteResult } from "@/lib/milestones"
import type { Database } from "@/types/database"

function toDateString(date: Date): string {
  return date.toISOString().slice(0, 10)
}

async function requireAdminSession() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  return { supabase, user }
}

export async function createMilestone(
  petId: string,
  petSlug: string,
  input: MilestoneFormValues
): Promise<MilestoneWriteResult> {
  const parsed = milestoneFieldsSchema.safeParse(input)
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? "Datos inválidos." }
  }
  const values = parsed.data

  const { supabase, user } = await requireAdminSession()
  if (!user) {
    return { ok: false, message: "Iniciá sesión con una cuenta autorizada para continuar." }
  }

  const { data, error } = await supabase
    .from("milestones")
    .insert({
      pet_id: petId,
      title: values.title,
      occurred_on: toDateString(values.occurredOn),
      category: values.category ?? null,
      note: values.note || null,
    })
    .select("id, title, occurred_on, category, note")
    .single()

  if (error || !data) {
    return { ok: false, message: mapPostgresError(error) }
  }

  revalidatePath(`/mascotas/${petSlug}`, "page")
  return {
    ok: true,
    milestone: {
      id: data.id,
      title: data.title,
      occurredOn: data.occurred_on,
      category: data.category as Milestone["category"],
      note: data.note,
    },
  }
}

export async function updateMilestone(
  id: string,
  petSlug: string,
  input: MilestoneFormValues
): Promise<MilestoneWriteResult> {
  const parsed = milestoneFieldsSchema.safeParse(input)
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? "Datos inválidos." }
  }
  const values = parsed.data

  const { supabase, user } = await requireAdminSession()
  if (!user) {
    return { ok: false, message: "Iniciá sesión con una cuenta autorizada para continuar." }
  }

  const { data, error } = await supabase
    .from("milestones")
    .update({
      title: values.title,
      occurred_on: toDateString(values.occurredOn),
      category: values.category ?? null,
      note: values.note || null,
    })
    .eq("id", id)
    .select("id, title, occurred_on, category, note")
    .single()

  if (error || !data) {
    return { ok: false, message: mapPostgresError(error) }
  }

  revalidatePath(`/mascotas/${petSlug}`, "page")
  return {
    ok: true,
    milestone: {
      id: data.id,
      title: data.title,
      occurredOn: data.occurred_on,
      category: data.category as Milestone["category"],
      note: data.note,
    },
  }
}

export type MilestoneSnapshot = Database["public"]["Tables"]["milestones"]["Row"]

// Borrado inmediato (no diferido con setTimeout: un reload antes de que el
// timer termine dejaba el hito nunca borrado de verdad — bug real
// reportado en producción para el mismo patrón en <DeletePetButton>). La
// franja de Deshacer restaura desde esta copia en vez de cancelar una
// acción pendiente.
export async function deleteMilestone(
  id: string,
  petSlug: string
): Promise<{ ok: true; snapshot: MilestoneSnapshot } | { ok: false; message: string }> {
  const { supabase, user } = await requireAdminSession()
  if (!user) {
    return { ok: false, message: "Iniciá sesión con una cuenta autorizada para continuar." }
  }

  const { data: snapshot, error: fetchError } = await supabase
    .from("milestones")
    .select("*")
    .eq("id", id)
    .maybeSingle()

  if (fetchError || !snapshot) {
    return { ok: false, message: mapPostgresError(fetchError) }
  }

  const { error } = await supabase.from("milestones").delete().eq("id", id)
  if (error) {
    return { ok: false, message: mapPostgresError(error) }
  }

  revalidatePath(`/mascotas/${petSlug}`, "page")
  return { ok: true, snapshot }
}

export async function restoreMilestone(
  snapshot: MilestoneSnapshot,
  petSlug: string
): Promise<{ ok: true } | { ok: false; message: string }> {
  const { supabase, user } = await requireAdminSession()
  if (!user) {
    return { ok: false, message: "Iniciá sesión con una cuenta autorizada para continuar." }
  }

  const { error } = await supabase.from("milestones").insert(snapshot)
  if (error) {
    return { ok: false, message: mapPostgresError(error) }
  }

  revalidatePath(`/mascotas/${petSlug}`, "page")
  return { ok: true }
}
