import Link from 'next/link'
import { cn } from '@/lib/utils'

function getTabs(pollaSlug?: string, showQuestions?: boolean) {
  const base = pollaSlug ? `/polla/${pollaSlug}` : ''
  const tabs = [
    { href: `${base}/predictions`, label: '⚽ Partidos', id: 'matches' },
    { href: `${base}/groups`, label: '🏅 Clasificados', id: 'groups' },
    { href: `${base}/specials`, label: '⭐ Especiales', id: 'specials' },
  ]
  if (showQuestions) tabs.push({ href: `${base}/questions`, label: '❓ Preguntas', id: 'questions' })
  return tabs
}

export default function PredictionTabs({ active, pollaSlug, showQuestions }: { active: string; pollaSlug?: string; showQuestions?: boolean }) {
  const tabs = getTabs(pollaSlug, showQuestions)
  return (
    <div className="flex gap-1 bg-card border border-border rounded-lg p-1">
      {tabs.map(tab => (
        <Link
          key={tab.id}
          href={tab.href}
          className={cn(
            'flex-1 text-center py-1.5 px-2 sm:px-3 rounded-md text-xs sm:text-sm font-medium transition-colors',
            active === tab.id
              ? 'bg-primary text-primary-foreground'
              : 'text-muted-foreground hover:text-foreground hover:bg-accent'
          )}
        >
          {tab.label}
        </Link>
      ))}
    </div>
  )
}
