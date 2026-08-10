import { createClient } from "@/lib/supabase/server"
import type { Milestone } from "@/lib/milestones"

export type PetSummary = {
  slug: string
  name: string
  nicknames: string[]
  photoUrl: string | null
  zone: string | null
}

export type PetDetail = {
  name: string
  nicknames: string[]
  zone: string | null
  location: string | null
  registeredOn: string
  ageEstimate: string | null
  weightKg: number | null
  description: string | null
  photoUrl: string | null
}

export async function getPetSummaries(): Promise<PetSummary[]> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from("pets_overview")
    .select("slug, name, nicknames, photo_url, zone")
    .order("registered_on", { ascending: false })

  if (error) throw error

  return (data ?? []).map((row) => ({
    slug: row.slug!,
    name: row.name!,
    nicknames: row.nicknames ?? [],
    photoUrl: row.photo_url,
    zone: row.zone,
  }))
}

export async function getPetCount(): Promise<number> {
  const supabase = await createClient()
  const { count, error } = await supabase
    .from("pets_overview")
    .select("*", { count: "exact", head: true })

  if (error) throw error

  return count ?? 0
}

export async function getPetBySlug(
  slug: string
): Promise<(PetDetail & { id: string }) | null> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from("pets")
    .select(
      "id, name, nicknames, zone, location, registered_on, age_estimate, weight_kg, description, photo_url"
    )
    .eq("slug", slug)
    .maybeSingle()

  if (error) throw error
  if (!data) return null

  return {
    id: data.id,
    name: data.name,
    nicknames: data.nicknames ?? [],
    zone: data.zone,
    location: data.location,
    registeredOn: data.registered_on,
    ageEstimate: data.age_estimate,
    weightKg: data.weight_kg,
    description: data.description,
    photoUrl: data.photo_url,
  }
}

export async function getMilestonesForPet(petId: string): Promise<Milestone[]> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from("milestones")
    .select("id, title, occurred_on, category, note")
    .eq("pet_id", petId)
    .order("occurred_on", { ascending: false })

  if (error) throw error

  return (data ?? []).map((row) => ({
    id: row.id,
    title: row.title,
    occurredOn: row.occurred_on,
    category: row.category as Milestone["category"],
    note: row.note,
  }))
}

export async function getAllPetSlugs(): Promise<string[]> {
  const supabase = await createClient()
  const { data, error } = await supabase.from("pets").select("slug")

  if (error) throw error

  return (data ?? []).map((row) => row.slug)
}
