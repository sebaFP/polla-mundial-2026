'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Sheet, SheetContent, SheetTrigger, SheetClose } from '@/components/ui/sheet'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'
import { Menu } from 'lucide-react'

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
  const [open, setOpen] = useState(false)

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
          <div className="flex items-center gap-2 shrink-0">
            <Link href="/" className="text-base font-black tracking-tight leading-none">
              <span style={{ color: '#E61D25' }}>P</span>
              <span style={{ color: '#ffffff' }}>O</span>
              <span style={{ color: '#2A398D' }}>L</span>
              <span style={{ color: '#ffffff' }}>L</span>
              <span style={{ color: '#3CAC3B' }}>A</span>
            </Link>
            <span className="text-muted-foreground/40 text-xs hidden sm:inline">/</span>
            <Link href={base} className="text-sm font-semibold text-muted-foreground hover:text-foreground transition-colors hidden sm:inline truncate max-w-28">
              {pollaName}
            </Link>
            <span className="text-muted-foreground/40 text-xs hidden sm:inline">/</span>
            <span className="text-xs font-semibold text-primary hidden sm:inline">Admin</span>
          </div>

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
            <Link
              href={`${base}/predictions`}
              className="px-3 py-1.5 rounded-md text-xs font-medium transition-colors whitespace-nowrap text-muted-foreground hover:text-foreground hover:bg-accent"
            >
              🎯 Ver Polla
            </Link>
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
              <div className="pb-4 border-b border-border/60 pt-2">
                <div className="flex items-center gap-2 flex-wrap">
                  <Link href="/" className="text-base font-black tracking-tight leading-none" onClick={() => setOpen(false)}>
                    <span style={{ color: '#E61D25' }}>P</span>
                    <span style={{ color: '#ffffff' }}>O</span>
                    <span style={{ color: '#2A398D' }}>L</span>
                    <span style={{ color: '#ffffff' }}>L</span>
                    <span style={{ color: '#3CAC3B' }}>A</span>
                  </Link>
                  <span className="text-muted-foreground/40 text-xs">/</span>
                  <Link href={base} className="text-sm font-semibold text-muted-foreground truncate max-w-32" onClick={() => setOpen(false)}>
                    {pollaName}
                  </Link>
                  <span className="text-muted-foreground/40 text-xs">/</span>
                  <span className="text-xs font-semibold text-primary">Admin</span>
                </div>
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
                <SheetClose
                  render={
                    <Link
                      href={`${base}/predictions`}
                      className="px-3 py-2.5 rounded-md text-sm font-medium transition-colors text-muted-foreground hover:text-foreground hover:bg-accent"
                    />
                  }
                >
                  🎯 Ver Polla
                </SheetClose>
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
