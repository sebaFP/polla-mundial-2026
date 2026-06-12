'use client'

import { useState } from 'react'
import { Download } from 'lucide-react'
import type { LeaderboardEntry } from '@/app/api/pollas/[pollaId]/leaderboard/route'

// ── Design tokens (mirrors app globals.css) ─────────────────────────────────
const C = {
  navy:      '#0A0E1A',
  navyCard:  '#131929',
  navyRow:   '#0F1522',
  gold:      '#D4A843',
  goldLight: '#ECC261',
  white:     '#F2F2F2',
  gray:      '#7A8499',
  grayLight: '#9BA5BE',
  red:       '#E61D25',   // FIFA Canada red
  blue:      '#2A398D',   // FIFA USA blue
  green:     '#3CAC3B',   // FIFA Mexico green
  border:    '#1E2840',
}

function hex2rgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '')
  return [
    parseInt(h.slice(0, 2), 16),
    parseInt(h.slice(2, 4), 16),
    parseInt(h.slice(4, 6), 16),
  ]
}

function formatAmt(n: number, currency: string) {
  return `${currency} ${n.toLocaleString('es-CL')}`
}

function rankColor(rank: number) {
  if (rank === 1) return C.red
  if (rank === 2) return C.blue
  if (rank === 3) return C.green
  return C.gray
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
}

