import type { ComponentType } from 'react'
import { Sliders, Clock, BookOpen, Database } from 'lucide-react'
import type { SettingsKey, SettingsValue } from '../../db/types'
import { SETTINGS_DEFAULTS } from './settingsDefaults'
import { enableAdvancedSettings } from './settingsAdvancedMode'
import { t } from '../../i18n'

export type SettingsSectionId = 'appearance' | 'focus' | 'study' | 'data'

export type SettingsPanelTier = 'essential' | 'advanced'

export const SETTINGS_PANEL_TIERS: Record<string, SettingsPanelTier> = {
  'settings-aesthetics': 'essential',
  'settings-getting-started': 'essential',
  'settings-timer-focus': 'essential',
  'settings-sound-feedback': 'essential',
  'settings-zen-lockout': 'advanced',
  'settings-notes': 'advanced',
  'settings-algorithm': 'advanced',
  'settings-categories': 'advanced',
  'settings-backup-vault': 'essential',
  'settings-desktop': 'advanced',
}

export function isAdvancedPanel(panelId: string): boolean {
  return SETTINGS_PANEL_TIERS[panelId] === 'advanced'
}

export interface SettingsSection {
  id: SettingsSectionId
  label: string
  icon: ComponentType<{ className?: string; 'aria-hidden'?: boolean }>
  panelIds: string[]
}

export function getSettingsSections(): SettingsSection[] {
  return [
    {
      id: 'appearance',
      label: t('settingsSectionAppearance'),
      icon: Sliders,
      panelIds: ['settings-aesthetics', 'settings-getting-started'],
    },
    {
      id: 'focus',
      label: t('settingsSectionFocus'),
      icon: Clock,
      panelIds: ['settings-timer-focus', 'settings-sound-feedback', 'settings-zen-lockout'],
    },
    {
      id: 'study',
      label: t('settingsSectionStudy'),
      icon: BookOpen,
      panelIds: ['settings-notes', 'settings-algorithm', 'settings-categories'],
    },
    {
      id: 'data',
      label: t('settingsSectionData'),
      icon: Database,
      panelIds: ['settings-backup-vault', 'settings-desktop'],
    },
  ]
}

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
    'autoArchiveAfterDays',
  ],
  study: ['initialEasinessFactor', 'schedulingAlgorithm', 'noteTagColors', 'autoArchiveAncientTasks', 'autoArchiveAfterDays'],
  data: [
    'historyRetentionDays',
    'autoExportEnabled',
    'autoExportIntervalDays',
    'syncEnabled',
    'syncFolderPath',
    'lastSyncAt',
    'lastSyncChecksum',
    'desktopAutostartEnabled',
    'desktopGlobalShortcutsEnabled',
    'desktopNativeNotificationsEnabled',
  ],
}

export const STUDY_NOTES_RESET_KEYS: SettingsKey[] = ['noteTagColors']
export const STUDY_ALGORITHM_RESET_KEYS: SettingsKey[] = ['initialEasinessFactor', 'schedulingAlgorithm']

export function getPomodoroPresets() {
  return [
    {
      id: 'classic' as const,
      label: t('pomodoroPresetClassic'),
      title: t('pomodoroPresetClassicTitle'),
      values: {
        studyBlockDurationMinutes: 25,
        shortBreakDurationMinutes: 5,
        longBreakDurationMinutes: 15,
        targetSessionsPerCycle: 4,
      },
    },
    {
      id: 'deep' as const,
      label: t('pomodoroPresetDeep'),
      title: t('pomodoroPresetDeepTitle'),
      values: {
        studyBlockDurationMinutes: 45,
        shortBreakDurationMinutes: 10,
        longBreakDurationMinutes: 20,
        targetSessionsPerCycle: 4,
      },
    },
    {
      id: 'sprint' as const,
      label: t('pomodoroPresetSprint'),
      title: t('pomodoroPresetSprintTitle'),
      values: {
        studyBlockDurationMinutes: 15,
        shortBreakDurationMinutes: 3,
        longBreakDurationMinutes: 10,
        targetSessionsPerCycle: 6,
      },
    },
  ]
}

export function getDefaultForKey(key: SettingsKey): SettingsValue {
  const defaults = SETTINGS_DEFAULTS as unknown as Record<SettingsKey, SettingsValue | string[]>
  const value = defaults[key]
  if (key === 'noteTagColors' && Array.isArray(value)) {
    return JSON.stringify(value)
  }
  return value as SettingsValue
}

export const PENDING_SETTINGS_SCROLL_KEY = 'pending_settings_scroll'

export function queueSettingsPanelScroll(id: string): void {
  sessionStorage.setItem(PENDING_SETTINGS_SCROLL_KEY, id)
}

export function consumePendingSettingsPanelScroll(): string | null {
  const id = sessionStorage.getItem(PENDING_SETTINGS_SCROLL_KEY)
  if (id) sessionStorage.removeItem(PENDING_SETTINGS_SCROLL_KEY)
  return id
}

export function scrollToSettingsSectionWhenReady(
  id: string,
  onComplete?: (found: boolean) => void,
): void {
  if (typeof document === 'undefined') return

  if (isAdvancedPanel(id)) {
    enableAdvancedSettings()
  }

  queueSettingsPanelScroll(id)

  let attempts = 0
  const maxAttempts = 90

  const tryScroll = () => {
    const el = document.getElementById(id)
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' })
      sessionStorage.removeItem(PENDING_SETTINGS_SCROLL_KEY)
      onComplete?.(true)
      return
    }
    if (++attempts < maxAttempts) {
      requestAnimationFrame(tryScroll)
    } else {
      onComplete?.(false)
    }
  }

  tryScroll()
}

export function scrollToSettingsSection(id: string) {
  scrollToSettingsSectionWhenReady(id)
}

