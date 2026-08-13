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
    <div className="field">
      <Label htmlFor="slug">Dirección de la ficha</Label>
      <div className="flex items-center">
        <span className="whitespace-nowrap rounded-l-md border border-r-0 border-divider bg-sunken px-2.5 py-1.5 font-mono text-[13px] text-neutral-600">
          petdex.app/mascotas/
        </span>
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
          className={
            mode === "edit"
              ? "rounded-l-none font-mono text-[13px] text-neutral-500"
              : "rounded-l-none font-mono text-[13px]"
          }
        />
      </div>
      {mode === "edit" ? (
        <p className="mt-1.5 text-legend text-neutral-600">
          No cambia al renombrar la mascota — las URLs ya compartidas siguen funcionando.
        </p>
      ) : (
        <p className="mt-1.5 text-legend text-neutral-600">
          Va a ser parte de la URL pública: /mascotas/{value || "…"}
        </p>
      )}
      {conflict && (
        <p id="slug-conflict" role="alert" className="mt-1.5 text-meta text-accent-400">
          Ese identificador ya está en uso por otra mascota. Corregilo antes de guardar.
        </p>
      )}
    </div>
  )
}
