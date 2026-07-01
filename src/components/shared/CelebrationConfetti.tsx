import { useEffect, useRef } from 'react'

interface ConfettiParticle {
  x: number
  y: number
  vx: number
  vy: number
  color: string
  shape: 'circle' | 'square' | 'triangle'
  size: number
  rotation: number
  rotationSpeed: number
}

function readThemeConfettiColors(): string[] {
  if (typeof document === 'undefined') {
    return ['#007aff', '#af52de', '#34c759', '#ff9500']
  }
  const style = getComputedStyle(document.documentElement)
  return [
    style.getPropertyValue('--color-accent-blue').trim() || '#007aff',
    style.getPropertyValue('--color-accent-purple').trim() || '#af52de',
    style.getPropertyValue('--color-accent-green').trim() || '#34c759',
    style.getPropertyValue('--color-accent-amber').trim() || '#ff9500',
  ]
}

export function CelebrationConfetti() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const particlesRef = useRef<ConfettiParticle[]>([])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    let animationFrameId: number
    let width = (canvas.width = window.innerWidth)
    let height = (canvas.height = window.innerHeight)

    const handleResize = () => {
      width = canvas.width = window.innerWidth
      height = canvas.height = window.innerHeight
    }
    window.addEventListener('resize', handleResize)

    const createBurst = (x: number, y: number, count: number = 80) => {
      const isReduced = typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
      if (isReduced) return
      const colors = readThemeConfettiColors()

      for (let i = 0; i < count; i++) {
        const angle = Math.random() * Math.PI * 2
        const velocity = Math.random() * 8 + 4
        const shapes: ('circle' | 'square' | 'triangle')[] = ['circle', 'square', 'triangle']
        particlesRef.current.push({
          x,
          y,
          vx: Math.cos(angle) * velocity,
          vy: Math.sin(angle) * velocity - Math.random() * 3,
          color: colors[Math.floor(Math.random() * colors.length)],
          shape: shapes[Math.floor(Math.random() * shapes.length)],
          size: Math.random() * 6 + 4,
          rotation: Math.random() * 360,
          rotationSpeed: Math.random() * 10 - 5,
        })
      }
    }

    const handleCelebrate = (e: Event) => {
      const customEvent = e as CustomEvent
      const count = customEvent.detail?.count ?? 80
      const x = customEvent.detail?.x ?? width / 2
      const y = customEvent.detail?.y ?? height / 2 + 100
      createBurst(x, y, count)
    }

    window.addEventListener('celebrate-complete', handleCelebrate)

    const animate = () => {
      const particles = particlesRef.current
      if (particles.length === 0) {
        animationFrameId = requestAnimationFrame(animate)
        return
      }

      ctx.clearRect(0, 0, width, height)

      for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i]
        p.x += p.vx
        p.y += p.vy
        p.vy += 0.2
        p.vx *= 0.98
        p.vy *= 0.98
        p.rotation += p.rotationSpeed

        if (p.y > height + 20 || p.x < -20 || p.x > width + 20) {
          particles.splice(i, 1)
          continue
        }

        ctx.save()
        ctx.translate(p.x, p.y)
        ctx.rotate((p.rotation * Math.PI) / 180)
        ctx.fillStyle = p.color

        ctx.beginPath()
        if (p.shape === 'circle') {
          ctx.arc(0, 0, p.size / 2, 0, Math.PI * 2)
          ctx.fill()
        } else if (p.shape === 'square') {
          ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size)
        } else if (p.shape === 'triangle') {
          ctx.moveTo(0, -p.size / 2)
          ctx.lineTo(p.size / 2, p.size / 2)
          ctx.lineTo(-p.size / 2, p.size / 2)
          ctx.closePath()
          ctx.fill()
        }
        ctx.restore()
      }

      animationFrameId = requestAnimationFrame(animate)
    }

    animate()

    return () => {
      cancelAnimationFrame(animationFrameId)
      window.removeEventListener('resize', handleResize)
      window.removeEventListener('celebrate-complete', handleCelebrate)
    }
  }, [])

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 pointer-events-none z-[9999]"
      style={{ mixBlendMode: 'screen' }}
    />
  )
}
