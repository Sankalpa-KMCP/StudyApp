import { useEffect } from 'react'
import { startAmbient, stopAmbient } from '../lib/ambientAudio'
import type { AmbientPreset } from '../lib/ambientAudio'

interface UseAmbientSoundOptions {
  enabled: boolean
  preset: AmbientPreset
  volumePercent?: number
  isTimerActive: boolean
  timerMode: 'study' | 'break'
}

export function useAmbientSound({
  enabled,
  preset,
  volumePercent = 50,
  isTimerActive,
  timerMode,
}: UseAmbientSoundOptions) {
  const shouldPlay = enabled && isTimerActive && timerMode === 'study'
  const volume = Math.max(0, Math.min(100, volumePercent)) / 100 * 0.24

  useEffect(() => {
    if (!shouldPlay) {
      stopAmbient()
      return
    }

    startAmbient(preset, volume)

    function handleVisibility() {
      if (document.hidden) {
        stopAmbient()
      } else if (shouldPlay) {
        startAmbient(preset, volume)
      }
    }

    document.addEventListener('visibilitychange', handleVisibility)
    return () => {
      document.removeEventListener('visibilitychange', handleVisibility)
      stopAmbient()
    }
  }, [shouldPlay, preset, volume])
}
