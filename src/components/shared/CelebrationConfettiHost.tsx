import { lazy, Suspense, useEffect, useRef, useState } from 'react'

const CelebrationConfetti = lazy(() =>
  import('./CelebrationConfetti').then(m => ({ default: m.CelebrationConfetti })),
)

interface CelebrationDetail {
  count?: number
  x?: number
  y?: number
}

export function CelebrationConfettiHost() {
  const [mounted, setMounted] = useState(false)
  const pendingRef = useRef<CelebrationDetail[]>([])

  useEffect(() => {
    const onCelebrate = (event: Event) => {
      pendingRef.current.push((event as CustomEvent<CelebrationDetail>).detail ?? {})
      setMounted(true)
    }
    window.addEventListener('celebrate-complete', onCelebrate)
    return () => window.removeEventListener('celebrate-complete', onCelebrate)
  }, [])

  useEffect(() => {
    if (!mounted) return
    const pending = pendingRef.current.splice(0)
    for (const detail of pending) {
      window.dispatchEvent(new CustomEvent('celebrate-complete', { detail }))
    }
  }, [mounted])

  if (!mounted) return null

  return (
    <Suspense fallback={null}>
      <CelebrationConfetti />
    </Suspense>
  )
}
