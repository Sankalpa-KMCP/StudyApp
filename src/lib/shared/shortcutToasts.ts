import { t } from '../../i18n'

export const SHORTCUT_TOASTS = {
  space: {
    running: () => t('timerRunning'),
    paused: () => t('timerPaused'),
  },
  study: () => t('switchedToStudy'),
  break: () => t('switchedToBreak'),
  complete: () => t('studyBlockSaved'),
  focusMode: {
    on: () => t('focusModeOn'),
    off: () => t('focusModeOff'),
  },
  shortcutsPanel: {
    open: () => t('shortcutsPanelOpened'),
    close: () => t('shortcutsPanelClosed'),
  },
  sidebar: () => t('sidebarToggled'),
} as const
