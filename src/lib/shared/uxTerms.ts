/** @deprecated Import `t` from `../../i18n` or use `useTranslation()` in components. */
import { t } from '../../i18n'

export const PRODUCT_NAME = t('productName')

export const FOCUS_MODE = t('focusMode')
export const FOCUS_MODE_ON = t('focusModeOn')
export const FOCUS_MODE_OFF = t('focusModeOff')

export const FOCUS_LOCKOUT = t('focusLockout')
export const FOCUS_LOCKOUT_ACTIVE = t('focusLockoutActive')

export const STUDY_BLOCK = t('studyBlock')
export const STUDY_BLOCK_SAVED = t('studyBlockSaved')
export const STUDY_BLOCK_COMPLETE = t('studyBlockComplete')

export const FOCUS_TARGET = t('focusTarget')
export const FOCUS_TARGETS = t('focusTargets')
export const NO_FOCUS_TARGET = t('noFocusTarget')
export const WORKING_ON = t('workingOn')

export const SESSIONS_BEFORE_LONG_BREAK = t('sessionsBeforeLongBreak')

export const TIMER_RUNNING = t('timerRunning')
export const TIMER_PAUSED = t('timerPaused')
export const SWITCHED_TO_STUDY = t('switchedToStudy')
export const SWITCHED_TO_BREAK = t('switchedToBreak')

export const PAUSE_TIMER_TO_LEAVE = t('pauseTimerToLeave')

export const END_STUDY_BLOCK_EARLY = t('endStudyBlockEarly')
export const END_STUDY_BLOCK_EARLY_BODY = t('endStudyBlockEarlyBody')

export const BREAK_ENDED = t('breakEnded')
export const END_BREAK_EARLY = t('endBreakEarly')
export const END_BREAK_EARLY_CONFIRM = t('endBreakEarlyConfirm')
export const END_BREAK_EARLY_BODY = t('endBreakEarlyBody')

export const SM2_HELPER = t('sm2Helper')

export const QUICK_NOTES_HELPER = t('quickNotesHelper')
export const JOURNAL_HELPER = t('journalHelper')
export const JOURNAL_PANEL_HELPER = t('journalPanelHelper')
export const JOURNAL_TAB_SUBTITLE = t('journalTabSubtitle')

export const ARCHIVED_TASKS = (count: number) =>
  count === 1 ? t('archivedTasksOne') : t('archivedTasksMany', { count })

export const END_FLASHCARD_SESSION = t('endFlashcardSession')
export const END_FLASHCARD_SESSION_BODY = t('endFlashcardSessionBody')

export const HOTKEY_HINT = t('hotkeyHint')
