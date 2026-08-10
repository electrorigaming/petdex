import type { Metadata } from "next"
import { Inter } from "next/font/google"
import Link from "next/link"
import Script from "next/script"
import { Suspense } from "react"
import { SessionNavLink } from "@/components/auth/session-nav-link"
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
        <header className="border-b border-border">
          <div className="mx-auto flex max-w-screen-xl items-center justify-between px-4 py-3 md:px-6">
            <Link href="/" className="text-label font-semibold text-foreground">
              PetDex
            </Link>
            <Suspense fallback={null}>
              <SessionNavLink />
            </Suspense>
          </div>
        </header>
        {children}
      </body>
    </html>
  )
}
