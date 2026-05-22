import Link from 'next/link'
import { cn } from '@/lib/utils'

const tabs = [
  { href: '/predictions', label: '⚽ Partidos', id: 'matches' },
  { href: '/predictions/groups', label: '🏅 Clasificados', id: 'groups' },
  { href: '/predictions/specials', label: '⭐ Especiales', id: 'specials' },
]

export default function PredictionTabs({ active }: { active: string }) {
  return (
    <div className="flex gap-1 bg-card border border-border rounded-lg p-1">
      {tabs.map(tab => (
        <Link
          key={tab.id}
          href={tab.href}
          className={cn(
            'flex-1 text-center py-1.5 px-3 rounded-md text-sm font-medium transition-colors',
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
