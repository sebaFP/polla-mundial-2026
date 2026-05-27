import { ImageResponse } from 'next/og'
import { getPollaBySlug } from '@/lib/polla'

export const runtime = 'nodejs'
export const alt = 'Únete a la polla del Mundial 2026'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

export default async function Image({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const polla = await getPollaBySlug(slug)
  const name = polla?.name ?? 'Polla de pronósticos'
  const competition = polla?.competitionName ?? ''

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'linear-gradient(135deg, #0a0f1e 0%, #0d1b3e 50%, #0a1628 100%)',
          fontFamily: 'system-ui, sans-serif',
          gap: 24,
        }}
      >
        {/* Wordmark */}
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 0, fontSize: 72, fontWeight: 900, letterSpacing: '-2px', lineHeight: 1 }}>
          <span style={{ color: '#E61D25' }}>P</span>
          <span style={{ color: '#ffffff' }}>O</span>
          <span style={{ color: '#2A398D' }}>L</span>
          <span style={{ color: '#ffffff' }}>L</span>
          <span style={{ color: '#3CAC3B' }}>A</span>
        </div>

        {/* Invite text */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
          <span style={{ color: '#9ca3af', fontSize: 22, fontWeight: 600, letterSpacing: '0.2em', textTransform: 'uppercase' }}>
            Te invitan a
          </span>
          <span style={{
            color: '#c8a84b',
            fontSize: 48,
            fontWeight: 900,
            textAlign: 'center',
            maxWidth: 900,
            lineHeight: 1.2,
          }}>
            {name}
          </span>
          {competition ? (
            <span style={{ color: '#6b7280', fontSize: 20, fontWeight: 600, marginTop: 4 }}>
              {competition}
            </span>
          ) : null}
        </div>

        {/* CTA */}
        <div style={{
          marginTop: 8,
          padding: '14px 40px',
          background: 'rgba(200, 168, 75, 0.15)',
          border: '2px solid rgba(200, 168, 75, 0.4)',
          borderRadius: 12,
          color: '#c8a84b',
          fontSize: 20,
          fontWeight: 700,
          letterSpacing: '0.1em',
        }}>
          Solicitar unirse →
        </div>
      </div>
    ),
    { ...size }
  )
}
