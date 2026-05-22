'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'

export default function PollaAdminNav({
  userName,
  pollaName,
  pollaSlug,
}: {
  userName: string
  pollaName: string
  pollaSlug: string
}) {
  const pathname = usePathname()
  const router = useRouter()
  const base = `/polla/${pollaSlug}`
  const adminBase = `${base}/admin`

  const links = [
    { href: adminBase, label: '📊 Dashboard', exact: true },
    { href: `${adminBase}/participants`, label: '👥 Participantes' },
    { href: `${adminBase}/results`, label: '⚽ Resultados' },
    { href: `${adminBase}/config`, label: '⚙️ Config' },
    { href: `${adminBase}/admins`, label: '🔐 Admins' },
  ]

  async function logout() {
    await fetch('/api/auth/logout', { method: 'POST' })
    toast.success('Sesión cerrada')
    router.push('/login')
    router.refresh()
  }

  return (
    <nav className="sticky top-0 z-50 border-b border-border bg-background/80 backdrop-blur-md">
      <div className="container mx-auto px-4 max-w-6xl">
        <div className="flex h-14 items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <Link href="/" className="text-base font-black tracking-tight leading-none shrink-0">
              <span style={{ color: '#E61D25' }}>P</span>
              <span style={{ color: '#ffffff' }}>O</span>
              <span style={{ color: '#2A398D' }}>L</span>
              <span style={{ color: '#ffffff' }}>L</span>
              <span style={{ color: '#3CAC3B' }}>A</span>
            </Link>
            <span className="text-muted-foreground/40 text-xs">/</span>
            <Link href={base} className="text-sm font-semibold text-muted-foreground hover:text-foreground transition-colors hidden sm:inline truncate max-w-28">
              {pollaName}
            </Link>
            <span className="text-muted-foreground/40 text-xs hidden sm:inline">/</span>
            <span className="text-xs font-semibold text-primary hidden sm:inline">Admin</span>
          </div>

          <div className="flex items-center gap-1 overflow-x-auto">
            {links.map(l => {
              const active = l.exact ? pathname === l.href : pathname.startsWith(l.href)
              return (
                <Link
                  key={l.href}
                  href={l.href}
                  className={cn(
                    'px-3 py-1.5 rounded-md text-xs font-medium transition-colors whitespace-nowrap',
                    active
                      ? 'bg-primary text-primary-foreground'
                      : 'text-muted-foreground hover:text-foreground hover:bg-accent'
                  )}
                >
                  {l.label}
                </Link>
              )
            })}
            <Link
              href={`${base}/predictions`}
              className="px-3 py-1.5 rounded-md text-xs font-medium transition-colors whitespace-nowrap text-muted-foreground hover:text-foreground hover:bg-accent"
            >
              🎯 Ver Polla
            </Link>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <span className="hidden sm:block text-xs text-muted-foreground">{userName}</span>
            <Button variant="ghost" size="sm" onClick={logout} className="text-xs">
              Salir
            </Button>
          </div>
        </div>
      </div>
    </nav>
  )
}
