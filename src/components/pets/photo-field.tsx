"use client"

import { useRef, useState } from "react"
import Image from "next/image"
import { ImageOff, Loader2, X } from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import { compressToWebp } from "@/lib/image-compression"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"

const ALLOWED_MIME_TYPES = ["image/jpeg", "image/png", "image/webp", "image/avif"]

export type PhotoFieldValue = string | null | undefined

export function PhotoField({
  petId,
  initialPhotoUrl,
  value,
  onChange,
}: {
  petId: string
  initialPhotoUrl: string | null
  value: PhotoFieldValue
  onChange: (value: PhotoFieldValue) => void
}) {
  const [preview, setPreview] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const displayedPhoto = value === null ? null : preview ?? value ?? initialPhotoUrl

  async function handleFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    event.target.value = ""
    if (!file) return

    if (!ALLOWED_MIME_TYPES.includes(file.type)) {
      setError("Ese archivo no es una imagen en un formato admitido.")
      return
    }

    setError(null)
    setPreview(URL.createObjectURL(file))
    setUploading(true)

    try {
      const compressed = await compressToWebp(file)
      const path = `${petId}/${Date.now()}.webp`
      const supabase = createClient()
      const { error: uploadError } = await supabase.storage
        .from("pet-photos")
        .upload(path, compressed, { contentType: "image/webp" })

      if (uploadError) throw uploadError

      const {
        data: { publicUrl },
      } = supabase.storage.from("pet-photos").getPublicUrl(path)

      onChange(publicUrl)
    } catch {
      setError("No se pudo subir la foto. Probá de nuevo.")
      setPreview(null)
    } finally {
      setUploading(false)
    }
  }

  function handleRemove() {
    setPreview(null)
    onChange(null)
  }

  return (
    <div className="flex flex-col gap-2">
      <Label>Foto</Label>
      <div className="relative aspect-[4/3] w-full overflow-hidden rounded-lg bg-muted">
        {displayedPhoto ? (
          <Image
            src={displayedPhoto}
            alt=""
            fill
            sizes="(min-width: 768px) 600px, 100vw"
            className="object-cover"
            unoptimized={displayedPhoto.startsWith("blob:")}
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center">
            <ImageOff className="h-10 w-10 text-muted-foreground" aria-label="Sin foto" />
          </div>
        )}
        {uploading && (
          <div className="absolute inset-0 flex items-center justify-center gap-2 bg-foreground/40 text-body text-primary-foreground">
            <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" />
            Subiendo foto…
          </div>
        )}
      </div>

      <div className="flex gap-2">
        <Button
          type="button"
          variant="outline"
          onClick={() => inputRef.current?.click()}
          disabled={uploading}
        >
          {displayedPhoto ? "Cambiar foto" : "Elegir foto"}
        </Button>
        {displayedPhoto && (
          <Button
            type="button"
            variant="ghost"
            onClick={handleRemove}
            disabled={uploading}
            aria-label="Quitar foto"
          >
            <X className="h-4 w-4" aria-hidden="true" />
            Quitar
          </Button>
        )}
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={handleFileChange}
        className="sr-only"
        aria-label="Elegir foto desde la cámara o la galería"
      />

      {error && (
        <p role="alert" className="text-label text-destructive">
          {error}
        </p>
      )}
    </div>
  )
}
