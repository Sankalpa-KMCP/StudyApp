import type { SettingsKey, SettingsValue } from '../../db/types'
import { SettingsCard } from '../shared/settings/SettingsCard'
import { RangeSetting } from '../shared/settings/RangeSetting'

interface AestheticsPanelProps {
  theme: string
  cardOpacity: number
  backdropBlur: number
  updateSetting: (key: SettingsKey, val: SettingsValue) => void
}

export function AestheticsPanel({ theme, cardOpacity, backdropBlur, updateSetting }: AestheticsPanelProps) {
  return (
    <SettingsCard title="Aesthetics & Translucency">
      <div className="space-y-6">
        <div>
          <div className="flex justify-between items-center mb-2">
            <span className="text-xs font-semibold text-white/80">Active Theme Preset</span>
          </div>
          <select
            value={theme}
            onChange={e => updateSetting('theme', e.target.value)}
            className="w-full rounded-full border border-white/10 bg-white/5 px-4 py-2.5 text-xs text-white outline-none cursor-pointer hover:bg-white/10 transition-colors font-semibold"
          >
            <option value="midnight-slate" className="bg-[#11131e] text-white">Midnight Slate (Default)</option>
            <option value="midnight-oled" className="bg-[#11131e] text-white">Midnight OLED</option>
            <option value="nordic-frost" className="bg-[#11131e] text-white">Nordic Frost</option>
            <option value="amber-retro" className="bg-[#11131e] text-white">Amber Retro</option>
            <option value="nebula-purple" className="bg-[#11131e] text-white">Nebula Purple</option>
          </select>
        </div>
        <RangeSetting
          label="Card Backdrop Opacity"
          value={Math.round(cardOpacity * 100)}
          min={20}
          max={90}
          step={5}
          unit="%"
          onChange={v => updateSetting('cardOpacity', v / 100)}
        />
        <RangeSetting
          label="Frosting blur size"
          value={backdropBlur}
          min={4}
          max={24}
          step={1}
          unit="px"
          onChange={v => updateSetting('backdropBlur', v)}
        />
      </div>
    </SettingsCard>
  )
}
