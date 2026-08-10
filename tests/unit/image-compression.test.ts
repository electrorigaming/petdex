import { describe, expect, it } from "vitest"
import { computeTargetDimensions } from "@/lib/image-compression"

// compressToWebp en sí usa createImageBitmap + <canvas>, APIs de navegador
// que no existen en el entorno "node" de Vitest y que no vale la pena
// poliflenar con un paquete nativo de canvas ("sin dependencias pesadas",
// CLAUDE.md). La lógica de redimensión es pura y se prueba acá; que la
// salida sea WebP a calidad 0.8 queda verificado en un navegador real por
// tests/e2e/admin-flow.spec.ts.
describe("computeTargetDimensions", () => {
  it("reduce el lado mayor a 1600px manteniendo la proporción", () => {
    expect(computeTargetDimensions(3200, 2400)).toEqual({ width: 1600, height: 1200 })
  })

  it("reduce el lado mayor a 1600px cuando la imagen es vertical", () => {
    expect(computeTargetDimensions(2400, 3200)).toEqual({ width: 1200, height: 1600 })
  })

  it("no agranda una imagen ya menor a 1600px", () => {
    expect(computeTargetDimensions(800, 600)).toEqual({ width: 800, height: 600 })
  })

  it("no altera una imagen cuadrada exactamente en el límite", () => {
    expect(computeTargetDimensions(1600, 1600)).toEqual({ width: 1600, height: 1600 })
  })
})
