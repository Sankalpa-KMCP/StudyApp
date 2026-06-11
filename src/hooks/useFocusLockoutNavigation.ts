import { useCallback } from 'react'
import type { ActiveTab } from '../types/app'
import { useConfirm } from '../context/useConfirm'

interface FocusLockoutTimer {
  isTimerActive: boolean
  timerMode: 'study' | 'break'
  setIsTimerActive: (active: boolean) => void
}

interface UseFocusLockoutNavigationOptions {
  enforceLockout: boolean
  timer: FocusLockoutTimer
  setActiveTab: (tab: ActiveTab) => void
}

export function useFocusLockoutNavigation({
  enforceLockout,
  timer,
  setActiveTab,
}: UseFocusLockoutNavigationOptions) {
  const { requestConfirm } = useConfirm()

  const handleSetActiveTab = useCallback(async (tab: ActiveTab) => {
    const locked =
      enforceLockout &&
      timer.isTimerActive &&
      timer.timerMode === 'study' &&
      tab !== 'focus'
    if (locked) {
      const ok = await requestConfirm({
        title: 'Focus Lockout Active',
        message: 'Your lockout setting is active to prevent distractions. Pause your study timer to navigate to other tabs.',
        confirmLabel: 'Pause & Navigate',
        danger: true,
      })
      if (ok) {
        timer.setIsTimerActive(false)
        setActiveTab(tab)
      }
      return
    }
    setActiveTab(tab)
  }, [enforceLockout, timer, setActiveTab, requestConfirm])

  return handleSetActiveTab
}
