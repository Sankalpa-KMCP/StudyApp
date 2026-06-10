import type { SettingsKey, SettingsValue } from '../../db/types'
import { SettingsCard } from '../shared/settings/SettingsCard'
import { RangeSetting } from '../shared/settings/RangeSetting'

interface AlgorithmPanelProps {
  initialEasinessFactor: number
  updateSetting: (key: SettingsKey, val: SettingsValue) => void
}

export function AlgorithmPanel({ initialEasinessFactor, updateSetting }: AlgorithmPanelProps) {
  return (
    <SettingsCard title="Algorithm Settings">
      <p className="text-[10px] text-white/40 leading-relaxed mb-4">
        Adjust default SM-2 memory parameters for initial recall intervals. Higher EF means cards stay easier longer after a good grade (e.g. 2.5 is typical).
      </p>
      <RangeSetting
        label="Initial Easiness Factor (EF)"
        value={initialEasinessFactor}
        min={1.3}
        max={3.5}
        step={0.1}
        onChange={v => updateSetting('initialEasinessFactor', v)}
      />
    </SettingsCard>
  )
}
