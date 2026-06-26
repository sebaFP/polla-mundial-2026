'use client'

import { useState } from 'react'
import { Download } from 'lucide-react'
import type { LeaderboardEntry } from '@/app/api/pollas/[pollaId]/leaderboard/route'

const C = {
  navy:     '#0A0E1A',
  card:     '#131929',
  row:      '#0F1522',
  gold:     '#D4A843',
  goldLt:   '#ECC261',
  white:    '#F2F2F2',
  gray:     '#7A8499',
  grayLt:   '#9BA5BE',
  red:      '#E61D25',
  blue:     '#2A398D',
  green:    '#3CAC3B',
  border:   '#1E2840',
}

function rgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '')
  return [parseInt(h.slice(0,2),16), parseInt(h.slice(2,4),16), parseInt(h.slice(4,6),16)]
}

function rankColor(rank: number) {
  if (rank === 1) return C.red
  if (rank === 2) return C.blue
  if (rank === 3) return C.green
  return C.gray
}

function pdfSafe(str: string): string {
  return str.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^\x00-\xFF]/g, '')
}

function fmtAmt(n: number, currency: string) {
  return `${currency} ${n.toLocaleString('es-CL')}`
}

function totalPts(
  e: LeaderboardEntry,
  includeMatches: boolean,
  includeGroups: boolean,
  includeSpecials: boolean,
  includeQuestions: boolean
) {
  return (
    (includeMatches ? e.matchPoints + e.pendingPoints : 0) +
    (includeGroups ? e.groupPoints : 0) +
    (includeSpecials ? e.specialPoints : 0) +
    (includeQuestions ? e.questionPoints : 0)
  )
}

type Props = {
  entries: LeaderboardEntry[]
  pollaName: string
  prizePoolEnabled: boolean
  totalPool: number
  currency: string
  prize1Pct: number
  prize2Pct: number
  prize3Pct: number
  includeMatches?: boolean
  includeGroups?: boolean
  includeSpecials?: boolean
  includeQuestions?: boolean
}

