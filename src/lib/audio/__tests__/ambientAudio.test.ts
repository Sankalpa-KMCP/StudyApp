import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { startAmbient, stopAmbient, resetAmbientAudioEngine, isAmbientPlaying, getSharedAudioContext } from '../ambientAudio'

class MockGainNode {
  gain = { value: 0 }
  connect = vi.fn()
  disconnect = vi.fn()
}

class MockBufferSource {
  loop = false
  buffer: unknown = null
  connect = vi.fn()
  disconnect = vi.fn()
  start = vi.fn()
  stop = vi.fn()
}

class MockBiquadFilter {
  type = ''
  frequency = { value: 0 }
  Q = { value: 0 }
  connect = vi.fn()
  disconnect = vi.fn()
}

class MockAudioContext {
  state = 'running'
  sampleRate = 44100
  destination = {}
  createGain = vi.fn(() => new MockGainNode())
  createBufferSource = vi.fn(() => new MockBufferSource())
  createBiquadFilter = vi.fn(() => new MockBiquadFilter())
  createBuffer = vi.fn((channels: number, length: number, sampleRate: number) => ({
    getChannelData: () => new Float32Array(length),
    length,
    sampleRate,
    numberOfChannels: channels,
  }))
  resume = vi.fn().mockResolvedValue(undefined)
  close = vi.fn().mockResolvedValue(undefined)
}

describe('ambientAudio', () => {
  beforeEach(() => {
    resetAmbientAudioEngine()
    vi.stubGlobal('AudioContext', MockAudioContext)
    vi.stubGlobal('webkitAudioContext', undefined)
  })

  afterEach(() => {
    resetAmbientAudioEngine()
    vi.unstubAllGlobals()
  })

  it('starts and stops ambient playback', () => {
    expect(isAmbientPlaying()).toBe(false)
    startAmbient('rain')
    expect(isAmbientPlaying()).toBe(true)
    stopAmbient()
    expect(isAmbientPlaying()).toBe(false)
  })

  it('starts cafe and brown-noise presets', () => {
    startAmbient('cafe')
    expect(isAmbientPlaying()).toBe(true)
    stopAmbient()
    startAmbient('brown-noise')
    expect(isAmbientPlaying()).toBe(true)
    stopAmbient()
  })

  it('returns null context when AudioContext unavailable', () => {
    resetAmbientAudioEngine()
    vi.unstubAllGlobals()
    vi.stubGlobal('AudioContext', undefined)
    vi.stubGlobal('webkitAudioContext', undefined)
    expect(getSharedAudioContext()).toBeNull()
  })
})
