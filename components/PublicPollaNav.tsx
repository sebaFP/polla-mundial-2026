'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import { Radio, Trophy } from 'lucide-react'

function Wordmark() {
  return (
    <span className="text-base font-black tracking-tight leading-none">
      <span style={{ color: '#E61D25' }}>P</span>
      <span style={{ color: '#ffffff' }}>O</span>
      <span style={{ color: '#2A398D' }}>L</span>
      <span style={{ color: '#ffffff' }}>L</span>
      <span style={{ color: '#3CAC3B' }}>A</span>
      <span className="ml-1.5 text-muted-foreground font-bold">26</span>
    </span>
  )
}

export default function PublicPollaNav({
  pollaName,
  pollaSlug,
}: {
  pollaName: string
  pollaSlug: string
}) {
  const pathname = usePathname()
  const base = `/polla/${pollaSlug}`

  const links = [
    { href: `${base}/live`, label: 'En Vivo', icon: Radio },
    { href: `${base}/leaderboard`, label: 'Tabla', icon: Trophy },
  ]

  return (
    <nav className="sticky top-0 z-50 bg-background/85 backdrop-blur-md">
      <div className="fifa-stripe w-full" style={{ height: '3px', borderRadius: 0 }} />
      <div className="border-b border-border/60">
        <div className="container mx-auto px-4 max-w-5xl">
          <div className="flex h-13 items-center justify-between gap-4">

            <div className="flex items-center gap-2 shrink-0 min-w-0">
              <Link href={base}>
                <Wordmark />
              </Link>
              <span className="text-muted-foreground/40 text-xs hidden sm:inline">/</span>
              <span className="text-sm font-semibold text-muted-foreground hidden sm:inline truncate max-w-32">
                {pollaName}
              </span>
            </div>

            <div className="flex items-center gap-0.5">
              {links.map(l => {
                const Icon = l.icon
                return (
                  <Link
                    key={l.href}
                    href={l.href}
                    className={cn(
                      'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-semibold transition-colors',
                      pathname.startsWith(l.href)
                        ? 'bg-primary/15 text-primary border border-primary/30'
                        : 'text-muted-foreground hover:text-foreground hover:bg-accent'
                    )}
                  >
                    <Icon className="h-3.5 w-3.5 sm:hidden" />
                    <span className="hidden sm:inline">{l.label}</span>
                    <span className="sm:hidden">{l.label}</span>
                  </Link>
                )
              })}
            </div>

            <Link
              href="/login"
              className="shrink-0 px-3 py-1.5 rounded-lg text-xs font-semibold bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
            >
              Iniciar sesión
            </Link>

          </div>
        </div>
      </div>
    </nav>
  )
}
