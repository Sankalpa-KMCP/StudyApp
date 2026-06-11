import {
  FOCUS_MODE_OFF,
  FOCUS_MODE_ON,
  STUDY_BLOCK_SAVED,
  SWITCHED_TO_BREAK,
  SWITCHED_TO_STUDY,
  TIMER_PAUSED,
  TIMER_RUNNING,
} from './uxTerms'

export const SHORTCUT_TOASTS = {
  space: { running: TIMER_RUNNING, paused: TIMER_PAUSED },
  study: SWITCHED_TO_STUDY,
  break: SWITCHED_TO_BREAK,
  complete: STUDY_BLOCK_SAVED,
  focusMode: { on: FOCUS_MODE_ON, off: FOCUS_MODE_OFF },
  shortcutsPanel: { open: 'Shortcuts panel opened', close: 'Shortcuts panel closed' },
  sidebar: 'Sidebar toggled',
} as const
