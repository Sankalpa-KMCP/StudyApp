import type { SettingsKey, SettingsValue } from '../../db/types'
import { SettingsCard } from '../shared/settings/SettingsCard'

interface NotesSettingsPanelProps {
  noteTagColors: string[]
  updateSetting: (key: SettingsKey, val: SettingsValue) => void
}

export function NotesSettingsPanel({ noteTagColors, updateSetting }: NotesSettingsPanelProps) {
  const handleColorChange = (index: number, color: string) => {
    const next = [...noteTagColors]
    next[index] = color
    updateSetting('noteTagColors', JSON.stringify(next))
  }

  return (
    <SettingsCard title="Notes">
      <p className="settings-muted mb-3">Customize Quick Notes tag colors (up to 8).</p>
      <div className="flex flex-wrap gap-3">
        {noteTagColors.map((color, index) => (
          <div key={index} className="flex flex-col items-center gap-1">
            <input
              type="color"
              value={color}
              onChange={e => handleColorChange(index, e.target.value)}
              className="h-8 w-8 rounded-lg border border-[var(--color-border-card)] bg-transparent cursor-pointer"
              aria-label={`Note tag color ${index + 1}`}
            />
            <span className="settings-muted font-mono">{index + 1}</span>
          </div>
        ))}
      </div>
    </SettingsCard>
  )
}
