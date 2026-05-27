'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Sheet, SheetContent, SheetTrigger, SheetClose } from '@/components/ui/sheet'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'
import {
  Menu, Link2, LayoutDashboard, Users, ClipboardList,
  Settings, ShieldCheck, Eye, Target, LayoutGrid, Star, Trophy,
} from 'lucide-react'

function Wordmark({ onClick }: { onClick?: () => void }) {
  return (
    <span className="text-base font-black tracking-tight leading-none" onClick={onClick}>
      <span style={{ color: '#E61D25' }}>P</span>
      <span style={{ color: '#ffffff' }}>O</span>
      <span style={{ color: '#2A398D' }}>L</span>
      <span style={{ color: '#ffffff' }}>L</span>
      <span style={{ color: '#3CAC3B' }}>A</span>
      <span className="ml-1.5 text-muted-foreground font-bold">26</span>
    </span>
  )
}

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
  const adminBase = `${base}/admin`
  const [open, setOpen] = useState(false)
  const isOnAdmin = pathname.startsWith(adminBase)

  const mainLinks = [
    { href: `${base}/predictions`, label: 'Pronósticos', icon: Target },
    { href: `${base}/groups`, label: 'Grupos', icon: LayoutGrid },
    { href: `${base}/specials`, label: 'Especiales', icon: Star },
    { href: `${base}/leaderboard`, label: 'Tabla', icon: Trophy },
  ]

  const adminLinks = [
    { href: adminBase, label: 'Dashboard', icon: LayoutDashboard, exact: true },
    { href: `${adminBase}/participants`, label: 'Participantes', icon: Users },
    { href: `${adminBase}/results`, label: 'Resultados', icon: ClipboardList },
    { href: `${adminBase}/config`, label: 'Config', icon: Settings },
    { href: `${adminBase}/admins`, label: 'Admins', icon: ShieldCheck },
  ]

  function copyJoinLink() {
    const url = `${window.location.origin}/join/polla/${pollaSlug}`
    navigator.clipboard.writeText(url).then(() => {
      toast.success('¡Enlace de invitación copiado!')
    }).catch(() => {
      toast.error('No se pudo copiar el enlace')
    })
  }

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

            {/* Logo + breadcrumb */}
            <div className="flex items-center gap-2 shrink-0 min-w-0">
              <Link href={base}>
                <Wordmark />
              </Link>
              <span className="text-muted-foreground/40 text-xs hidden sm:inline">/</span>
              <Link href={base} className="text-sm font-semibold text-muted-foreground hover:text-foreground transition-colors hidden sm:inline truncate max-w-32">
                {pollaName}
              </Link>
              {isOnAdmin && (
                <>
                  <span className="text-muted-foreground/40 text-xs hidden sm:inline">/</span>
                  <span className="text-xs font-semibold text-primary hidden sm:inline">Admin</span>
                </>
              )}
            </div>

            {/* Desktop nav */}
            <div className="hidden sm:flex items-center gap-0.5">
              {!isOnAdmin && mainLinks.map(l => (
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
              {isOnAdmin && adminLinks.map(l => {
                const active = l.exact ? pathname === l.href : pathname.startsWith(l.href)
                return (
                  <Link
                    key={l.href}
                    href={l.href}
                    className={cn(
                      'px-3 py-1.5 rounded-lg text-sm font-semibold transition-colors',
                      active
                        ? 'bg-primary/15 text-primary border border-primary/30'
                        : 'text-muted-foreground hover:text-foreground hover:bg-accent'
                    )}
                  >
                    {l.label}
                  </Link>
                )
              })}
              {myRole === 'admin' && !isOnAdmin && (
                <Link
                  href={adminBase}
                  className="px-3 py-1.5 rounded-lg text-sm font-semibold text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
                >
                  Admin
                </Link>
              )}
              {isOnAdmin && (
                <Link
                  href={`${base}/predictions`}
                  className="ml-1 px-3 py-1.5 rounded-lg text-sm font-semibold text-muted-foreground hover:text-foreground hover:bg-accent transition-colors flex items-center gap-1.5"
                >
                  <Eye className="h-3.5 w-3.5" />
                  Ver Polla
                </Link>
              )}
            </div>

            {/* Desktop user */}
            <div className="hidden sm:flex items-center gap-2 shrink-0">
              <span className="text-xs text-muted-foreground truncate max-w-24">{userName}</span>
              {!isOnAdmin && (
                <Button variant="ghost" size="sm" onClick={copyJoinLink} className="text-xs text-muted-foreground hover:text-foreground gap-1.5">
                  <Link2 className="h-3.5 w-3.5" />
                  Invitar
                </Button>
              )}
              <Button variant="ghost" size="sm" onClick={logout} className="text-xs font-semibold">
                Salir
              </Button>
            </div>

            {/* Mobile hamburger */}
            <Sheet open={open} onOpenChange={setOpen}>
              <SheetTrigger render={<Button variant="ghost" size="icon" className="sm:hidden shrink-0" />}>
                <Menu className="h-5 w-5" />
              </SheetTrigger>
              <SheetContent side="right" className="w-80 flex flex-col p-0 gap-0">

                {/* Sheet header */}
                <div className="px-5 py-4 border-b border-border/60 flex items-center gap-2 shrink-0">
                  <Link href={base} onClick={() => setOpen(false)}>
                    <Wordmark />
                  </Link>
                  <span className="text-muted-foreground/40 text-xs">/</span>
                  <span className="text-sm font-semibold text-muted-foreground truncate">{pollaName}</span>
                </div>

                {/* Nav links */}
                <div className="flex-1 overflow-y-auto px-3 py-4 space-y-0.5">

                  <p className="px-3 pb-1.5 text-[10px] font-bold uppercase tracking-widest text-muted-foreground/40">Polla</p>
                  {mainLinks.map(l => {
                    const Icon = l.icon
                    const active = pathname.startsWith(l.href)
                    return (
                      <SheetClose
                        key={l.href}
                        render={
                          <Link
                            href={l.href}
                            className={cn(
                              'flex items-center gap-3 px-3 py-3 rounded-xl text-sm font-semibold transition-colors',
                              active
                                ? 'bg-primary/15 text-primary border border-primary/20'
                                : 'text-muted-foreground hover:text-foreground hover:bg-accent/60'
                            )}
                          />
                        }
                      >
                        <Icon className="h-4 w-4 shrink-0" />
                        {l.label}
                      </SheetClose>
                    )
                  })}

                  {myRole === 'admin' && (
                    <div className="pt-4">
                      <p className="px-3 pb-1.5 text-[10px] font-bold uppercase tracking-widest text-muted-foreground/40">Administración</p>
                      {adminLinks.map(l => {
                        const Icon = l.icon
                        const active = l.exact ? pathname === l.href : pathname.startsWith(l.href)
                        return (
                          <SheetClose
                            key={l.href}
                            render={
                              <Link
                                href={l.href}
                                className={cn(
                                  'flex items-center gap-3 px-3 py-3 rounded-xl text-sm font-semibold transition-colors',
                                  active
                                    ? 'bg-primary/15 text-primary border border-primary/20'
                                    : 'text-muted-foreground hover:text-foreground hover:bg-accent/60'
                                )}
                              />
                            }
                          >
                            <Icon className="h-4 w-4 shrink-0" />
                            {l.label}
                          </SheetClose>
                        )
                      })}
                    </div>
                  )}
                </div>

                {/* Sheet footer */}
                <div className="px-4 py-4 border-t border-border/60 space-y-2 shrink-0">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground font-medium truncate max-w-40">{userName}</span>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => { setOpen(false); logout() }}
                      className="text-xs font-semibold h-7 text-destructive/80 hover:text-destructive"
                    >
                      Salir
                    </Button>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => { setOpen(false); copyJoinLink() }}
                      className="flex-1 flex items-center gap-2 px-3 py-2 rounded-lg text-xs text-muted-foreground hover:text-foreground hover:bg-accent/60 transition-colors"
                    >
                      <Link2 className="h-3.5 w-3.5 shrink-0" />
                      Copiar enlace
                    </button>
                    <SheetClose
                      render={
                        <Link
                          href="/change-password"
                          className="flex-1 flex items-center gap-2 px-3 py-2 rounded-lg text-xs text-muted-foreground hover:text-foreground hover:bg-accent/60 transition-colors"
                        />
                      }
                    >
                      <span>🔒</span>
                      Contraseña
                    </SheetClose>
                  </div>
                </div>

              </SheetContent>
            </Sheet>

          </div>
        </div>
      </div>
    </nav>
  )
}
