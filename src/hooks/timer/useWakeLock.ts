import { useEffect, useState } from 'react'
import { requestWakeLock, releaseWakeLock } from '../../lib/desktop/wakeLock'

export function useWakeLock(isTimerActive: boolean, timerMode: 'study' | 'break') {
  const [wakeLockActive, setWakeLockActive] = useState(false)

  useEffect(() => {
    let activeSentinel: WakeLockSentinel | null = null
    let isMounted = true

    async function acquireLock() {
      if (isTimerActive && timerMode === 'study' && !document.hidden) {
        if (activeSentinel) {
          await releaseWakeLock(activeSentinel)
          activeSentinel = null
        }
        const lock = await requestWakeLock()
        if (isMounted) {
          activeSentinel = lock
          setWakeLockActive(!!lock)
        }
      } else if (isMounted) {
        setWakeLockActive(false)
      }
    }

    void acquireLock()

    const onVisibility = () => { void acquireLock() }
    document.addEventListener('visibilitychange', onVisibility)

    return () => {
      isMounted = false
      document.removeEventListener('visibilitychange', onVisibility)
      if (activeSentinel) releaseWakeLock(activeSentinel)
      setWakeLockActive(false)
    }
  }, [isTimerActive, timerMode])

  return { wakeLockActive }
}
