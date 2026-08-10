const MAX_SIDE = 1600
const WEBP_QUALITY = 0.8

export function computeTargetDimensions(
  width: number,
  height: number
): { width: number; height: number } {
  const longestSide = Math.max(width, height)
  if (longestSide <= MAX_SIDE) return { width, height }

  const scale = MAX_SIDE / longestSide
  return {
    width: Math.round(width * scale),
    height: Math.round(height * scale),
  }
}

export async function compressToWebp(file: File): Promise<Blob> {
  const bitmap = await createImageBitmap(file)
  const { width, height } = computeTargetDimensions(bitmap.width, bitmap.height)

  const canvas = document.createElement("canvas")
  canvas.width = width
  canvas.height = height

  const ctx = canvas.getContext("2d")
  if (!ctx) throw new Error("No se pudo preparar la imagen para comprimir.")
  ctx.drawImage(bitmap, 0, 0, width, height)
  bitmap.close()

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("No se pudo comprimir la imagen."))),
      "image/webp",
      WEBP_QUALITY
    )
  })
}
