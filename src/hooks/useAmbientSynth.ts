import { useEffect, useRef } from 'react'

let audioCtx: AudioContext | null = null

export function playTibetanBowl(enabled: boolean) {
  if (!enabled) return
  try {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext
    if (!audioCtx) audioCtx = new AudioContextClass()
    const ctx = audioCtx
    if (ctx.state === 'suspended') {
      ctx.resume()
    }
    const now = ctx.currentTime
    const releaseTime = 6.0

    // Master Gain
    const masterGain = ctx.createGain()
    masterGain.gain.setValueAtTime(0, now)
    masterGain.gain.linearRampToValueAtTime(0.3, now + 0.05)
    masterGain.gain.exponentialRampToValueAtTime(0.0001, now + releaseTime)
    masterGain.connect(ctx.destination)

    // Fundamental baseline frequency
    const f0 = 180

    // Additive harmonic ratios for a rich, realistic singing bowl chime
    const partials = [
      { ratio: 1.0, vol: 0.4, detune: 0 },
      { ratio: 1.0, vol: 0.2, detune: 1.5 },  // detuning to create acoustic beating
      { ratio: 2.76, vol: 0.25, detune: 0 },
      { ratio: 2.76, vol: 0.15, detune: -1.0 },
      { ratio: 5.4, vol: 0.15, detune: 0.5 },
      { ratio: 8.93, vol: 0.08, detune: -0.5 }
    ]

    partials.forEach(p => {
      const osc = ctx.createOscillator()
      const oscGain = ctx.createGain()

      osc.type = 'sine'
      osc.frequency.setValueAtTime(f0 * p.ratio, now)
      osc.detune.setValueAtTime(p.detune, now)

      // Add a low-frequency oscillator (LFO) to create the beating vibration
      const lfo = ctx.createOscillator()
      const lfoGain = ctx.createGain()
      lfo.frequency.setValueAtTime(1.5 + Math.random() * 2, now) // 1.5 - 3.5 Hz
      lfoGain.gain.setValueAtTime(0.05 * p.vol, now)
      lfo.connect(lfoGain)
      lfoGain.connect(oscGain.gain)

      oscGain.gain.setValueAtTime(p.vol, now)

      osc.connect(oscGain)
      oscGain.connect(masterGain)

      lfo.start(now)
      osc.start(now)

      lfo.stop(now + releaseTime)
      osc.stop(now + releaseTime)
    })
  } catch (err) {
    console.error('Failed to play Tibetan Bowl chime:', err)
  }
}

export function playTactileThock() {
  try {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext
    if (!audioCtx) audioCtx = new AudioContextClass()
    const ctx = audioCtx
    if (ctx.state === 'suspended') {
      ctx.resume()
    }
    const now = ctx.currentTime
    const duration = 0.005
    const sampleRate = ctx.sampleRate
    const bufferSize = Math.max(1, Math.floor(sampleRate * duration))
    const buffer = ctx.createBuffer(1, bufferSize, sampleRate)
    const data = buffer.getChannelData(0)

    let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0
    for (let i = 0; i < bufferSize; i++) {
      const white = Math.random() * 2 - 1
      b0 = 0.99886 * b0 + white * 0.0555179
      b1 = 0.99332 * b1 + white * 0.0750759
      b2 = 0.96900 * b2 + white * 0.1538520
      b3 = 0.86650 * b3 + white * 0.3104856
      b4 = 0.55000 * b4 + white * 0.5329522
      b5 = -0.7616 * b5 - white * 0.0168980
      const pink = b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362
      b6 = white * 0.115926
      data[i] = pink * 0.11
    }

    const noiseNode = ctx.createBufferSource()
    noiseNode.buffer = buffer

    const filter = ctx.createBiquadFilter()
    filter.type = 'bandpass'
    filter.frequency.setValueAtTime(380, now)
    filter.Q.setValueAtTime(6.0, now)

    const gainNode = ctx.createGain()
    gainNode.gain.setValueAtTime(0.4, now)
    gainNode.gain.exponentialRampToValueAtTime(0.0001, now + duration)

    noiseNode.connect(filter)
    filter.connect(gainNode)
    gainNode.connect(ctx.destination)

    noiseNode.start(now)
    noiseNode.onended = () => {
      try {
        noiseNode.disconnect()
        filter.disconnect()
        gainNode.disconnect()
      } catch {}
    }
  } catch {
    /* audio unavailable */
  }
}

