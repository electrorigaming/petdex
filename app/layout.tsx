import type { Metadata } from "next"
import { Inter } from "next/font/google"
import Script from "next/script"
import { AdminGate } from "@/components/auth/admin-gate"
import { SessionProvider } from "@/components/auth/session-provider"
import { AppHeader } from "@/components/app-header"
import { CatalogSearchProvider } from "@/components/catalog-search-context"
import { DeleteUndoProvider } from "@/components/delete-undo-context"
import { OfflineBanner } from "@/components/offline/offline-banner"
import { OfflineSyncProvider } from "@/components/offline/offline-sync-provider"
import { SyncFailureBanner } from "@/components/offline/sync-failure-banner"
import { UpdateAvailableBanner } from "@/components/offline/update-available-banner"
import "./globals.css"

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" })

const VIEW_PREFERENCE_SCRIPT = `
(function () {
  try {
    var view = localStorage.getItem('petdex:view');
    if (view === 'list') {
      document.documentElement.setAttribute('data-view', 'list');
    }
  } catch (e) {}
})();
`

// localStorage > prefers-color-scheme del SO > claro por defecto. Corre
// antes de la hidratación (mismo mecanismo que VIEW_PREFERENCE_SCRIPT) para
// no flashear el tema equivocado; use-theme.ts solo LEE lo que este script
// ya decidió, nunca lo recalcula.
const THEME_PREFERENCE_SCRIPT = `
(function () {
  try {
    var stored = localStorage.getItem('petdex-theme');
    var dark = stored ? stored === 'dark' : window.matchMedia('(prefers-color-scheme: dark)').matches;
    if (dark) {
      document.documentElement.setAttribute('data-theme', 'dark');
      document.querySelector('meta[name="theme-color"]').setAttribute('content', '#17120f');
    }
  } catch (e) {}
})();
`

export const metadata: Metadata = {
  title: "PetDex",
  description: "Registro y seguimiento de animales callejeros del barrio",
  icons: {
    // SVG primero: cambia de tema solo vía prefers-color-scheme (embebido
    // en el propio archivo, ver logo/README.md). El .ico es el fallback
    // para el puñado de navegadores/crawlers que todavía no soportan
    // favicons SVG.
    icon: [
      { url: "/icons/favicon.svg", type: "image/svg+xml" },
      { url: "/icons/favicon.ico", sizes: "32x32" },
    ],
    // iOS no lee manifest.json para el ícono de instalación a pantalla de
    // inicio (contracts/service-worker.md) — se referencia aparte acá.
    apple: "/icons/apple-touch-icon.png",
  },
  // Valor por defecto (tema claro); THEME_PREFERENCE_SCRIPT lo pisa antes
  // de pintar si corresponde oscuro, y use-theme.ts lo mantiene sincronizado
  // después de cada toggle manual.
  other: {
    "theme-color": "#fffdfb",
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="es" className={inter.variable} suppressHydrationWarning>
      <body className="font-sans">
        <Script
          id="view-preference"
          strategy="beforeInteractive"
          dangerouslySetInnerHTML={{ __html: VIEW_PREFERENCE_SCRIPT }}
        />
        <Script
          id="theme-preference"
          strategy="beforeInteractive"
          dangerouslySetInnerHTML={{ __html: THEME_PREFERENCE_SCRIPT }}
        />
        <SessionProvider>
          <CatalogSearchProvider>
            <DeleteUndoProvider>
              <OfflineSyncProvider />
              <UpdateAvailableBanner />
              <OfflineBanner />
              <SyncFailureBanner />
              <AppHeader />
              <AdminGate>{children}</AdminGate>
            </DeleteUndoProvider>
          </CatalogSearchProvider>
        </SessionProvider>
      </body>
    </html>
  )
}