export default function ExportPDFButton({
  entries, pollaName,
  prizePoolEnabled, totalPool, currency,
  prize1Pct, prize2Pct, prize3Pct,
  includeMatches = true,
  includeGroups = true,
  includeSpecials = true,
  includeQuestions = true,
}: Props) {
  const [loading, setLoading] = useState(false)

  async function generate() {
    if (entries.length === 0) return
    setLoading(true)
    try {
      const { jsPDF } = await import('jspdf')
      const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
      const W = 210, H = 297, CX = W / 2  // center x = 105

      // ── primitives ────────────────────────────────────────────────────────
      const setFill  = (hex: string) => { const [r,g,b] = rgb(hex); doc.setFillColor(r,g,b) }
      const setStroke= (hex: string) => { const [r,g,b] = rgb(hex); doc.setDrawColor(r,g,b) }
      const setTxt   = (hex: string) => { const [r,g,b] = rgb(hex); doc.setTextColor(r,g,b) }

      const rect = (x: number, y: number, w: number, h: number, hex: string, rr = 0) => {
        setFill(hex)
        rr > 0 ? doc.roundedRect(x, y, w, h, rr, rr, 'F') : doc.rect(x, y, w, h, 'F')
      }
      const border = (x: number, y: number, w: number, h: number, hex: string, rr = 0) => {
        setStroke(hex)
        doc.setLineWidth(0.3)
        rr > 0 ? doc.roundedRect(x, y, w, h, rr, rr, 'S') : doc.rect(x, y, w, h, 'S')
      }

      const txt = (text: string, x: number, y: number, opts: {
        align?: 'left'|'center'|'right'
        size?: number
        bold?: boolean
        italic?: boolean
        color?: string
        maxWidth?: number
      } = {}) => {
        if (opts.color)     setTxt(opts.color)
        if (opts.size)      doc.setFontSize(opts.size)
        if (opts.bold)      doc.setFont('helvetica', 'bold')
        else if (opts.italic) doc.setFont('helvetica', 'italic')
        else                doc.setFont('helvetica', 'normal')
        const textOpts: { align?: 'left'|'center'|'right'; maxWidth?: number } = {}
        if (opts.align)    textOpts.align = opts.align
        if (opts.maxWidth) textOpts.maxWidth = opts.maxWidth
        doc.text(text, x, y, textOpts)
      }

      function stripe(y: number) {
        rect(0,     y, W/3,     5, C.red)
        rect(W/3,   y, W/3,     5, C.blue)
        rect(W*2/3, y, W/3 + 1, 5, C.green)
      }

      function dotGrid() {
        setFill(C.border)
        for (let x = 15; x < W; x += 18)
          for (let y = 15; y < H; y += 18)
            doc.circle(x, y, 0.4, 'F')
      }

      function pageBackground() {
        rect(0, 0, W, H, C.navy)
        dotGrid()
      }

      // ── pre-calculate pagination ──────────────────────────────────────────
      const ROW_H       = 8.5
      const TABLE_TOP   = 44   // first data row y
      const PAGE_BOTTOM = 282
      const rowsPerPage = Math.floor((PAGE_BOTTOM - TABLE_TOP) / ROW_H)
      const detailPages = Math.ceil(entries.length / rowsPerPage)
      const totalPages  = 1 + detailPages

      function footer(pageNum: number) {
        stripe(H - 7)
        txt(`Página ${pageNum} de ${totalPages}`, CX, H - 1.5, {
          align: 'center', size: 7, color: C.gray,
        })
      }

      // ══════════════════════════════════════════════════════════════════════
      // PAGE 1 — Executive summary
      // ══════════════════════════════════════════════════════════════════════
      pageBackground()
      stripe(0)

      txt('FIFA  WORLD  CUP  2026', CX, 19, {
        align: 'center', size: 9, bold: true, color: C.gold,
      })

      const pollaLabel = pdfSafe(pollaName).toUpperCase()
      const pollaLines = doc.splitTextToSize(pollaLabel, 180) as string[]
      txt(pollaLabel, CX, 32, {
        align: 'center', size: 26, bold: true, color: C.white, maxWidth: 180,
      })

      const divY = 32 + (pollaLines.length - 1) * 10 + 8
      rect(20, divY, W - 40, 0.6, C.gold)

      txt('TABLA  DE  POSICIONES', CX, divY + 8, {
        align: 'center', size: 8, bold: true, color: C.goldLt,
      })

      const now = new Date()
      const dateStr = now.toLocaleDateString('es-CL', { day: '2-digit', month: 'long', year: 'numeric' })
      const timeStr = now.toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' })
      txt(`Generado el ${dateStr} a las ${timeStr}`, CX, divY + 15, {
        align: 'center', size: 7, color: C.gray,
      })

      let cy = divY + 24

      // ── PODIUM ────────────────────────────────────────────────────────────
      const podH    = 68
      const podL    = 14, podW = W - 28
      rect(podL, cy, podW, podH, C.card, 4)
      border(podL, cy, podW, podH, C.border, 4)

      txt('P  O  D  I  O', CX, cy + 8, {
        align: 'center', size: 8, bold: true, color: C.gold,
      })

      const top3 = entries.slice(0, 3)
      if (top3.length > 0) {
        // order: [2nd, 1st, 3rd] — visual podium layout
        const order = top3.length >= 3 ? [top3[1], top3[0], top3[2]] : top3
        // space evenly within card content area (podL+4 … podL+podW-4)
        const contentW = podW - 8
        const step     = contentW / (order.length + 1)
        const podXs    = order.map((_, i) => podL + 4 + step * (i + 1))

        const barBottom = cy + podH - 5
        const barHs     = order.length >= 3 ? [14, 20, 10] : [20]  // [2nd, 1st, 3rd]
        const barW      = 26

        order.forEach((entry, i) => {
          const px    = podXs[i]
          const color = rankColor(entry.rank)
          const [r,g,b] = rgb(color)

          // Avatar
          doc.setFillColor(r, g, b)
          doc.circle(px, cy + 21, 7, 'F')
          txt(pdfSafe(entry.name).slice(0, 2).toUpperCase(), px, cy + 23.5, {
            align: 'center', size: 7, bold: true, color: C.white,
          })

          // Name
          const nameRaw = pdfSafe(entry.name)
          const nameStr = nameRaw.length > 13 ? nameRaw.slice(0, 12) + '...' : nameRaw
          txt(nameStr, px, cy + 32, {
            align: 'center', size: 6.5, bold: true, color: C.white,
          })

          // Points
          txt(`${totalPts(entry, includeMatches, includeGroups, includeSpecials, includeQuestions)}`, px, cy + 40, {
            align: 'center', size: 12, bold: true, color,
          })
          txt('pts', px, cy + 44.5, {
            align: 'center', size: 6, color: C.gray,
          })

          // Bar
          const bh = barHs[i] ?? 14
          const by = barBottom - bh
          doc.setFillColor(r, g, b)
          doc.roundedRect(px - barW/2, by, barW, bh, 2, 2, 'F')
          txt(`${entry.rank}°`, px, by + bh/2 + 3, {
            align: 'center', size: 9, bold: true, color: C.white,
          })
        })

        // Gold floor bar spanning all columns
        const floorX = podXs[0] - barW/2 - 2
        const floorW = podXs[order.length - 1] - podXs[0] + barW + 4
        rect(floorX, barBottom, floorW, 1.5, C.gold)
      }

      cy += podH + 8

      // ── PRIZE POOL ────────────────────────────────────────────────────────
      if (prizePoolEnabled && totalPool > 0) {
        const ph = 28
        rect(podL, cy, podW, ph, C.card, 3)
        border(podL, cy, podW, ph, C.border, 3)

        txt('POZO  TOTAL', CX, cy + 7, {
          align: 'center', size: 7, color: C.gray,
        })
        txt(fmtAmt(totalPool, currency), CX, cy + 15, {
          align: 'center', size: 14, bold: true, color: C.gold,
        })

        const p1 = Math.round(totalPool * prize1Pct / 100)
        const p2 = Math.round(totalPool * prize2Pct / 100)
        const p3 = Math.round(totalPool * prize3Pct / 100)
        const tierXs = [CX - 48, CX, CX + 48]
        ;[p1, p2, p3].forEach((amt, i) => {
          const colors = [C.red, C.blue, C.green]
          const labels = ['1° lugar', '2° lugar', '3° lugar']
          txt(fmtAmt(amt, currency), tierXs[i], cy + 22, {
            align: 'center', size: 7, bold: true, color: colors[i],
          })
          txt(labels[i], tierXs[i], cy + 26, {
            align: 'center', size: 6, color: C.gray,
          })
        })

        cy += ph + 8
      }

      // ── TOP 10 LIST ───────────────────────────────────────────────────────
      txt('CLASIFICACION  GENERAL', podL + 2, cy + 1, {
        size: 8, bold: true, color: C.goldLt,
      })
      rect(podL, cy + 3, podW, 0.4, C.gold)
      cy += 8

      const top10 = entries.slice(0, Math.min(10, entries.length))
      top10.forEach((entry, i) => {
        const ry = cy + i * 9
        if (i % 2 === 0) rect(podL, ry - 3.5, podW, 9, C.row)

        const color = rankColor(entry.rank)
        const pts   = `${totalPts(entry, includeMatches, includeGroups, includeSpecials, includeQuestions)} pts`

        txt(`${entry.rank}°`, podL + 2, ry + 2.5, {
          size: 8, bold: true, color,
        })

        txt(pdfSafe(entry.name), podL + 14, ry + 2.5, {
          size: 8, bold: entry.rank <= 3, color: C.white,
          maxWidth: 100,
        })

        // Right-align score
        txt(pts, W - podL - 2, ry + 2.5, {
          align: 'right', size: 8, bold: entry.rank <= 3, color,
        })
      })

      cy += top10.length * 9 + 5

      if (entries.length > 10) {
        txt(`+ ${entries.length - 10} participantes más — ver página siguiente`, CX, cy + 2, {
          align: 'center', size: 7, italic: true, color: C.gray,
        })
      }

      footer(1)

      // ══════════════════════════════════════════════════════════════════════
      // PAGES 2+: Detailed table
      // ══════════════════════════════════════════════════════════════════════
      const COLS = [
        { x: 14,  w: 12,  label: '#',      align: 'center' as const },
        { x: 28,  w: 72,  label: 'Nombre', align: 'left'   as const },
        { x: 103, w: 22,  label: 'Part.',  align: 'center' as const },
        { x: 127, w: 22,  label: 'Grup.',  align: 'center' as const },
        { x: 151, w: 18,  label: 'Esp.',   align: 'center' as const },
        { x: 171, w: 14,  label: 'Preg.',  align: 'center' as const },
        { x: 186, w: 10,  label: 'TOTAL',  align: 'center' as const },
      ]

      for (let p = 0; p < detailPages; p++) {
        doc.addPage()
        pageBackground()
        stripe(0)

        txt('FIFA  WORLD  CUP  2026', CX, 14, {
          align: 'center', size: 8, bold: true, color: C.gold,
        })
        txt(pdfSafe(pollaName).toUpperCase(), CX, 24, {
          align: 'center', size: 14, bold: true, color: C.white,
        })
        txt('CLASIFICACION  DETALLADA', CX, 32, {
          align: 'center', size: 8, bold: true, color: C.goldLt,
        })

        rect(14, 35, W - 28, 0.5, C.gold)

        // Column header row
        const hY = TABLE_TOP - ROW_H
        rect(14, hY, W - 28, ROW_H, C.card)
        border(14, hY, W - 28, ROW_H, C.border)

        COLS.forEach(col => {
          const tx = col.align === 'center' ? col.x + col.w / 2 : col.x + 1
          txt(col.label, tx, hY + 5.5, {
            align: col.align, size: 6.5, bold: true, color: C.goldLt,
          })
        })

        // Data rows
        const pageSlice = entries.slice(p * rowsPerPage, (p + 1) * rowsPerPage)
        pageSlice.forEach((entry, i) => {
          const ry   = TABLE_TOP + i * ROW_H
          const midY = ry + ROW_H / 2 + 1.5
          const color = rankColor(entry.rank)
          const pts   = totalPts(entry, includeMatches, includeGroups, includeSpecials, includeQuestions)

          rect(14, ry - 0.5, W - 28, ROW_H, i % 2 === 0 ? C.row : C.navy)

          // Color accent bar for top 3
          if (entry.rank <= 3) {
            const [r,g,b] = rgb(color)
            doc.setFillColor(r, g, b)
            doc.rect(14, ry - 0.5, 1.5, ROW_H, 'F')
          }

          // Rank
          txt(`${entry.rank}°`, COLS[0].x + COLS[0].w / 2, midY, {
            align: 'center', size: entry.rank <= 3 ? 9 : 8, bold: true, color,
          })

          // Name
          const nameRaw = pdfSafe(entry.name)
          const nameStr = nameRaw.length > 24 ? nameRaw.slice(0, 23) + '...' : nameRaw
          txt(nameStr, COLS[1].x + 1, midY, {
            size: 8, bold: entry.rank <= 3, color: C.white,
          })

          // Stat columns
          const stats = [
            includeMatches ? entry.matchPoints + entry.pendingPoints : 0,
            includeGroups ? entry.groupPoints : 0,
            includeSpecials ? entry.specialPoints : 0,
            includeQuestions ? entry.questionPoints : 0,
          ]
          stats.forEach((val, si) => {
            const col = COLS[2 + si]
            txt(`${val}`, col.x + col.w / 2, midY, {
              align: 'center', size: 7.5, color: C.grayLt,
            })
          })

          // Total — colored only for top 3, white otherwise
          const totalCol = COLS[6]
          txt(`${pts}`, totalCol.x + totalCol.w / 2, midY, {
            align: 'center', size: 8.5, bold: true,
            color: entry.rank <= 3 ? color : C.white,
          })

          // Row separator
          setStroke(C.border)
          doc.setLineWidth(0.2)
          doc.line(14, ry + ROW_H - 0.5, W - 14, ry + ROW_H - 0.5)
        })

        footer(p + 2)
      }

      // Save
      const fileDateStr = now.toLocaleDateString('es-CL', {
        year: 'numeric', month: '2-digit', day: '2-digit',
      }).replace(/\//g, '-')
      const safeName = pdfSafe(pollaName).replace(/[^a-zA-Z0-9\s]/g, '').replace(/\s+/g, '_').slice(0, 30)
      doc.save(`Polla_${safeName}_${fileDateStr}.pdf`)
    } finally {
      setLoading(false)
    }
  }

  return (
    <button
      onClick={generate}
      disabled={loading || entries.length === 0}
      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all bg-card/50 border-border/40 text-muted-foreground hover:text-foreground hover:border-primary/40 hover:bg-primary/10 disabled:opacity-40 disabled:cursor-not-allowed"
    >
      {loading ? (
        <>
          <span className="inline-block w-3 h-3 border-2 border-current border-t-transparent rounded-full animate-spin" />
          Generando…
        </>
      ) : (
        <>
          <Download className="w-3.5 h-3.5" />
          Exportar PDF
        </>
      )}
    </button>
  )
}
