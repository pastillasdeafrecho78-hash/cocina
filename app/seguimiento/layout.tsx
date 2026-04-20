'use client'

import Link from 'next/link'
import BrandLogo from '@/components/BrandLogo'
import ThemeToggle from '@/components/ThemeToggle'

export default function SeguimientoLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="app-shell min-h-screen">
      <header className="app-header-shell sticky top-0 z-20 border-b border-stone-200/80 bg-white/90 backdrop-blur-md dark:border-stone-800 dark:bg-stone-950/90">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3 sm:px-6 lg:px-8">
          <Link href="/" className="inline-flex shrink-0 items-center" aria-label="ServimOS — inicio">
            <BrandLogo size="sm" priority className="h-12 w-44 max-w-[min(52vw,220px)]" />
          </Link>
          <ThemeToggle />
        </div>
      </header>
      <main className="px-4 py-6 sm:px-6 lg:px-8">{children}</main>
    </div>
  )
}
