import { useEffect } from 'react'
import { startAmbient, stopAmbient } from '../lib/ambientAudio'
import type { AmbientPreset } from '../lib/ambientAudio'

interface UseAmbientSoundOptions {
  enabled: boolean
  preset: AmbientPreset
  isTimerActive: boolean
  timerMode: 'study' | 'break'
}

export function useAmbientSound({
  enabled,
  preset,
  isTimerActive,
  timerMode,
}: UseAmbientSoundOptions) {
  const shouldPlay = enabled && isTimerActive && timerMode === 'study'

  useEffect(() => {
    if (!shouldPlay) {
      stopAmbient()
      return
    }

    startAmbient(preset)

    function handleVisibility() {
      if (document.hidden) {
        stopAmbient()
      } else if (shouldPlay) {
        startAmbient(preset)
      }
    }

    document.addEventListener('visibilitychange', handleVisibility)
    return () => {
      document.removeEventListener('visibilitychange', handleVisibility)
      stopAmbient()
    }
  }, [shouldPlay, preset])
}
