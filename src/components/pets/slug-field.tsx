"use client"

import { useEffect, useRef, useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { generateSlug } from "@/lib/slug"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

export function SlugField({
  mode,
  name,
  value,
  onChange,
  currentPetId,
}: {
  mode: "create" | "edit"
  name: string
  value: string
  onChange: (slug: string) => void
  currentPetId?: string
}) {
  const [conflict, setConflict] = useState(false)
  const [touched, setTouched] = useState(false)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (mode !== "create" || touched) return
    onChange(generateSlug(name))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [name, mode, touched])

  useEffect(() => {
    if (mode === "edit" || !value) {
      setConflict(false)
      return
    }
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(async () => {
      const supabase = createClient()
      const query = supabase.from("pets").select("id").eq("slug", value)
      const { data } = currentPetId ? await query.neq("id", currentPetId) : await query
      setConflict(Boolean(data && data.length > 0))
    }, 300)
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [value, mode, currentPetId])

  return (
    <div className="flex flex-col gap-2">
      <Label htmlFor="slug">Identificador de la URL</Label>
      <Input
        id="slug"
        value={value}
        readOnly={mode === "edit"}
        onChange={(e) => {
          setTouched(true)
          onChange(e.target.value)
        }}
        aria-describedby={conflict ? "slug-conflict" : undefined}
        aria-invalid={conflict}
        className={mode === "edit" ? "bg-muted text-muted-foreground" : undefined}
      />
      {mode === "edit" ? (
        <p className="text-caption text-muted-foreground">
          No cambia al renombrar la mascota — las URLs ya compartidas siguen funcionando.
        </p>
      ) : (
        <p className="text-caption text-muted-foreground">
          Va a ser parte de la URL pública: /mascotas/{value || "…"}
        </p>
      )}
      {conflict && (
        <p id="slug-conflict" role="alert" className="text-label text-destructive">
          Ese identificador ya está en uso por otra mascota. Corregilo antes de guardar.
        </p>
      )}
    </div>
  )
}
