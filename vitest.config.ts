import path from "node:path"
import { defineConfig } from "vitest/config"

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  test: {
    environment: "node",
    include: ["tests/unit/**/*.test.ts", "tests/integration/**/*.test.ts"],
    setupFiles: ["./vitest.setup.ts"],
    // Los de integración pegan contra el proyecto real de Supabase (sign-in
    // + varias queries por test) — el default de 5000ms quedó justo al
    // límite incluso antes de esta feature (varios tests ya tardaban
    // 3000-4900ms) y con más tests de integración corriendo en la misma
    // corrida (007-roles-y-solicitudes) empezó a cortar tests que sí
    // terminaban bien, solo que tarde. Los unitarios no se ven afectados:
    // siguen terminando en milisegundos, el techo más alto no les cuesta
    // nada.
    testTimeout: 20000,
    // Varios archivos de integración corriendo en paralelo (default de
    // Vitest) multiplican los sign-in concurrentes contra el mismo proyecto
    // de Supabase y terminan gatillando su rate-limit de Auth
    // (`over_request_rate_limit`, 429) — confirmado en corridas reales.
    // Cada archivo ya comparte una sola sesión admin/usuario entre sus
    // tests (beforeAll/afterAll) para minimizar sign-ins, pero eso no
    // alcanza si varios archivos abren la suya al mismo tiempo. Correr los
    // archivos en serie es más lento (toda la suite tarda ~2 minutos en vez
    // de segundos) pero confiable — la alternativa (paralelo + reintentos
    // largos) sería más rápida en el caso feliz y mucho más lenta cuando el
    // límite se gatilla igual.
    fileParallelism: false,
  },
})
