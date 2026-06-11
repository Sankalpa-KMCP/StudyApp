export type AmbientPreset = 'rain' | 'white-noise'

let sharedContext: AudioContext | null = null
let noiseSource: AudioBufferSourceNode | null = null
let noiseGain: GainNode | null = null
let filterNode: BiquadFilterNode | null = null
let activePreset: AmbientPreset | null = null

export function getSharedAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null
  if (!sharedContext) {
    const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    if (!Ctx) return null
    sharedContext = new Ctx()
  }
  return sharedContext
}

function createNoiseBuffer(ctx: AudioContext): AudioBuffer {
  const bufferSize = ctx.sampleRate * 2
  const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate)
  const data = buffer.getChannelData(0)
  for (let i = 0; i < bufferSize; i++) {
    data[i] = Math.random() * 2 - 1
  }
  return buffer
}

function stopNodes() {
  if (noiseSource) {
    try { noiseSource.stop() } catch { /* already stopped */ }
    noiseSource.disconnect()
    noiseSource = null
  }
  if (noiseGain) {
    noiseGain.disconnect()
    noiseGain = null
  }
  if (filterNode) {
    filterNode.disconnect()
    filterNode = null
  }
  activePreset = null
}

export function stopAmbient() {
  stopNodes()
}

/** Clears module singleton state (tests and teardown). */
export function resetAmbientAudioEngine() {
  stopNodes()
  if (sharedContext) {
    try {
      void sharedContext.close()
    } catch {
      /* already closed */
    }
    sharedContext = null
  }
}

export function startAmbient(preset: AmbientPreset, volume = 0.12) {
  const ctx = getSharedAudioContext()
  if (!ctx) return

  if (activePreset === preset && noiseSource) {
    if (noiseGain) noiseGain.gain.value = volume
    if (ctx.state === 'suspended') void ctx.resume()
    return
  }

  stopNodes()

  const source = ctx.createBufferSource()
  source.buffer = createNoiseBuffer(ctx)
  source.loop = true

  const gain = ctx.createGain()
  gain.gain.value = volume

  if (preset === 'rain') {
    const filter = ctx.createBiquadFilter()
    filter.type = 'lowpass'
    filter.frequency.value = 800
    source.connect(filter)
    filter.connect(gain)
    filterNode = filter
  } else {
    source.connect(gain)
  }

  gain.connect(ctx.destination)
  source.start()

  noiseSource = source
  noiseGain = gain
  activePreset = preset

  if (ctx.state === 'suspended') void ctx.resume()
}

export function setAmbientVolume(volume: number) {
  if (noiseGain) noiseGain.gain.value = Math.max(0, Math.min(1, volume))
}

export function isAmbientPlaying() {
  return noiseSource !== null
}