export default function ExportPDFButton({
  entries, pollaName,
  prizePoolEnabled, totalPool, currency,
  prize1Pct, prize2Pct, prize3Pct,
}: Props) {
  const [loading, setLoading] = useState(false)

  async function generate() {
    if (entries.length === 0) return
    setLoading(true)
    try {
      const { jsPDF } = await import('jspdf')
      const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
      const W = 210

      // ── helpers ──────────────────────────────────────────────────────────
      const fill = (hex: string) => { const [r,g,b] = hex2rgb(hex); doc.setFillColor(r,g,b) }
      const stroke = (hex: string) => { const [r,g,b] = hex2rgb(hex); doc.setDrawColor(r,g,b) }
      const textCol = (hex: string) => { const [r,g,b] = hex2rgb(hex); doc.setTextColor(r,g,b) }
      const bg = (x: number, y: number, w: number, h: number, hex: string, r = 0) => {
        fill(hex)
        if (r > 0) doc.roundedRect(x, y, w, h, r, r, 'F')
        else doc.rect(x, y, w, h, 'F')
      }

      function stripeHeader(y = 0) {
        bg(0, y, W / 3, 4, C.red)
        bg(W / 3, y, W / 3, 4, C.blue)
        bg(W * 2 / 3, y, W / 3 + 1, 4, C.green)
      }

      function pageFooter(pageNum: number, total: number) {
        const H = 297
        stripeFooter()
        textCol(C.gray)
        doc.setFontSize(7)
        doc.setFont('helvetica', 'normal')
        doc.text(`Página ${pageNum} de ${total}`, W / 2, H - 3, { align: 'center' })
      }

      function stripeFooter() {
        bg(0, 290, W / 3, 4, C.red)
        bg(W / 3, 290, W / 3, 4, C.blue)
        bg(W * 2 / 3, 290, W / 3 + 1, 4, C.green)
      }

      // ── PAGE 1: Executive Summary ─────────────────────────────────────────
      bg(0, 0, W, 297, C.navy)

      // Subtle geometric grid (FIFA 2026 motif - tiny dots)
      fill(C.border)
      for (let gx = 15; gx < W; gx += 18) {
        for (let gy = 15; gy < 297; gy += 18) {
          doc.circle(gx, gy, 0.4, 'F')
        }
      }

      stripeHeader(0)

      // Trophy + competition label
      textCol(C.gold)
      doc.setFontSize(9)
      doc.setFont('helvetica', 'bold')
      doc.text('FIFA WORLD CUP 2026', W / 2, 20, { align: 'center', charSpace: 2 })

      // Polla name
      textCol(C.white)
      doc.setFontSize(26)
      doc.setFont('helvetica', 'bold')
      const pollaLines = doc.splitTextToSize(pollaName.toUpperCase(), 180)
      doc.text(pollaLines, W / 2, 34, { align: 'center' })

      // Gold divider
      const divY = 34 + pollaLines.length * 11
      fill(C.gold)
      doc.rect(20, divY, W - 40, 0.6, 'F')

      // Subtitle row
      textCol(C.goldLight)
      doc.setFontSize(8)
      doc.setFont('helvetica', 'bold')
      doc.text('TABLA DE POSICIONES', W / 2, divY + 7, { align: 'center', charSpace: 1.5 })
      textCol(C.gray)
      doc.setFontSize(7)
      doc.setFont('helvetica', 'normal')
      const now = new Date()
      doc.text(
        `Generado el ${now.toLocaleDateString('es-CL', { day: '2-digit', month: 'long', year: 'numeric' })} a las ${now.toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' })}`,
        W / 2, divY + 13, { align: 'center' }
      )

      let cy = divY + 22

      // ── PODIUM BOX ────────────────────────────────────────────────────────
      const podiumH = 58
      bg(14, cy, W - 28, podiumH, C.navyCard, 4)
      stroke(C.border)
      doc.setLineWidth(0.3)
      doc.roundedRect(14, cy, W - 28, podiumH, 4, 4, 'S')

      // "PODIO" label inside card
      textCol(C.gold)
      doc.setFontSize(8)
      doc.setFont('helvetica', 'bold')
      doc.text('PODIO', W / 2, cy + 7, { align: 'center', charSpace: 2 })

      const top3 = entries.slice(0, 3)
      // Order: 2nd | 1st | 3rd
      const podiumOrder = top3.length >= 3 ? [top3[1], top3[0], top3[2]] : top3
      const podiumX = [W / 2 - 48, W / 2, W / 2 + 48]
      const podiumBarH = [18, 26, 14]  // heights matching rank visual
      const podiumBarY = [cy + podiumH - 20, cy + podiumH - 28, cy + podiumH - 16]

      podiumOrder.forEach((entry, i) => {
        const px = podiumX[i]
        const color = rankColor(entry.rank)
        const [r,g,b] = hex2rgb(color)

        // Avatar circle
        doc.setFillColor(r, g, b)
        doc.circle(px, cy + 20, 7, 'F')
        textCol(C.white)
        doc.setFontSize(7)
        doc.setFont('helvetica', 'bold')
        const initials = entry.name.slice(0, 2).toUpperCase()
        doc.text(initials, px, cy + 22.5, { align: 'center' })

        // Name
        textCol(C.white)
        doc.setFontSize(6.5)
        doc.setFont('helvetica', 'bold')
        const nameTrunc = entry.name.length > 12 ? entry.name.slice(0, 11) + '…' : entry.name
        doc.text(nameTrunc, px, cy + 31, { align: 'center' })

        // Points
        doc.setFillColor(r, g, b)
        doc.setFontSize(11)
        doc.setFont('helvetica', 'bold')
        textCol(color)
        const confirmed = entry.matchPoints + entry.pendingPoints + entry.groupPoints + entry.specialPoints + entry.questionPoints
        doc.text(`${confirmed}`, px, cy + 38, { align: 'center' })
        textCol(C.gray)
        doc.setFontSize(6)
        doc.text('pts', px, cy + 42, { align: 'center' })

        // Podium bar
        doc.setFillColor(r, g, b)
        const barW = 28
        doc.roundedRect(px - barW / 2, podiumBarY[i], barW, podiumBarH[i], 2, 2, 'F')
        textCol(C.white)
        doc.setFontSize(9)
        doc.setFont('helvetica', 'bold')
        doc.text(`${entry.rank}°`, px, podiumBarY[i] + podiumBarH[i] / 2 + 3, { align: 'center' })
      })

      cy += podiumH + 8

      // ── PRIZE POOL BOX ────────────────────────────────────────────────────
      if (prizePoolEnabled && totalPool > 0) {
        const prizeH = 26
        bg(14, cy, W - 28, prizeH, C.navyCard, 3)
        stroke(C.border)
        doc.setLineWidth(0.3)
        doc.roundedRect(14, cy, W - 28, prizeH, 3, 3, 'S')

        textCol(C.gray)
        doc.setFontSize(7)
        doc.setFont('helvetica', 'normal')
        doc.text('POZO TOTAL', W / 2, cy + 6, { align: 'center', charSpace: 1 })

        textCol(C.gold)
        doc.setFontSize(14)
        doc.setFont('helvetica', 'bold')
        doc.text(formatAmt(totalPool, currency), W / 2, cy + 14, { align: 'center' })

        // Prize tiers
        const p1 = Math.round(totalPool * prize1Pct / 100)
        const p2 = Math.round(totalPool * prize2Pct / 100)
        const p3 = Math.round(totalPool * prize3Pct / 100)
        const tierX = [W / 2 - 46, W / 2, W / 2 + 46]
        const tierColors = [C.red, C.blue, C.green]
        const tierLabels = ['1° lugar', '2° lugar', '3° lugar']
        const tierAmts = [p1, p2, p3]
        tierX.forEach((tx, i) => {
          textCol(tierColors[i])
          doc.setFontSize(7.5)
          doc.setFont('helvetica', 'bold')
          doc.text(formatAmt(tierAmts[i], currency), tx, cy + 21, { align: 'center' })
          textCol(C.gray)
          doc.setFontSize(6)
          doc.setFont('helvetica', 'normal')
          doc.text(tierLabels[i], tx, cy + 25, { align: 'center' })
        })

        cy += prizeH + 8
      }

      // ── TOP 10 LIST ───────────────────────────────────────────────────────
      textCol(C.goldLight)
      doc.setFontSize(8)
      doc.setFont('helvetica', 'bold')
      doc.text('CLASIFICACIÓN GENERAL', 20, cy + 1, { charSpace: 1.5 })
      fill(C.gold)
      doc.rect(20, cy + 3, W - 40, 0.4, 'F')
      cy += 7

      const top10 = entries.slice(0, Math.min(10, entries.length))
      top10.forEach((entry, i) => {
        const rowY = cy + i * 9
        if (i % 2 === 0) bg(14, rowY - 3.5, W - 28, 9, C.navyRow)

        const confirmed = entry.matchPoints + entry.pendingPoints + entry.groupPoints + entry.specialPoints + entry.questionPoints
        const color = rankColor(entry.rank)

        // Rank
        textCol(color)
        doc.setFontSize(8)
        doc.setFont('helvetica', 'bold')
        doc.text(`${entry.rank}°`, 22, rowY + 2.5, { align: 'left' })

        // Name
        textCol(C.white)
        doc.setFontSize(8)
        doc.setFont('helvetica', entry.rank <= 3 ? 'bold' : 'normal')
        const name = entry.name.length > 28 ? entry.name.slice(0, 27) + '…' : entry.name
        doc.text(name, 35, rowY + 2.5)

        // Dotted line
        textCol(C.border)
        doc.setFontSize(7)
        doc.setFont('helvetica', 'normal')
        const pts = `${confirmed} pts`
        const ptsW = doc.getTextWidth(pts)
        doc.text('· · · · · · · · · · · · · · · · · · · · · · · · · · · · · · · ·', 90, rowY + 2, {})

        // Points
        textCol(color)
        doc.setFontSize(8.5)
        doc.setFont('helvetica', 'bold')
        doc.text(pts, W - 22, rowY + 2.5, { align: 'right' })
      })

      cy += top10.length * 9 + 4

      // Participant count
      if (entries.length > 10) {
        textCol(C.gray)
        doc.setFontSize(7)
        doc.setFont('helvetica', 'italic')
        doc.text(`+ ${entries.length - 10} participantes más — ver página siguiente`, W / 2, cy + 2, { align: 'center' })
      }

      stripeFooter()
      textCol(C.gray)
      doc.setFontSize(7)
      doc.setFont('helvetica', 'normal')
      doc.text('Página 1', W / 2, 293, { align: 'center' })

      // ── PAGE 2+: Full Leaderboard Table ──────────────────────────────────
      const ROW_H = 8.5
      const TABLE_TOP = 38
      const PAGE_BOTTOM = 282
      const COLS = {
        rank:    { x: 14,  w: 10,  label: '#',       align: 'center' as const },
        name:    { x: 27,  w: 72,  label: 'Nombre',  align: 'left' as const },
        match:   { x: 102, w: 18,  label: '⚽ Part.', align: 'center' as const },
        group:   { x: 122, w: 18,  label: '🏅 Grup.', align: 'center' as const },
        special: { x: 142, w: 18,  label: '⭐ Esp.', align: 'center' as const },
        quest:   { x: 162, w: 16,  label: '❓ Preg.', align: 'center' as const },
        total:   { x: 181, w: 15,  label: 'TOTAL',   align: 'center' as const },
      }

      // Calculate total pages needed
      const rowsPerPage = Math.floor((PAGE_BOTTOM - TABLE_TOP) / ROW_H)
      const totalDetailPages = Math.ceil(entries.length / rowsPerPage)
      const totalPages = 1 + totalDetailPages

      function drawTablePage(startIdx: number, pageNum: number) {
        doc.addPage()
        bg(0, 0, W, 297, C.navy)

        // Subtle grid
        fill(C.border)
        for (let gx = 15; gx < W; gx += 18) {
          for (let gy = 15; gy < 297; gy += 18) {
            doc.circle(gx, gy, 0.4, 'F')
          }
        }

        stripeHeader(0)

        // Page header
        textCol(C.gold)
        doc.setFontSize(8)
        doc.setFont('helvetica', 'bold')
        doc.text('FIFA WORLD CUP 2026', W / 2, 12, { align: 'center', charSpace: 1.5 })
        textCol(C.white)
        doc.setFontSize(14)
        doc.setFont('helvetica', 'bold')
        doc.text(pollaName.toUpperCase(), W / 2, 22, { align: 'center' })
        textCol(C.goldLight)
        doc.setFontSize(8)
        doc.setFont('helvetica', 'bold')
        doc.text('CLASIFICACIÓN DETALLADA', W / 2, 30, { align: 'center', charSpace: 1 })

        fill(C.gold)
        doc.rect(14, 33, W - 28, 0.5, 'F')

        // Column headers
        bg(14, TABLE_TOP - ROW_H, W - 28, ROW_H, C.navyCard)
        stroke(C.border)
        doc.setLineWidth(0.3)
        doc.roundedRect(14, TABLE_TOP - ROW_H, W - 28, ROW_H, 1, 1, 'S')

        Object.values(COLS).forEach(col => {
          textCol(C.goldLight)
          doc.setFontSize(6.5)
          doc.setFont('helvetica', 'bold')
          const tx = col.align === 'center' ? col.x + col.w / 2 : col.x + 1
          doc.text(col.label, tx, TABLE_TOP - ROW_H + 5.5, { align: col.align })
        })

        // Rows
        const pageEntries = entries.slice(startIdx, startIdx + rowsPerPage)
        pageEntries.forEach((entry, i) => {
          const rowY = TABLE_TOP + i * ROW_H
          const odd = i % 2 === 0
          bg(14, rowY - 0.5, W - 28, ROW_H, odd ? C.navyRow : C.navy)

          // Left accent bar for top 3
          if (entry.rank <= 3) {
            const [r,g,b] = hex2rgb(rankColor(entry.rank))
            doc.setFillColor(r, g, b)
            doc.rect(14, rowY - 0.5, 1.5, ROW_H, 'F')
          }

          const midY = rowY + ROW_H / 2 + 1.5
          const confirmed = entry.matchPoints + entry.pendingPoints + entry.groupPoints + entry.specialPoints + entry.questionPoints

          // Rank
          textCol(rankColor(entry.rank))
          doc.setFontSize(entry.rank <= 3 ? 9 : 8)
          doc.setFont('helvetica', 'bold')
          doc.text(`${entry.rank}°`, COLS.rank.x + COLS.rank.w / 2, midY, { align: 'center' })

          // Name
          textCol(C.white)
          doc.setFontSize(8)
          doc.setFont('helvetica', entry.rank <= 3 ? 'bold' : 'normal')
          const nameStr = entry.name.length > 22 ? entry.name.slice(0, 21) + '…' : entry.name
          doc.text(nameStr, COLS.name.x + 1, midY)

          // Match pts
          textCol(C.grayLight)
          doc.setFontSize(7.5)
          doc.setFont('helvetica', 'normal')
          doc.text(`${entry.matchPoints + entry.pendingPoints}`, COLS.match.x + COLS.match.w / 2, midY, { align: 'center' })

          // Group pts
          doc.text(`${entry.groupPoints}`, COLS.group.x + COLS.group.w / 2, midY, { align: 'center' })

          // Special pts
          doc.text(`${entry.specialPoints}`, COLS.special.x + COLS.special.w / 2, midY, { align: 'center' })

          // Question pts
          doc.text(`${entry.questionPoints}`, COLS.quest.x + COLS.quest.w / 2, midY, { align: 'center' })

          // Total (highlighted)
          const [r,g,b] = hex2rgb(entry.rank <= 3 ? rankColor(entry.rank) : C.gold)
          doc.setFillColor(r, g, b)
          textCol(entry.rank <= 3 ? rankColor(entry.rank) : C.gold)
          doc.setFontSize(8.5)
          doc.setFont('helvetica', 'bold')
          doc.text(`${confirmed}`, COLS.total.x + COLS.total.w / 2, midY, { align: 'center' })

          // Row separator
          stroke(C.border)
          doc.setLineWidth(0.2)
          doc.line(14, rowY + ROW_H - 0.5, W - 14, rowY + ROW_H - 0.5)
        })

        pageFooter(pageNum, totalPages)
      }

      for (let p = 0; p < totalDetailPages; p++) {
        drawTablePage(p * rowsPerPage, p + 2)
      }

      // Fix page 1 footer total
      // (already drawn above correctly)

      const dateStr = now.toLocaleDateString('es-CL', { year: 'numeric', month: '2-digit', day: '2-digit' }).replace(/\//g, '-')
      const safeName = pollaName.replace(/[^a-zA-Z0-9\s]/g, '').replace(/\s+/g, '_').slice(0, 30)
      doc.save(`Polla_${safeName}_${dateStr}.pdf`)
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
