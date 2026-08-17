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
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
  }
}
