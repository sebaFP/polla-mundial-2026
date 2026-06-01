'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'

export default function RedirectCountdown({ to, seconds = 5 }: { to: string; seconds?: number }) {
  const [count, setCount] = useState(seconds)
  const router = useRouter()

  useEffect(() => {
    if (count <= 0) { router.push(to); return }
    const t = setTimeout(() => setCount(c => c - 1), 1000)
    return () => clearTimeout(t)
  }, [count, to, router])

  return (
    <p className="text-xs text-muted-foreground text-center">
      Redirigiendo en <span className="font-bold text-foreground">{count}</span>s…
    </p>
  )
}
