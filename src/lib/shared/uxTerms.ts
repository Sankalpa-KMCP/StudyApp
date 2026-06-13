/** UX copy helpers — call at runtime for locale reactivity. */
import { t } from '../../i18n'

export function productName() { return t('productName') }

export function focusMode() { return t('focusMode') }
export function focusModeOn() { return t('focusModeOn') }
export function focusModeOff() { return t('focusModeOff') }

export function focusLockout() { return t('focusLockout') }
export function focusLockoutActive() { return t('focusLockoutActive') }

export function studyBlock() { return t('studyBlock') }
export function studyBlockSaved() { return t('studyBlockSaved') }
export function studyBlockComplete() { return t('studyBlockComplete') }

export function focusTarget() { return t('focusTarget') }
export function focusTargets() { return t('focusTargets') }
export function noFocusTarget() { return t('noFocusTarget') }
export function workingOn() { return t('workingOn') }

export function sessionsBeforeLongBreak() { return t('sessionsBeforeLongBreak') }

export function timerRunning() { return t('timerRunning') }
export function timerPaused() { return t('timerPaused') }
export function switchedToStudy() { return t('switchedToStudy') }
export function switchedToBreak() { return t('switchedToBreak') }

export function pauseTimerToLeave() { return t('pauseTimerToLeave') }

export function endStudyBlockEarly() { return t('endStudyBlockEarly') }
export function endStudyBlockEarlyBody() { return t('endStudyBlockEarlyBody') }

export function breakEnded() { return t('breakEnded') }
export function endBreakEarly() { return t('endBreakEarly') }
export function endBreakEarlyConfirm() { return t('endBreakEarlyConfirm') }
export function endBreakEarlyBody() { return t('endBreakEarlyBody') }

export function sm2Helper() { return t('sm2Helper') }

export function quickNotesHelper() { return t('quickNotesHelper') }
export function journalHelper() { return t('journalHelper') }
export function journalPanelHelper() { return t('journalPanelHelper') }
export function journalTabSubtitle() { return t('journalTabSubtitle') }

export function archivedTasks(count: number) {
  return count === 1 ? t('archivedTasksOne') : t('archivedTasksMany', { count })
}

export function hotkeyHint() { return t('hotkeyHint') }

export function shortcutsPanelOpened() { return t('shortcutsPanelOpened') }
export function shortcutsPanelClosed() { return t('shortcutsPanelClosed') }
export function sidebarToggled() { return t('sidebarToggled') }
