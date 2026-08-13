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

export const metadata: Metadata = {
  title: "PetDex",
  description: "Registro y seguimiento de animales callejeros del barrio",
  // iOS no lee manifest.json para el ícono de instalación a pantalla de
  // inicio (contracts/service-worker.md) — se referencia aparte acá.
  icons: {
    apple: "/icons/apple-touch-icon.png",
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="es" className={inter.variable}>
      <body className="font-sans">
        <Script
          id="view-preference"
          strategy="beforeInteractive"
          dangerouslySetInnerHTML={{ __html: VIEW_PREFERENCE_SCRIPT }}
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
