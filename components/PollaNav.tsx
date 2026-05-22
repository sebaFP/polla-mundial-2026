'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'

export default function PollaNav({
  userName,
  pollaName,
  pollaSlug,
  myRole,
}: {
  userName: string
  pollaName: string
  pollaSlug: string
  myRole: 'admin' | 'participant'
}) {
  const pathname = usePathname()
  const router = useRouter()
  const base = `/polla/${pollaSlug}`

  const links = [
    { href: `${base}/predictions`, label: 'Pronósticos' },
    { href: `${base}/groups`, label: 'Grupos' },
    { href: `${base}/specials`, label: 'Especiales' },
    { href: `${base}/leaderboard`, label: 'Tabla' },
  ]

  async function logout() {
    await fetch('/api/auth/logout', { method: 'POST' })
    toast.success('Sesión cerrada')
    router.push('/login')
    router.refresh()
  }

  return (
    <nav className="sticky top-0 z-50 bg-background/85 backdrop-blur-md">
      <div className="fifa-stripe w-full" style={{ height: '3px', borderRadius: 0 }} />
      <div className="border-b border-border/60">
        <div className="container mx-auto px-4 max-w-5xl">
          <div className="flex h-13 items-center justify-between gap-4">
            <div className="flex items-center gap-3 shrink-0">
              <Link href="/" className="text-base font-black tracking-tight leading-none">
                <span style={{ color: '#E61D25' }}>P</span>
                <span style={{ color: '#ffffff' }}>O</span>
                <span style={{ color: '#2A398D' }}>L</span>
                <span style={{ color: '#ffffff' }}>L</span>
                <span style={{ color: '#3CAC3B' }}>A</span>
                <span className="ml-1.5 text-muted-foreground font-bold">26</span>
              </Link>
              <span className="text-muted-foreground/40 text-xs hidden sm:inline">/</span>
              <Link href={base} className="text-sm font-semibold text-muted-foreground hover:text-foreground transition-colors hidden sm:inline truncate max-w-36">
                {pollaName}
              </Link>
            </div>

            <div className="flex items-center gap-0.5">
              {links.map(l => (
                <Link
                  key={l.href}
                  href={l.href}
                  className={cn(
                    'px-3 py-1.5 rounded-lg text-sm font-semibold transition-colors',
                    pathname.startsWith(l.href)
                      ? 'bg-primary/15 text-primary border border-primary/30'
                      : 'text-muted-foreground hover:text-foreground hover:bg-accent'
                  )}
                >
                  {l.label}
                </Link>
              ))}
              {myRole === 'admin' && (
                <Link
                  href={`${base}/admin`}
                  className={cn(
                    'px-3 py-1.5 rounded-lg text-sm font-semibold transition-colors',
                    pathname.startsWith(`${base}/admin`)
                      ? 'bg-primary/15 text-primary border border-primary/30'
                      : 'text-muted-foreground hover:text-foreground hover:bg-accent'
                  )}
                >
                  Admin
                </Link>
              )}
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <span className="hidden sm:block text-xs text-muted-foreground truncate max-w-24">
                {userName}
              </span>
              <Button variant="ghost" size="sm" onClick={logout} className="text-xs font-semibold">
                Salir
              </Button>
            </div>
          </div>
        </div>
      </div>
    </nav>
  )
}
