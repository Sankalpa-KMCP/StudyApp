import type { ActiveTab } from '../../types/app'

export type LockoutMode = 'strict' | 'soft'

export interface FocusLockoutSettings {
  enforceLockout: boolean
  lockoutMode: LockoutMode
  lockoutAllowedTabs: ActiveTab[]
  lockoutStudyOnly: boolean
}

export function parseLockoutAllowedTabs(raw: string): ActiveTab[] {
  try {
    const parsed = JSON.parse(raw) as unknown
    if (!Array.isArray(parsed)) return []
    const valid: ActiveTab[] = ['focus', 'cards', 'analytics', 'journal', 'settings']
    return parsed.filter((t): t is ActiveTab => typeof t === 'string' && valid.includes(t as ActiveTab))
  } catch {
    return []
  }
}

export function isFocusLockoutActive(
  settings: FocusLockoutSettings,
  context: { isTimerActive: boolean; timerMode: 'study' | 'break'; activeTab: ActiveTab; targetTab?: ActiveTab },
): boolean {
  if (!settings.enforceLockout || !context.isTimerActive) return false
  if (settings.lockoutStudyOnly && context.timerMode !== 'study') return false
  const tab = context.targetTab ?? context.activeTab
  if (tab === 'focus') return false
  if (settings.lockoutAllowedTabs.includes(tab)) return false
  return true
}
