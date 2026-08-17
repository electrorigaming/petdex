import type { MetadataRoute } from "next"

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "PetDex",
    short_name: "PetDex",
    description: "Registro y seguimiento de animales callejeros del barrio",
    display: "standalone",
    // --color-bg / --color-accent del tema claro (app/globals.css) — el
    // manifest no puede leer CSS vars, así que van literales acá.
    theme_color: "#fffdfb",
    background_color: "#fffdfb",
    // Vectoriales: "any" escala a cualquier tamaño que pida el sistema, sin
    // necesidad de exportar un raster por resolución (logo/README.md). Dos
    // archivos a propósito, no el mismo para las dos: el maskable tiene la
    // huella escalada al 45% dentro de la zona segura porque los
    // lanzadores de Android recortan el ícono a un círculo/redondeado y el
    // disco desaparece.
    icons: [
      { src: "/icons/icon-any.svg", sizes: "any", type: "image/svg+xml", purpose: "any" },
      { src: "/icons/icon-maskable.svg", sizes: "any", type: "image/svg+xml", purpose: "maskable" },
    ],
  }
}
