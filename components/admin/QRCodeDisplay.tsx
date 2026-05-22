'use client'

import { useEffect, useRef, useState } from 'react'
import QRCode from 'qrcode'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'

type Props = {
  token: string
  name: string
  appUrl: string
}

export default function QRCodeDisplay({ token, name, appUrl }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [url] = useState(() => `${appUrl}/join/${token}`)

  useEffect(() => {
    if (!canvasRef.current) return
    QRCode.toCanvas(canvasRef.current, url, {
      width: 256,
      margin: 2,
      color: {
        dark: '#000000',
        light: '#ffffff',
      },
    })
  }, [url])

  function copyLink() {
    navigator.clipboard.writeText(url)
    toast.success('Link copiado')
  }

  function downloadQR() {
    if (!canvasRef.current) return
    const link = document.createElement('a')
    link.download = `qr-${name.toLowerCase().replace(/\s+/g, '-')}.png`
    link.href = canvasRef.current.toDataURL()
    link.click()
    toast.success('QR descargado')
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-center">
        <div className="p-3 bg-white rounded-xl">
          <canvas ref={canvasRef} />
        </div>
      </div>

      <div className="bg-muted/30 rounded-lg p-2 text-center">
        <p className="text-xs text-muted-foreground break-all">{url}</p>
      </div>

      <div className="flex gap-2">
        <Button variant="outline" size="sm" className="flex-1 text-xs" onClick={copyLink}>
          📋 Copiar Link
        </Button>
        <Button size="sm" className="flex-1 text-xs" onClick={downloadQR}>
          ⬇️ Descargar QR
        </Button>
      </div>

      <p className="text-xs text-muted-foreground text-center">
        Al escanear este QR, {name} iniciará sesión automáticamente
      </p>
    </div>
  )
}
