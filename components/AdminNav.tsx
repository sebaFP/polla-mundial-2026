'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Sheet, SheetContent, SheetTrigger, SheetClose } from '@/components/ui/sheet'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'
import { Menu } from 'lucide-react'

const links = [
  { href: '/admin', label: '📊 Dashboard', exact: true },
  { href: '/admin/participants', label: '👥 Participantes' },
  { href: '/admin/results', label: '⚽ Resultados' },
  { href: '/admin/config', label: '⚙️ Config' },
  { href: '/admin/admins', label: '🔐 Admins' },
]

export default function AdminNav({ userName, isParticipant }: { userName: string; isParticipant: boolean }) {
  const pathname = usePathname()
  const router = useRouter()
  const [open, setOpen] = useState(false)

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
          <Link href="/admin" className="flex items-center gap-2 font-bold shrink-0">
            <span className="text-2xl">🏆</span>
            <span className="text-sm font-semibold text-gradient-gold hidden sm:inline">Admin 2026</span>
          </Link>

          {/* Desktop links */}
          <div className="hidden sm:flex items-center gap-1">
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
            {isParticipant && (
              <Link
                href="/predictions"
                className="px-3 py-1.5 rounded-md text-xs font-medium transition-colors whitespace-nowrap text-muted-foreground hover:text-foreground hover:bg-accent"
              >
                🎯 Mis Pronósticos
              </Link>
            )}
          </div>

          {/* Desktop user + logout */}
          <div className="hidden sm:flex items-center gap-2 shrink-0">
            <span className="text-xs text-muted-foreground">{userName}</span>
            <Button variant="ghost" size="sm" onClick={logout} className="text-xs">
              Salir
            </Button>
          </div>

          {/* Mobile hamburger */}
          <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger render={<Button variant="ghost" size="icon" className="sm:hidden shrink-0" />}>
              <Menu className="h-5 w-5" />
            </SheetTrigger>
            <SheetContent side="right" className="w-72 flex flex-col gap-0">
              <div className="pb-4 border-b border-border/60 pt-2 flex items-center gap-2">
                <span className="text-2xl">🏆</span>
                <span className="text-sm font-semibold text-gradient-gold">Admin 2026</span>
              </div>
              <nav className="flex flex-col gap-1 flex-1 pt-4">
                {links.map(l => {
                  const active = l.exact ? pathname === l.href : pathname.startsWith(l.href)
                  return (
                    <SheetClose
                      key={l.href}
                      render={
                        <Link
                          href={l.href}
                          className={cn(
                            'px-3 py-2.5 rounded-md text-sm font-medium transition-colors',
                            active
                              ? 'bg-primary text-primary-foreground'
                              : 'text-muted-foreground hover:text-foreground hover:bg-accent'
                          )}
                        />
                      }
                    >
                      {l.label}
                    </SheetClose>
                  )
                })}
                {isParticipant && (
                  <SheetClose
                    render={
                      <Link
                        href="/predictions"
                        className="px-3 py-2.5 rounded-md text-sm font-medium transition-colors text-muted-foreground hover:text-foreground hover:bg-accent"
                      />
                    }
                  >
                    🎯 Mis Pronósticos
                  </SheetClose>
                )}
              </nav>
              <div className="pt-4 border-t border-border/60 flex items-center justify-between">
                <span className="text-xs text-muted-foreground truncate max-w-40">{userName}</span>
                <Button variant="ghost" size="sm" onClick={() => { setOpen(false); logout() }} className="text-xs">
                  Salir
                </Button>
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </nav>
  )
}
