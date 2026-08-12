import type { Metadata } from "next"
import { Inter } from "next/font/google"
import Link from "next/link"
import Script from "next/script"
import { SessionNavLink } from "@/components/auth/session-nav-link"
import { SessionProvider } from "@/components/auth/session-provider"
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
      <body>
        <Script
          id="view-preference"
          strategy="beforeInteractive"
          dangerouslySetInnerHTML={{ __html: VIEW_PREFERENCE_SCRIPT }}
        />
        <SessionProvider>
          <OfflineSyncProvider />
          <UpdateAvailableBanner />
          <OfflineBanner />
          <SyncFailureBanner />
          <header className="border-b border-border">
            <div className="mx-auto flex max-w-screen-xl items-center justify-between px-4 py-3 md:px-6">
              <Link href="/" className="text-label font-semibold text-foreground">
                PetDex
              </Link>
              <SessionNavLink />
            </div>
          </header>
          {children}
        </SessionProvider>
      </body>
    </html>
  )
}
