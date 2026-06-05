import type { SettingsKey, SettingsValue } from '../../db/types'
import { SettingsCard } from '../shared/settings/SettingsCard'
import { ToggleSetting } from '../shared/settings/ToggleSetting'

const FONT_OPTIONS = ['JetBrains Mono', 'Fira Code', 'SF Mono', 'Outfit', 'Inter'] as const

interface SoundFeedbackPanelProps {
  soundEnabled: boolean
  tactileEnabled: boolean
  developerFont: string
  updateSetting: (key: SettingsKey, val: SettingsValue) => void
}

export function SoundFeedbackPanel({ soundEnabled, tactileEnabled, developerFont, updateSetting }: SoundFeedbackPanelProps) {
  return (
    <SettingsCard title="Sound & Feedback">
      <div className="space-y-3">
        <ToggleSetting label="Session chimes" checked={soundEnabled} onChange={v => updateSetting('soundEnabled', v)} />
        <ToggleSetting label="Tactile click feedback" checked={tactileEnabled} onChange={v => updateSetting('tactile_feedback', v)} />
        <div>
          <span className="text-xs font-semibold text-white/80 block mb-2">Monospace font</span>
          <select
            value={developerFont}
            onChange={e => updateSetting('developer_font', e.target.value)}
            className="w-full rounded-full border border-white/10 bg-white/5 px-4 py-2.5 text-xs text-white outline-none cursor-pointer"
          >
            {FONT_OPTIONS.map(f => (
              <option key={f} value={f} className="bg-[#11131e] text-white">{f}</option>
            ))}
          </select>
        </div>
      </div>
    </SettingsCard>
  )
}
