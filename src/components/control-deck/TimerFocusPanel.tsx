import { useMemo } from 'react'
import { MAX_STUDY_BLOCK_MINUTES } from '../../lib/shared/timerConstants'
import { getPomodoroPresets } from '../../lib/settings/settingsSections'
import { markDailyGoalConfigured } from '../../lib/study/setupChecklist'
import { useTranslation } from '../../i18n/useTranslation'
import { useSettingsPanel } from '../../context/settingsPanelContext'
import { SettingsCard } from '../shared/settings/SettingsCard'
import { RangeSetting } from '../shared/settings/RangeSetting'
import { ToggleSetting } from '../shared/settings/ToggleSetting'
import { SettingsPresetChips } from '../shared/settings/SettingsPresetChips'

export function TimerFocusPanel() {
  const { t } = useTranslation()
  const pomodoroPresets = getPomodoroPresets()
  const {
    dailyGoalMinutes,
    studyBlockDurationMinutes,
    shortBreakDurationMinutes,
    longBreakDurationMinutes,
    targetSessionsPerCycle,
    recentHistoryLimit,
    historyRetentionDays,
    focusNotificationsEnabled,
    studyReminderEnabled,
    studyReminderTime,
    studyReminderOnlyBelowGoal,
    updateSetting,
  } = useSettingsPanel()

  const notificationPermission =
    typeof Notification !== 'undefined' ? Notification.permission : 'default'

  const summary = useMemo(
    () => t('timerFocusSummary', {
      focus: studyBlockDurationMinutes,
      shortBreak: shortBreakDurationMinutes,
      longBreak: longBreakDurationMinutes,
      sessions: targetSessionsPerCycle,
    }),
    [t, studyBlockDurationMinutes, shortBreakDurationMinutes, longBreakDurationMinutes, targetSessionsPerCycle],
  )

  const handleNotificationsToggle = async (enabled: boolean) => {
    if (enabled && typeof Notification !== 'undefined' && Notification.permission === 'default') {
      const permission = await Notification.requestPermission()
      if (permission !== 'granted') return
    }
    updateSetting('focusNotificationsEnabled', enabled)
  }

  const applyPomodoroPreset = (preset: ReturnType<typeof getPomodoroPresets>[number]) => {
    Object.entries(preset.values).forEach(([key, val]) => {
      updateSetting(key as keyof typeof preset.values, val)
    })
  }

  const fields = [
    { key: 'dailyGoalMinutes' as const, label: t('timerFocusDailyGoalMinutes'), value: dailyGoalMinutes, min: 30, max: 960, step: 30, chips: [60, 120, 240, 480] },
    { key: 'studyBlockDurationMinutes' as const, label: t('timerFocusStudyBlockMinutes'), value: studyBlockDurationMinutes, min: 5, max: MAX_STUDY_BLOCK_MINUTES, step: 5, chips: [15, 25, 45, 60] },
    { key: 'shortBreakDurationMinutes' as const, label: t('timerFocusShortBreakMinutes'), value: shortBreakDurationMinutes, min: 1, max: 30, step: 1, chips: [3, 5, 10, 15] },
    { key: 'longBreakDurationMinutes' as const, label: t('timerFocusLongBreakMinutes'), value: longBreakDurationMinutes, min: 5, max: 60, step: 5, chips: [10, 15, 20, 30] },
    { key: 'targetSessionsPerCycle' as const, label: t('sessionsBeforeLongBreak'), value: targetSessionsPerCycle, min: 1, max: 10, step: 1, chips: [2, 4, 6, 8] },
    { key: 'recentHistoryLimit' as const, label: t('timerFocusRecentHistoryWindow'), value: recentHistoryLimit, min: 50, max: 500, step: 25, chips: undefined },
    { key: 'historyRetentionDays' as const, label: t('timerFocusHistoryRetentionDays'), value: historyRetentionDays, min: 0, max: 365, step: 30, chips: [0, 90, 180, 365] },
  ]

  return (
    <SettingsCard id="settings-timer-focus" title={t('timerFocusPanelTitle')} description={summary}>
      <div className="space-y-5">
        <div>
          <span className="settings-label block mb-2">{t('timerFocusPomodoroPresets')}</span>
          <p className="settings-muted mb-2">{t('timerFocusPomodoroPresetsHelper')}</p>
          <div className="flex flex-wrap gap-1.5">
            {pomodoroPresets.map(preset => (
              <button
                key={preset.id}
                type="button"
                title={preset.title}
                onClick={() => applyPomodoroPreset(preset)}
                className="rounded-full px-3 py-1.5 text-micro font-semibold border bg-[color-mix(in_srgb,var(--color-surface-card)_60%,transparent)] border-[var(--color-border-card)] settings-muted hover:border-accent-blue/40 hover:text-accent-blue transition-all ios-active-scale"
              >
                {preset.label}
              </button>
            ))}
          </div>
        </div>

        <ToggleSetting
          label={t('timerFocusBlockNotifications')}
          description={t('timerFocusBlockNotificationsDesc')}
          checked={focusNotificationsEnabled}
          onChange={v => void handleNotificationsToggle(v)}
        />
        {notificationPermission === 'denied' && (
          <p className="settings-muted text-micro rounded-lg border border-amber-500/25 bg-amber-500/10 px-3 py-2">
            {t('timerFocusNotificationsBlocked')}
          </p>
        )}

        <ToggleSetting
          label={t('timerFocusDailyReminder')}
          description={t('timerFocusDailyReminderDesc')}
          checked={studyReminderEnabled}
          onChange={v => updateSetting('studyReminderEnabled', v)}
        />
        {studyReminderEnabled && (
          <div className="space-y-3 pl-1">
            <label className="block">
              <span className="settings-label block mb-1">{t('timerFocusReminderTime')}</span>
              <input
                type="time"
                value={studyReminderTime}
                onChange={e => updateSetting('studyReminderTime', e.target.value)}
                className="rounded-lg border border-card surface-subtle px-3 py-2 text-xs text-primary"
              />
            </label>
            <ToggleSetting
              label={t('timerFocusOnlyBelowGoal')}
              checked={studyReminderOnlyBelowGoal}
              onChange={v => updateSetting('studyReminderOnlyBelowGoal', v)}
            />
          </div>
        )}

        {fields.map(item => (
          <div key={item.key} className="space-y-2">
            {item.chips && (
              <SettingsPresetChips
                presets={item.chips.map(v => ({ value: v }))}
                activeValue={item.value}
                onSelect={v => {
                  if (item.key === 'dailyGoalMinutes') markDailyGoalConfigured()
                  updateSetting(item.key, v)
                }}
                unit={item.key === 'targetSessionsPerCycle' ? '' : 'm'}
              />
            )}
            <RangeSetting
              label={item.label}
              value={item.value}
              min={item.min}
              max={item.max}
              step={item.step}
              onChange={v => {
                if (item.key === 'dailyGoalMinutes') markDailyGoalConfigured()
                updateSetting(item.key, v)
              }}
            />
          </div>
        ))}
      </div>
    </SettingsCard>
  )
}
