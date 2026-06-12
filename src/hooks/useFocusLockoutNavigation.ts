import { useCallback } from 'react'
import type { ActiveTab } from '../types/app'
import { useConfirm } from '../context/useConfirm'
import { FOCUS_LOCKOUT } from '../lib/shared/uxTerms'
import { isFocusLockoutActive, parseLockoutAllowedTabs, type LockoutMode } from '../lib/study/focusLockout'

interface FocusLockoutTimer {
  isTimerActive: boolean
  timerMode: 'study' | 'break'
  setIsTimerActive: (active: boolean) => void
}

interface UseFocusLockoutNavigationOptions {
  enforceLockout: boolean
  lockoutMode: LockoutMode
  lockoutAllowedTabs: string
  lockoutStudyOnly: boolean
  activeTab: ActiveTab
  timer: FocusLockoutTimer
  setActiveTab: (tab: ActiveTab) => void
  onLockedAttempt?: () => void
}

export function useFocusLockoutNavigation({
  enforceLockout,
  lockoutMode,
  lockoutAllowedTabs,
  lockoutStudyOnly,
  activeTab,
  timer,
  setActiveTab,
  onLockedAttempt,
}: UseFocusLockoutNavigationOptions) {
  const { requestConfirm } = useConfirm()

  const handleSetActiveTab = useCallback(async (tab: ActiveTab) => {
    const locked = isFocusLockoutActive(
      {
        enforceLockout,
        lockoutMode,
        lockoutAllowedTabs: parseLockoutAllowedTabs(lockoutAllowedTabs),
        lockoutStudyOnly,
      },
      {
        isTimerActive: timer.isTimerActive,
        timerMode: timer.timerMode,
        activeTab,
        targetTab: tab,
      },
    )
    if (locked) {
      onLockedAttempt?.()
      if (lockoutMode === 'strict') return
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
  }, [enforceLockout, lockoutMode, lockoutAllowedTabs, lockoutStudyOnly, activeTab, timer, setActiveTab, requestConfirm, onLockedAttempt])

  return handleSetActiveTab
}
