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
  { href: '/predictions', label: 'Pronósticos' },
  { href: '/leaderboard', label: 'Tabla' },
  { href: '/reglamento', label: 'Reglamento' },
  { href: '/inscripcion', label: 'Inscripción' },
  { href: '/account', label: '🔑 Cuenta' },
]

const Wordmark = () => (
  <span className="text-base font-black tracking-tight leading-none">
    <span style={{ color: '#E61D25' }}>P</span>
    <span style={{ color: '#ffffff' }}>O</span>
    <span style={{ color: '#2A398D' }}>L</span>
    <span style={{ color: '#ffffff' }}>L</span>
    <span style={{ color: '#3CAC3B' }}>A</span>
    <span className="ml-1.5 text-muted-foreground font-bold">26</span>
  </span>
)

export default function ParticipantNav({ userName, role }: { userName: string; role: string }) {
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
    <nav className="sticky top-0 z-50 bg-background/85 backdrop-blur-md">
      <div className="fifa-stripe w-full" style={{ height: '3px', borderRadius: 0 }} />
      <div className="border-b border-border/60">
        <div className="container mx-auto px-4 max-w-5xl">
          <div className="flex h-13 items-center justify-between gap-4">
            <Link href="/predictions" className="flex items-center gap-2 shrink-0">
              <Wordmark />
            </Link>

            {/* Desktop links */}
            <div className="hidden sm:flex items-center gap-0.5">
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
              {role === 'admin' && (
                <Link
                  href="/admin"
                  className="px-3 py-1.5 rounded-lg text-sm font-semibold text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
                >
                  Admin
                </Link>
              )}
            </div>

            {/* Desktop user + logout */}
            <div className="hidden sm:flex items-center gap-2 shrink-0">
              <span className="text-xs text-muted-foreground truncate max-w-24">{userName}</span>
              <Button variant="ghost" size="sm" onClick={logout} className="text-xs font-semibold">
                Salir
              </Button>
            </div>

            {/* Mobile hamburger */}
            <Sheet open={open} onOpenChange={setOpen}>
              <SheetTrigger render={<Button variant="ghost" size="icon" className="sm:hidden shrink-0" />}>
                <Menu className="h-5 w-5" />
              </SheetTrigger>
              <SheetContent side="right" className="w-72 flex flex-col gap-0">
                <div className="pb-4 border-b border-border/60 pt-2">
                  <Wordmark />
                </div>
                <nav className="flex flex-col gap-1 flex-1 pt-4">
                  {links.map(l => (
                    <SheetClose
                      key={l.href}
                      render={
                        <Link
                          href={l.href}
                          className={cn(
                            'px-3 py-2.5 rounded-lg text-sm font-semibold transition-colors',
                            pathname.startsWith(l.href)
                              ? 'bg-primary/15 text-primary border border-primary/30'
                              : 'text-muted-foreground hover:text-foreground hover:bg-accent'
                          )}
                        />
                      }
                    >
                      {l.label}
                    </SheetClose>
                  ))}
                  {role === 'admin' && (
                    <SheetClose
                      render={
                        <Link
                          href="/admin"
                          className="px-3 py-2.5 rounded-lg text-sm font-semibold text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
                        />
                      }
                    >
                      Admin
                    </SheetClose>
                  )}
                </nav>
                <div className="pt-4 border-t border-border/60 flex items-center justify-between">
                  <span className="text-xs text-muted-foreground truncate max-w-40">{userName}</span>
                  <Button variant="ghost" size="sm" onClick={() => { setOpen(false); logout() }} className="text-xs font-semibold">
                    Salir
                  </Button>
                </div>
              </SheetContent>
            </Sheet>
          </div>
        </div>
      </div>
    </nav>
  )
}
