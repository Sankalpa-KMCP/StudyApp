import {
  focusModeOff,
  focusModeOn,
  shortcutsPanelClosed,
  shortcutsPanelOpened,
  sidebarToggled,
  studyBlockSaved,
  switchedToBreak,
  switchedToStudy,
  timerPaused,
  timerRunning,
} from './uxTerms'

export const SHORTCUT_TOASTS = {
  space: { running: timerRunning, paused: timerPaused },
  study: switchedToStudy,
  break: switchedToBreak,
  complete: studyBlockSaved,
  focusMode: { on: focusModeOn, off: focusModeOff },
  shortcutsPanel: { open: shortcutsPanelOpened, close: shortcutsPanelClosed },
  sidebar: sidebarToggled,
} as const
