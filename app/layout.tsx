import type { Metadata } from 'next'
import { Geist, Geist_Mono, Manrope } from 'next/font/google'
import { Toaster } from '@/components/ui/sonner'
import { cn } from '@/lib/utils'
import './globals.css'

const manrope = Manrope({ subsets: ['latin'], variable: '--font-sans' })

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
})

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
})

export const metadata: Metadata = {
  title: 'Polla Mundial 2026',
  description: 'Sistema de pronósticos para el Mundial FIFA 2026',
  icons: { icon: '/favicon.ico' },
}

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="es"
      className={cn('dark h-full antialiased', geistSans.variable, geistMono.variable, manrope.variable, 'font-sans')}
      suppressHydrationWarning
    >
      <body className="min-h-full flex flex-col bg-background text-foreground">
        {children}
        <Toaster richColors position="top-center" />
      </body>
    </html>
  )
}
