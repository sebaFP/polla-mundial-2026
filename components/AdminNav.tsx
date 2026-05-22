'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'

const links = [
  { href: '/admin', label: '📊 Dashboard', exact: true },
  { href: '/admin/participants', label: '👥 Participantes' },
  { href: '/admin/results', label: '⚽ Resultados' },
  { href: '/admin/config', label: '⚙️ Configuración' },
]

export default function AdminNav({ userName }: { userName: string }) {
  const pathname = usePathname()
  const router = useRouter()

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
          <Link href="/admin" className="flex items-center gap-2 font-bold">
            <span className="text-2xl">🏆</span>
            <span className="text-sm font-semibold text-gradient-gold hidden sm:inline">Admin 2026</span>
          </Link>

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
