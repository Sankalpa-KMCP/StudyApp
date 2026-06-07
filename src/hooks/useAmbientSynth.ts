export function playTibetanBowl(_enabled: boolean) {
  // Silent: Audio disabled per user instructions
}

export function playTactileThock() {
  // Silent: Audio disabled per user instructions
}

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

export function useAmbientSynth(_props: UseAmbientSynthProps) {
  // Return mock functions that perform no actions, ensuring zero sound emission
  return {
    playChime: () => {},
    playThock: () => {}
  }
}
