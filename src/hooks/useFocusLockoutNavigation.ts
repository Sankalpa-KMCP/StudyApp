import { useCallback } from 'react'
import type { ActiveTab } from '../types/app'
import { useConfirm } from '../context/useConfirm'
import { FOCUS_LOCKOUT } from '../lib/uxTerms'

interface FocusLockoutTimer {
  isTimerActive: boolean
  timerMode: 'study' | 'break'
  setIsTimerActive: (active: boolean) => void
}

interface UseFocusLockoutNavigationOptions {
  enforceLockout: boolean
  timer: FocusLockoutTimer
  setActiveTab: (tab: ActiveTab) => void
  onLockedAttempt?: () => void
}

export function useFocusLockoutNavigation({
  enforceLockout,
  timer,
  setActiveTab,
  onLockedAttempt,
}: UseFocusLockoutNavigationOptions) {
  const { requestConfirm } = useConfirm()

  const handleSetActiveTab = useCallback(async (tab: ActiveTab) => {
    const locked =
      enforceLockout &&
      timer.isTimerActive &&
      timer.timerMode === 'study' &&
      tab !== 'focus'
    if (locked) {
      onLockedAttempt?.()
      const ok = await requestConfirm({
        title: `${FOCUS_LOCKOUT} active`,
        message: 'Your lockout setting prevents leaving Focus during an active study block. Pause the timer to navigate away.',
        confirmLabel: 'Pause & navigate',
        danger: true,
      })
      if (ok) {
        timer.setIsTimerActive(false)
        setActiveTab(tab)
      }
      return
    }
    setActiveTab(tab)
  }, [enforceLockout, timer, setActiveTab, requestConfirm, onLockedAttempt])

  return handleSetActiveTab
}
