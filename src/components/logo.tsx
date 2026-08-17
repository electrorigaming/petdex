// Marca "chapita" (design-system/design_handoff_v2/logo/README.md) — disco
// con la huella calada y una argolla arriba. Path set único acá, coloreado
// vía CSS vars (disco = --color-accent, calado = --color-bg) para que
// cambie con el tema claro/oscuro sin archivos duplicados ni JS.
//
// Dos formas, ambas correctas: el símbolo (con argolla) es para ≥28px; la
// argolla es un trazo de 7px que se empasta por debajo de esa altura, así
// que ahí corresponde la marca corta (disco solo) — nunca una versión
// reducida del símbolo. Esa regla vive acá adentro, no en cada llamada.

const RING_MIN_HEIGHT = 28

function MarkIcon({ size, decorative }: { size: number; decorative: boolean }) {
  return (
    <svg
      viewBox="0 0 100 100"
      style={{ height: size, width: "auto", display: "block", flexShrink: 0 }}
      role={decorative ? undefined : "img"}
      aria-hidden={decorative ? true : undefined}
    >
      {!decorative && <title>PetDex</title>}
      <circle cx="50" cy="50" r="46" fill="rgb(var(--color-accent))" />
      <g transform="translate(22,24) scale(0.56)" fill="rgb(var(--color-bg))">
        <ellipse cx="50" cy="68" rx="25" ry="20.5" />
        <ellipse cx="20" cy="44" rx="9.5" ry="12" transform="rotate(-22 20 44)" />
        <ellipse cx="38" cy="29" rx="9.5" ry="13" transform="rotate(-8 38 29)" />
        <ellipse cx="62" cy="29" rx="9.5" ry="13" transform="rotate(8 62 29)" />
        <ellipse cx="80" cy="44" rx="9.5" ry="12" transform="rotate(22 80 44)" />
      </g>
    </svg>
  )
}

function SymbolIcon({ size, decorative }: { size: number; decorative: boolean }) {
  return (
    <svg
      viewBox="0 0 100 106"
      style={{ height: size, width: "auto", display: "block", flexShrink: 0 }}
      role={decorative ? undefined : "img"}
      aria-hidden={decorative ? true : undefined}
    >
      {!decorative && <title>PetDex</title>}
      <circle cx="50" cy="14" r="9" fill="none" stroke="rgb(var(--color-accent))" strokeWidth="7" />
      <circle cx="50" cy="65" r="39" fill="rgb(var(--color-accent))" />
      <g transform="translate(22,41) scale(0.56)" fill="rgb(var(--color-bg))">
        <ellipse cx="50" cy="68" rx="25" ry="20.5" />
        <ellipse cx="20" cy="44" rx="9.5" ry="12" transform="rotate(-22 20 44)" />
        <ellipse cx="38" cy="29" rx="9.5" ry="13" transform="rotate(-8 38 29)" />
        <ellipse cx="62" cy="29" rx="9.5" ry="13" transform="rotate(8 62 29)" />
        <ellipse cx="80" cy="44" rx="9.5" ry="12" transform="rotate(22 80 44)" />
      </g>
    </svg>
  )
}

export function Logo({
  variant = "lockup",
  size = 27,
  className,
}: {
  variant?: "lockup" | "symbol" | "mark"
  size?: number
  className?: string
}) {
  const useMark = variant === "mark" || size < RING_MIN_HEIGHT

  if (variant === "symbol" || variant === "mark") {
    return useMark ? (
      <MarkIcon size={size} decorative={false} />
    ) : (
      <SymbolIcon size={size} decorative={false} />
    )
  }

  // Lockup: símbolo/marca + wordmark de texto real, nunca parte del SVG —
  // "Pet" en --color-text, "Dex" en --color-accent, Inter 600, un peso más
  // que los headings (500) porque el logo no es un heading (README).
  // Altura del símbolo = 1.4× el tamaño del wordmark; separación = 0.5× esa
  // altura.
  const wordmarkSize = size / 1.4
  const gap = size * 0.5

  return (
    <span className={className} style={{ display: "inline-flex", alignItems: "center", gap }}>
      {useMark ? (
        <MarkIcon size={size} decorative />
      ) : (
        <SymbolIcon size={size} decorative />
      )}
      <span
        style={{
          fontWeight: 600,
          fontSize: wordmarkSize,
          letterSpacing: "-0.035em",
          lineHeight: 1,
          whiteSpace: "nowrap",
        }}
      >
        <span style={{ color: "rgb(var(--color-text))" }}>Pet</span>
        <span style={{ color: "rgb(var(--color-accent))" }}>Dex</span>
      </span>
    </span>
  )
}
