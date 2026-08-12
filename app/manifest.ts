import type { MetadataRoute } from "next"

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "PetDex",
    short_name: "PetDex",
    description: "Registro y seguimiento de animales callejeros del barrio",
    display: "standalone",
    theme_color: "#2563eb",
    background_color: "#fafafa",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
  }
}
