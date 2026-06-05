import type { SettingsKey, SettingsValue } from '../../db/types'
import { SettingsCard } from '../shared/settings/SettingsCard'
import { RangeSetting } from '../shared/settings/RangeSetting'

interface TimerFocusPanelProps {
  dailyGoalMinutes: number
  studyBlockDurationMinutes: number
  shortBreakDurationMinutes: number
  longBreakDurationMinutes: number
  targetSessionsPerCycle: number
  updateSetting: (key: SettingsKey, val: SettingsValue) => void
}

export function TimerFocusPanel({
  dailyGoalMinutes,
  studyBlockDurationMinutes,
  shortBreakDurationMinutes,
  longBreakDurationMinutes,
  targetSessionsPerCycle,
  updateSetting,
}: TimerFocusPanelProps) {
  const fields = [
    { key: 'dailyGoalMinutes' as const, label: 'Daily goal (minutes)', value: dailyGoalMinutes, min: 30, max: 960, step: 30 },
    { key: 'studyBlockDurationMinutes' as const, label: 'Study block (minutes)', value: studyBlockDurationMinutes, min: 5, max: 120, step: 5 },
    { key: 'shortBreakDurationMinutes' as const, label: 'Short break (minutes)', value: shortBreakDurationMinutes, min: 1, max: 30, step: 1 },
    { key: 'longBreakDurationMinutes' as const, label: 'Long break (minutes)', value: longBreakDurationMinutes, min: 5, max: 60, step: 5 },
    { key: 'targetSessionsPerCycle' as const, label: 'Sessions before long break', value: targetSessionsPerCycle, min: 1, max: 10, step: 1 },
  ]

  return (
    <SettingsCard title="Timer & Focus">
      <div className="space-y-4">
        {fields.map(item => (
          <RangeSetting
            key={item.key}
            label={item.label}
            value={item.value}
            min={item.min}
            max={item.max}
            step={item.step}
            onChange={v => updateSetting(item.key, v)}
          />
        ))}
      </div>
    </SettingsCard>
  )
}