// Custom hook definition
interface UseAmbientSynthProps {
  timerMode: 'study' | 'break'
  isTimerActive: boolean
  soundEnabled: boolean
  noiseType: 'white' | 'pink' | 'brown'
  binauralTarget: 'alpha' | 'theta' | 'beta'
  rainVol: number
  cafeVol: number
  noiseVol: number
  binauralVol: number
  tactileEnabled: boolean
}

export function useAmbientSynth({
  timerMode,
  isTimerActive,
  soundEnabled,
  noiseType,
  binauralTarget,
  rainVol,
  cafeVol,
  noiseVol,
  binauralVol,
  tactileEnabled
}: UseAmbientSynthProps) {
  const masterGainRef = useRef<GainNode | null>(null)
  
  // Channels storage
  const channelsRef = useRef<
    Record<string, { source: AudioNode | null; gainNode: GainNode | null; stop: (() => void) | null }>
  >({
    rain: { source: null, gainNode: null, stop: null },
    cafe: { source: null, gainNode: null, stop: null },
    noise: { source: null, gainNode: null, stop: null },
    binaural: { source: null, gainNode: null, stop: null }
  })

  // Procedural Noise Buffer Generators
  const generateNoiseBuffer = (ctx: AudioContext, type: 'white' | 'pink' | 'brown'): AudioBuffer => {
    const sampleRate = ctx.sampleRate
    const bufSize = sampleRate * 2 // 2 seconds loop
    const buffer = ctx.createBuffer(1, bufSize, sampleRate)
    const d = buffer.getChannelData(0)

    if (type === 'white') {
      for (let i = 0; i < bufSize; i++) {
        d[i] = Math.random() * 2 - 1
      }
    } else if (type === 'pink') {
      let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0
      for (let i = 0; i < bufSize; i++) {
        const white = Math.random() * 2 - 1
        b0 = 0.99886 * b0 + white * 0.0555179
        b1 = 0.99332 * b1 + white * 0.0750759
        b2 = 0.96900 * b2 + white * 0.1538520
        b3 = 0.86650 * b3 + white * 0.3104856
        b4 = 0.55000 * b4 + white * 0.5329522
        b5 = -0.7616 * b5 - white * 0.0168980
        const pink = b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362
        b6 = white * 0.115926
        d[i] = pink * 0.11 // Adjust gain
      }
    } else if (type === 'brown') {
      let lastOut = 0.0
      for (let i = 0; i < bufSize; i++) {
        const white = Math.random() * 2 - 1
        d[i] = (lastOut + 0.02 * white) / 1.02
        lastOut = d[i]
        d[i] *= 3.5 // Adjust gain
      }
    }
    return buffer
  }

  const createTrackNode = (ctx: AudioContext, trackId: string): { output: AudioNode; stop: () => void } | null => {
    if (trackId === 'noise') {
      const buffer = generateNoiseBuffer(ctx, noiseType)
      const src = ctx.createBufferSource()
      src.buffer = buffer
      src.loop = true
      src.start()
      return { output: src, stop: () => { try { src.stop(); src.disconnect() } catch {} } }
    }

    if (trackId === 'rain') {
      // Brown noise core
      const buffer = generateNoiseBuffer(ctx, 'brown')
      const src = ctx.createBufferSource()
      src.buffer = buffer
      src.loop = true
      src.start()

      const filter = ctx.createBiquadFilter()
      filter.type = 'lowpass'
      filter.frequency.value = 600

      const lfo = ctx.createOscillator()
      lfo.frequency.value = 0.2

      const lfoGain = ctx.createGain()
      lfoGain.gain.value = 0.2
      lfo.connect(lfoGain)

      const ampGain = ctx.createGain()
      ampGain.gain.value = 0.48
      lfoGain.connect(ampGain.gain)
      
      lfo.start()
      src.connect(filter)
      filter.connect(ampGain)

      // Micro Rain Droplet scheduling
      let rainClickInterval: any = null
      const scheduleRainClick = (time: number) => {
        try {
          const clickBuf = ctx.createBuffer(1, ctx.sampleRate * 0.02, ctx.sampleRate)
          const clickData = clickBuf.getChannelData(0)
          for (let i = 0; i < clickData.length; i++) {
            clickData[i] = Math.random() * 2 - 1
          }
          const clickNode = ctx.createBufferSource()
          clickNode.buffer = clickBuf
          
          const clickFilter = ctx.createBiquadFilter()
          clickFilter.type = 'bandpass'
          clickFilter.frequency.setValueAtTime(1400 + Math.random() * 800, time)
          clickFilter.Q.setValueAtTime(4, time)
          
          const clickGain = ctx.createGain()
          clickGain.gain.setValueAtTime(0, time)
          clickGain.gain.linearRampToValueAtTime(0.06 + Math.random() * 0.06, time + 0.001)
          clickGain.gain.exponentialRampToValueAtTime(0.0001, time + 0.02)
          
          clickNode.connect(clickFilter)
          clickFilter.connect(clickGain)
          clickGain.connect(ampGain)
          
          clickNode.start(time)
          clickNode.onended = () => {
            try {
              clickNode.disconnect()
              clickFilter.disconnect()
              clickGain.disconnect()
            } catch {}
          }
        } catch {}
      }

      const runScheduler = () => {
        const nextDelay = 40 + Math.random() * 120
        rainClickInterval = setTimeout(() => {
          if (ctx.state !== 'closed') {
            scheduleRainClick(ctx.currentTime)
            runScheduler()
          }
        }, nextDelay)
      }
      runScheduler()

      return {
        output: ampGain,
        stop: () => {
          try {
            clearTimeout(rainClickInterval)
            src.stop()
            lfo.stop()
            src.disconnect()
            filter.disconnect()
            lfo.disconnect()
            lfoGain.disconnect()
            ampGain.disconnect()
          } catch {}
        }
      }
    }

    if (trackId === 'cafe') {
      const buffer = generateNoiseBuffer(ctx, 'white')
      const src = ctx.createBufferSource()
      src.buffer = buffer
      src.loop = true
      src.start()

      const bandpass = ctx.createBiquadFilter()
      bandpass.type = 'bandpass'
      bandpass.frequency.value = 900
      bandpass.Q.value = 0.4

      const gain = ctx.createGain()
      gain.gain.value = 0.25

      src.connect(bandpass)
      bandpass.connect(gain)

      return {
        output: gain,
        stop: () => {
          try {
            src.stop()
            src.disconnect()
            bandpass.disconnect()
            gain.disconnect()
          } catch {}
        }
      }
    }

    if (trackId === 'binaural') {
      const oscL = ctx.createOscillator()
      const oscR = ctx.createOscillator()
      
      oscL.type = 'sine'
      oscL.frequency.setValueAtTime(100, ctx.currentTime) // baseline 100 Hz

      // Calculate frequency offset based on selected target
      let offset = 10 // alpha default
      if (binauralTarget === 'theta') offset = 6
      else if (binauralTarget === 'beta') offset = 16

      oscR.type = 'sine'
      oscR.frequency.setValueAtTime(100 + offset, ctx.currentTime)
      
      const pannerL = ctx.createStereoPanner()
      pannerL.pan.setValueAtTime(-1, ctx.currentTime)
      
      const pannerR = ctx.createStereoPanner()
      pannerR.pan.setValueAtTime(1, ctx.currentTime)
      
      const gainNode = ctx.createGain()
      gainNode.gain.setValueAtTime(0.25, ctx.currentTime)
      
      oscL.connect(pannerL)
      pannerL.connect(gainNode)
      
      oscR.connect(pannerR)
      pannerR.connect(gainNode)
      
      oscL.start()
      oscR.start()
      
      return {
        output: gainNode,
        stop: () => {
          try {
            oscL.stop()
            oscR.stop()
            oscL.disconnect()
            oscR.disconnect()
            pannerL.disconnect()
            pannerR.disconnect()
            gainNode.disconnect()
          } catch {}
        }
      }
    }

    return null
  }

  const updateAudioMixer = () => {
    try {
      const isStudyActive = timerMode === 'study' && isTimerActive
      const tracks = [
        { id: 'rain', vol: rainVol },
        { id: 'cafe', vol: cafeVol },
        { id: 'noise', vol: noiseVol },
        { id: 'binaural', vol: binauralVol }
      ]

      const anyActive = isStudyActive && tracks.some(t => t.vol > 0)

      if (!anyActive) {
        tracks.forEach(t => {
          const ch = channelsRef.current[t.id]
          if (ch && ch.stop) {
            try { ch.stop() } catch {}
            channelsRef.current[t.id] = { source: null, gainNode: null, stop: null }
          }
        })
        if (audioCtx && audioCtx.state !== 'suspended') {
          audioCtx.suspend()
        }
        return
      }

      if (!audioCtx) {
        const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext
        audioCtx = new AudioContextClass()
        const masterGain = audioCtx.createGain()
        masterGain.connect(audioCtx.destination)
        masterGainRef.current = masterGain
      }

      const ctx = audioCtx

      if (ctx.state === 'suspended') {
        ctx.resume()
      }

      const aggregateVol = tracks.reduce((sum, t) => sum + t.vol, 0)
      if (masterGainRef.current) {
        masterGainRef.current.gain.setValueAtTime(anyActive ? Math.min(1.0, aggregateVol) : 0, ctx.currentTime)
      }

      tracks.forEach(t => {
        const ch = channelsRef.current[t.id]
        const shouldPlay = isStudyActive && t.vol > 0

        if (shouldPlay) {
          // Re-create node if it doesn't exist OR if we need to swap noiseType/binauralTarget
          const isNoiseTypeMismatch = t.id === 'noise' && ch.source && (ch.source as any).bufferType !== noiseType
          const isBinauralTargetMismatch = t.id === 'binaural' && ch.source && (ch.source as any).binauralTarget !== binauralTarget

          if (!ch.source || isNoiseTypeMismatch || isBinauralTargetMismatch) {
            // Stop old node if mismatched
            if (ch.stop) {
              try { ch.stop() } catch {}
            }

            const gainNode = ctx.createGain()
            gainNode.gain.setValueAtTime(t.vol, ctx.currentTime)
            gainNode.connect(masterGainRef.current || ctx.destination)

            const result = createTrackNode(ctx, t.id)
            if (result) {
              result.output.connect(gainNode)
              
              // Tag source to track updates
              if (t.id === 'noise') (result.output as any).bufferType = noiseType
              if (t.id === 'binaural') (result.output as any).binauralTarget = binauralTarget

              channelsRef.current[t.id] = {
                source: result.output,
                gainNode: gainNode,
                stop: () => {
                  try {
                    result.stop()
                    gainNode.disconnect()
                  } catch {}
                }
              }
            } else {
              gainNode.disconnect()
            }
          } else {
            if (ch.gainNode) {
              ch.gainNode.gain.setValueAtTime(t.vol, ctx.currentTime)
            }
          }
        } else {
          if (ch.stop) {
            try { ch.stop() } catch {}
            channelsRef.current[t.id] = { source: null, gainNode: null, stop: null }
          }
        }
      })
    } catch (err) {
      console.error('Failed to update audio mixer:', err)
    }
  }

  // Trigger mixer updates on volume and option edits
  useEffect(() => {
    updateAudioMixer()
  }, [timerMode, isTimerActive, rainVol, cafeVol, noiseVol, binauralVol, noiseType, binauralTarget])

  // Stop everything on unmount
  useEffect(() => {
    return () => {
      const tracks = ['rain', 'cafe', 'noise', 'binaural']
      tracks.forEach(id => {
        const ch = channelsRef.current[id]
        if (ch && ch.stop) {
          try { ch.stop() } catch {}
        }
      })
    }
  }, [])

  // Tactile Mechanical feedback keystroke thock listener
  useEffect(() => {
    const handleKeystroke = () => {
      if (tactileEnabled && soundEnabled) {
        playTactileThock()
      }
    }
    window.addEventListener('keydown', handleKeystroke, true)
    return () => window.removeEventListener('keydown', handleKeystroke, true)
  }, [tactileEnabled, soundEnabled])

  // Tactile click feedback listener
  useEffect(() => {
    const handleGlobalClick = (e: MouseEvent) => {
      if (!tactileEnabled || !soundEnabled) return
      const target = e.target as HTMLElement
      const isInteractive = target.closest('button') || target.closest('a') || target.tagName === 'INPUT' || target.tagName === 'SELECT'
      if (isInteractive) {
        playTactileThock()
      }
    }
    window.addEventListener('click', handleGlobalClick)
    return () => window.removeEventListener('click', handleGlobalClick)
  }, [tactileEnabled, soundEnabled])

  return {
    playChime: () => playTibetanBowl(soundEnabled),
    playThock: () => playTactileThock()
  }
}
