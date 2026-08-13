"use client"

import { useRef, useState } from "react"
import Image from "next/image"
import { ImageSquareIcon } from "@phosphor-icons/react/dist/ssr/ImageSquare"
import { ArrowClockwiseIcon } from "@phosphor-icons/react/dist/ssr/ArrowClockwise"
import { XIcon } from "@phosphor-icons/react/dist/ssr/X"
import { WarningIcon } from "@phosphor-icons/react/dist/ssr/Warning"
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
    <div className="field">
      <Label>Foto</Label>
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={uploading}
        className="relative aspect-[3/2] w-full overflow-hidden rounded-md border border-dashed border-neutral-800 bg-sunken disabled:opacity-70"
      >
        {displayedPhoto ? (
          <Image
            src={displayedPhoto}
            alt=""
            fill
            sizes="(min-width: 768px) 320px, 100vw"
            className="lighten object-cover"
            unoptimized={displayedPhoto.startsWith("blob:")}
          />
        ) : (
          <div className="flex h-full w-full flex-col items-center justify-center gap-1.5 px-4 text-center">
            <ImageSquareIcon size={26} className="text-neutral-700" aria-hidden="true" />
            <span className="text-caption text-neutral-500">Arrastrá una foto o elegí un archivo</span>
            <span className="font-mono text-[10px] text-neutral-700">se comprime a 1600px · webp</span>
          </div>
        )}
      </button>

      {uploading && (
        <div className="mt-2 flex items-center gap-2.5 rounded-md bg-sunken px-3 py-2.5">
          <ArrowClockwiseIcon size={16} className="animate-spin text-accent" aria-hidden="true" />
          <span className="flex-1 text-meta text-neutral-400">Subiendo foto…</span>
        </div>
      )}

      {displayedPhoto && !uploading && (
        <div className="mt-2 flex gap-2">
          <Button type="button" variant="secondary" onClick={() => inputRef.current?.click()}>
            Cambiar foto
          </Button>
          <Button type="button" variant="ghost" onClick={handleRemove} aria-label="Quitar foto">
            <XIcon size={14} aria-hidden="true" />
            Quitar
          </Button>
        </div>
      )}

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
        <p role="alert" className="mt-1.5 flex items-center gap-1.5 text-meta text-accent-400">
          <WarningIcon size={14} aria-hidden="true" />
          {error}
        </p>
      )}
    </div>
  )
}
