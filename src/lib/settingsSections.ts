import type { ComponentType } from 'react'
import { Sliders, Clock, BookOpen, Database } from 'lucide-react'
import type { SettingsKey, SettingsValue } from '../db/types'
import { SETTINGS_DEFAULTS } from '../db/selectors/settingsFromRows'

export type SettingsSectionId = 'appearance' | 'focus' | 'study' | 'data'

export interface SettingsSection {
  id: SettingsSectionId
  label: string
  icon: ComponentType<{ className?: string; 'aria-hidden'?: boolean }>
  panelIds: string[]
}

export const SETTINGS_SECTIONS: SettingsSection[] = [
  {
    id: 'appearance',
    label: 'Appearance',
    icon: Sliders,
    panelIds: ['settings-aesthetics', 'settings-getting-started'],
  },
  {
    id: 'focus',
    label: 'Focus',
    icon: Clock,
    panelIds: ['settings-timer-focus', 'settings-sound-feedback', 'settings-zen-lockout'],
  },
  {
    id: 'study',
    label: 'Study',
    icon: BookOpen,
    panelIds: ['settings-flashcards', 'settings-notes', 'settings-algorithm', 'settings-categories'],
  },
  {
    id: 'data',
    label: 'Data',
    icon: Database,
    panelIds: ['settings-backup-vault'],
  },
]

export { SETTINGS_DEFAULTS }

export const APPEARANCE_ADVANCED_KEYS: SettingsKey[] = [
  'cardOpacity',
  'backdropBlur',
  'backdropSaturate',
  'cardBorderOpacity',
  'accentBlueOverride',
  'accentPurpleOverride',
  'accentGreenOverride',
  'accentAmberOverride',
]

export const SECTION_DEFAULT_KEYS: Record<SettingsSectionId, SettingsKey[]> = {
  appearance: [...APPEARANCE_ADVANCED_KEYS],
  focus: [
    'dailyGoalMinutes',
    'studyBlockDurationMinutes',
    'shortBreakDurationMinutes',
    'longBreakDurationMinutes',
    'targetSessionsPerCycle',
    'recentHistoryLimit',
    'historyRetentionDays',
    'focusNotificationsEnabled',
    'soundEnabled',
    'tactile_feedback',
    'developer_font',
    'ambientSoundEnabled',
    'ambientSoundPreset',
    'ambientVolume',
    'enforce_lockout',
    'autoArchiveAncientTasks',
  ],
  study: ['flashcardsEnabled', 'initialEasinessFactor', 'noteTagColors', 'autoArchiveAncientTasks'],
  data: [
    'historyRetentionDays',
    'autoExportEnabled',
    'autoExportIntervalDays',
    'desktopAutostartEnabled',
    'desktopGlobalShortcutsEnabled',
    'desktopNativeNotificationsEnabled',
    'desktopBackupFolderPath',
  ],
}

export const STUDY_NOTES_RESET_KEYS: SettingsKey[] = ['noteTagColors']
export const STUDY_ALGORITHM_RESET_KEYS: SettingsKey[] = ['initialEasinessFactor']
export const STUDY_FLASHCARDS_RESET_KEYS: SettingsKey[] = ['flashcardsEnabled']

export const POMODORO_PRESETS = [
  {
    id: 'classic',
    label: 'Classic',
    title: '25m focus · 5m break · 15m long · 4 sessions',
    values: {
      studyBlockDurationMinutes: 25,
      shortBreakDurationMinutes: 5,
      longBreakDurationMinutes: 15,
      targetSessionsPerCycle: 4,
    },
  },
  {
    id: 'deep',
    label: 'Deep',
    title: '45m focus · 10m break · 20m long · 4 sessions',
    values: {
      studyBlockDurationMinutes: 45,
      shortBreakDurationMinutes: 10,
      longBreakDurationMinutes: 20,
      targetSessionsPerCycle: 4,
    },
  },
  {
    id: 'sprint',
    label: 'Sprint',
    title: '15m focus · 3m break · 10m long · 6 sessions',
    values: {
      studyBlockDurationMinutes: 15,
      shortBreakDurationMinutes: 3,
      longBreakDurationMinutes: 10,
      targetSessionsPerCycle: 6,
    },
  },
] as const

export function getDefaultForKey(key: SettingsKey): SettingsValue {
  const defaults = SETTINGS_DEFAULTS as unknown as Record<SettingsKey, SettingsValue | string[]>
  const value = defaults[key]
  if (key === 'noteTagColors' && Array.isArray(value)) {
    return JSON.stringify(value)
  }
  return value as SettingsValue
}

export function scrollToSettingsSection(id: string) {
  if (typeof document !== 'undefined') {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }
}

