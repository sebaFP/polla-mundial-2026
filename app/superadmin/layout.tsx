import { getSession } from '@/lib/auth/session'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { db } from '@/lib/db'
import { passwordResetRequests } from '@/lib/db/schema'
import { eq, count } from 'drizzle-orm'

export default async function SuperAdminLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession()
  if (!session) redirect('/login')
  if (!session.isSuperAdmin) redirect('/')

  const [{ value: pendingCount }] = await db
    .select({ value: count() })
    .from(passwordResetRequests)
    .where(eq(passwordResetRequests.status, 'pending'))

  return (
    <div>
      <nav className="border-b border-white/10 bg-background/50 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-3xl mx-auto px-4 h-12 flex items-center gap-6">
          <span className="text-xs font-black tracking-[0.2em] uppercase text-primary">Super Admin</span>
          <Link href="/superadmin/users" className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">
            Usuarios
          </Link>
          <Link href="/superadmin/reset-requests" className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1.5">
            Recuperar contraseñas
            {pendingCount > 0 && (
              <span className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-destructive text-[10px] font-bold text-white">
                {pendingCount}
              </span>
            )}
          </Link>
          <Link href="/" className="ml-auto text-xs text-muted-foreground hover:text-foreground transition-colors">
            Salir
          </Link>
        </div>
      </nav>
      {children}
    </div>
  )
}
