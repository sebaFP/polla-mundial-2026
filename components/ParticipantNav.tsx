'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'

const links = [
  { href: '/predictions', label: 'Pronósticos' },
  { href: '/leaderboard', label: 'Tabla' },
]

export default function ParticipantNav({ userName, role }: { userName: string; role: string }) {
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
      <div className="container mx-auto px-4 max-w-5xl">
        <div className="flex h-14 items-center justify-between gap-4">
          <Link href="/predictions" className="flex items-center gap-2 font-bold text-gradient-gold">
            <span className="text-2xl">🏆</span>
            <span className="hidden sm:inline text-sm font-semibold">Mundial 2026</span>
          </Link>

          <div className="flex items-center gap-1">
            {links.map(l => (
              <Link
                key={l.href}
                href={l.href}
                className={cn(
                  'px-3 py-1.5 rounded-md text-sm font-medium transition-colors',
                  pathname.startsWith(l.href)
                    ? 'bg-primary text-primary-foreground'
                    : 'text-muted-foreground hover:text-foreground hover:bg-accent'
                )}
              >
                {l.label}
              </Link>
            ))}
            {role === 'admin' && (
              <Link
                href="/admin"
                className="px-3 py-1.5 rounded-md text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
              >
                Admin
              </Link>
            )}
          </div>

          <div className="flex items-center gap-2">
            <span className="hidden sm:block text-xs text-muted-foreground truncate max-w-24">
              {userName}
            </span>
            <Button variant="ghost" size="sm" onClick={logout} className="text-xs">
              Salir
            </Button>
          </div>
        </div>
      </div>
    </nav>
  )
}
