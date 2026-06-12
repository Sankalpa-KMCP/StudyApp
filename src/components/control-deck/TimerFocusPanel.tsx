import { useMemo } from 'react'
import { MAX_STUDY_BLOCK_MINUTES } from '../../lib/timerConstants'
import { POMODORO_PRESETS } from '../../lib/settingsSections'
import { markDailyGoalConfigured } from '../../lib/setupChecklist'
import { useSettingsPanel } from './SettingsPanelContext'
import { SettingsCard } from '../shared/settings/SettingsCard'
import { RangeSetting } from '../shared/settings/RangeSetting'
import { ToggleSetting } from '../shared/settings/ToggleSetting'
import { SettingsPresetChips } from '../shared/settings/SettingsPresetChips'

export function TimerFocusPanel() {
  const {
    dailyGoalMinutes,
    studyBlockDurationMinutes,
    shortBreakDurationMinutes,
    longBreakDurationMinutes,
    targetSessionsPerCycle,
    recentHistoryLimit,
    historyRetentionDays,
    focusNotificationsEnabled,
    updateSetting,
  } = useSettingsPanel()

  const notificationPermission =
    typeof Notification !== 'undefined' ? Notification.permission : 'default'

  const summary = useMemo(
    () =>
      `${studyBlockDurationMinutes}m focus · ${shortBreakDurationMinutes}m break · ${longBreakDurationMinutes}m long · every ${targetSessionsPerCycle} sessions`,
    [studyBlockDurationMinutes, shortBreakDurationMinutes, longBreakDurationMinutes, targetSessionsPerCycle],
  )

  const handleNotificationsToggle = async (enabled: boolean) => {
    if (enabled && typeof Notification !== 'undefined' && Notification.permission === 'default') {
      const permission = await Notification.requestPermission()
      if (permission !== 'granted') return
    }
    updateSetting('focusNotificationsEnabled', enabled)
  }

  const applyPomodoroPreset = (preset: (typeof POMODORO_PRESETS)[number]) => {
    Object.entries(preset.values).forEach(([key, val]) => {
      updateSetting(key as keyof typeof preset.values, val)
    })
  }

  const fields = [
    { key: 'dailyGoalMinutes' as const, label: 'Daily goal (minutes)', value: dailyGoalMinutes, min: 30, max: 960, step: 30, chips: [60, 120, 240, 480] },
    { key: 'studyBlockDurationMinutes' as const, label: 'Study block (minutes)', value: studyBlockDurationMinutes, min: 5, max: MAX_STUDY_BLOCK_MINUTES, step: 5, chips: [15, 25, 45, 60] },
    { key: 'shortBreakDurationMinutes' as const, label: 'Short break (minutes)', value: shortBreakDurationMinutes, min: 1, max: 30, step: 1, chips: [3, 5, 10, 15] },
    { key: 'longBreakDurationMinutes' as const, label: 'Long break (minutes)', value: longBreakDurationMinutes, min: 5, max: 60, step: 5, chips: [10, 15, 20, 30] },
    { key: 'targetSessionsPerCycle' as const, label: 'Sessions before long break', value: targetSessionsPerCycle, min: 1, max: 10, step: 1, chips: [2, 4, 6, 8] },
    { key: 'recentHistoryLimit' as const, label: 'Recent history window', value: recentHistoryLimit, min: 50, max: 500, step: 25, chips: undefined },
    { key: 'historyRetentionDays' as const, label: 'History retention (days, 0 = keep all)', value: historyRetentionDays, min: 0, max: 365, step: 30, chips: [0, 90, 180, 365] },
  ]

  return (
    <SettingsCard id="settings-timer-focus" title="Timer & Focus" description={summary}>
      <div className="space-y-5">
        <div>
          <span className="settings-label block mb-2">Pomodoro presets</span>
          <p className="settings-muted mb-2">Updates stored durations only — does not interrupt an active timer.</p>
          <div className="flex flex-wrap gap-1.5">
            {POMODORO_PRESETS.map(preset => (
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
          label="Focus block notifications"
          description="Browser reminder when a study block completes"
          checked={focusNotificationsEnabled}
          onChange={v => void handleNotificationsToggle(v)}
        />
        {notificationPermission === 'denied' && (
          <p className="settings-muted text-micro rounded-lg border border-amber-500/25 bg-amber-500/10 px-3 py-2">
            Notifications are blocked in your browser. Enable them in site settings to use focus reminders.
          </p>
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
