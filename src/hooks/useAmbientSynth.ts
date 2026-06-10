import { useCallback, useRef, useEffect } from 'react'

let sharedContext: AudioContext | null = null

function getAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null
  if (!sharedContext) {
    const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    if (!Ctx) return null
    sharedContext = new Ctx()
  }
  if (sharedContext.state === 'suspended') {
    void sharedContext.resume()
  }
  return sharedContext
}

interface UseAmbientSynthProps {
  soundEnabled: boolean
  tactileEnabled: boolean
}

export function useAmbientSynth({ soundEnabled, tactileEnabled }: UseAmbientSynthProps) {
  const soundEnabledRef = useRef(soundEnabled)
  const tactileEnabledRef = useRef(tactileEnabled)
  useEffect(() => {
    soundEnabledRef.current = soundEnabled
    tactileEnabledRef.current = tactileEnabled
  }, [soundEnabled, tactileEnabled])

  const playChime = useCallback(() => {
    if (!soundEnabledRef.current) return
    const ctx = getAudioContext()
    if (!ctx) return

    const now = ctx.currentTime
    const master = ctx.createGain()
    master.gain.setValueAtTime(0.0001, now)
    master.gain.exponentialRampToValueAtTime(0.25, now + 0.02)
    master.gain.exponentialRampToValueAtTime(0.0001, now + 0.9)
    master.connect(ctx.destination)

    const freqs = [180, 270, 360]
    freqs.forEach((freq, i) => {
      const osc = ctx.createOscillator()
      osc.type = 'sine'
      osc.frequency.setValueAtTime(freq, now)
      const gain = ctx.createGain()
      gain.gain.setValueAtTime(0.12 / (i + 1), now)
      osc.connect(gain)
      gain.connect(master)
      osc.start(now)
      osc.stop(now + 0.95)
    })
  }, [])

  const playThock = useCallback(() => {
    if (!tactileEnabledRef.current || !soundEnabledRef.current) return
    const ctx = getAudioContext()
    if (!ctx) return

    const now = ctx.currentTime
    const osc = ctx.createOscillator()
    osc.type = 'square'
    osc.frequency.setValueAtTime(120, now)
    const gain = ctx.createGain()
    gain.gain.setValueAtTime(0.08, now)
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.05)
    osc.connect(gain)
    gain.connect(ctx.destination)
    osc.start(now)
    osc.stop(now + 0.06)
  }, [])

  const ensureAudio = useCallback(() => {
    getAudioContext()
  }, [])

  return { playChime, playThock, ensureAudio }
}
