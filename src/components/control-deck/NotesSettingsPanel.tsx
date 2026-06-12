import { useConfirm } from '../../context/useConfirm'
import { STUDY_NOTES_RESET_KEYS } from '../../lib/settingsSections'
import { useSettingsPanel } from './SettingsPanelContext'
import { SettingsCard } from '../shared/settings/SettingsCard'

export function NotesSettingsPanel() {
  const { noteTagColors, updateSetting, resetKeys } = useSettingsPanel()
  const { requestConfirm } = useConfirm()

  const handleColorChange = (index: number, color: string) => {
    const next = [...noteTagColors]
    next[index] = color
    updateSetting('noteTagColors', JSON.stringify(next))
  }

  const handleReset = async () => {
    const ok = await requestConfirm({
      title: 'Reset note tag colors?',
      message: 'Restores the default palette for Quick Notes tags.',
      confirmLabel: 'Reset',
    })
    if (!ok) return
    void resetKeys(STUDY_NOTES_RESET_KEYS, 'Note tag colors restored')
  }

  return (
    <SettingsCard id="settings-notes" title="Notes" defaultCollapsed onResetDefaults={() => void handleReset()}>
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
