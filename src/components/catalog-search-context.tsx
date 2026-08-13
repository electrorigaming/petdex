"use client"

// El buscador vive en el header (Nocturne 1e-B), pero el filtrado sigue
// siendo 100% client-side sobre los datos ya cargados por <PetGrid>
// (research.md de la feature 003 no cambia esto). Un Context compartido
// entre <AppHeader> y <PetGrid> evita tener que levantar el estado a través
// de la URL — <AppHeader> vive en app/layout.tsx (persiste entre
// navegaciones client-side), <PetGrid> vive en app/page.tsx: cuando se
// escribe estando en otra ruta, <AppHeader> navega a "/" y el valor ya
// tipeado sigue ahí porque el layout nunca se desmonta.

import { createContext, useContext, useState, type ReactNode } from "react"

type CatalogSearchContextValue = {
  query: string
  setQuery: (query: string) => void
}

const CatalogSearchContext = createContext<CatalogSearchContextValue>({
  query: "",
  setQuery: () => {},
})

export function CatalogSearchProvider({ children }: { children: ReactNode }) {
  const [query, setQuery] = useState("")
  return (
    <CatalogSearchContext.Provider value={{ query, setQuery }}>
      {children}
    </CatalogSearchContext.Provider>
  )
}

export function useCatalogSearch() {
  return useContext(CatalogSearchContext)
}
