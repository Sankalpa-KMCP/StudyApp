import { useEffect, type RefObject } from 'react'

export function useZenCanvas(isZenMode: boolean, canvasRef: RefObject<HTMLCanvasElement | null>) {
  useEffect(() => {
    if (!isZenMode) return

    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    let animationFrameId: number
    let width = canvas.width = window.innerWidth
    let height = canvas.height = window.innerHeight

    const handleResize = () => {
      if (!canvas) return
      width = canvas.width = window.innerWidth
      height = canvas.height = window.innerHeight
    }
    window.addEventListener('resize', handleResize)

    interface Particle {
      x: number
      y: number
      originalVx: number
      originalVy: number
      radius: number
    }

    const particleCount = 40
    const particles: Particle[] = []

    for (let i = 0; i < particleCount; i++) {
      const x = Math.random() * width
      const y = Math.random() * height
      const angle = Math.random() * Math.PI * 2
      const speed = Math.random() * 0.4 + 0.15
      particles.push({
        x,
        y,
        originalVx: Math.cos(angle) * speed,
        originalVy: Math.sin(angle) * speed,
        radius: Math.random() * 1.8 + 0.8,
      })
    }

    let waveAmplitude = 0

    const animate = () => {
      ctx.clearRect(0, 0, width, height)

      const maxDistance = 80
      const maxLineAlpha = 0.12

      particles.forEach(p => {
        p.x += p.originalVx
        p.y += p.originalVy
        if (p.x < 0) { p.x = 0; p.originalVx *= -1 }
        else if (p.x > width) { p.x = width; p.originalVx *= -1 }
        if (p.y < 0) { p.y = 0; p.originalVy *= -1 }
        else if (p.y > height) { p.y = height; p.originalVy *= -1 }
      })

      particles.forEach(p => {
        ctx.beginPath()
        ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2)
        ctx.fillStyle = 'rgba(255, 255, 255, 0.08)'
        ctx.fill()
      })

      for (let i = 0; i < particleCount; i++) {
        for (let j = i + 1; j < particleCount; j++) {
          const p1 = particles[i]
          const p2 = particles[j]
          const dx = p1.x - p2.x
          const dy = p1.y - p2.y
          const dist = Math.sqrt(dx * dx + dy * dy)
          if (dist < maxDistance) {
            const alpha = (1 - dist / maxDistance) * maxLineAlpha
            ctx.beginPath()
            ctx.moveTo(p1.x, p1.y)
            ctx.lineTo(p2.x, p2.y)
            ctx.strokeStyle = `rgba(255, 255, 255, ${alpha * 0.4})`
            ctx.lineWidth = 0.5
            ctx.stroke()
          }
        }
      }

      const waveBaseY = height - 2
      const targetAmp = 20
      waveAmplitude += (targetAmp - waveAmplitude) * 0.035

      if (waveAmplitude > 0.5) {
        const waveTime = performance.now() * 0.001
        ctx.beginPath()
        ctx.moveTo(0, waveBaseY)
        for (let x = 0; x <= width; x += 4) {
          ctx.lineTo(x, waveBaseY + Math.sin(x * 0.008 + waveTime * 0.8) * waveAmplitude)
        }
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)'
        ctx.lineWidth = 0.75
        ctx.stroke()
      }

      animationFrameId = requestAnimationFrame(animate)
    }

    animate()

    return () => {
      cancelAnimationFrame(animationFrameId)
      window.removeEventListener('resize', handleResize)
    }
  }, [isZenMode, canvasRef])
}
