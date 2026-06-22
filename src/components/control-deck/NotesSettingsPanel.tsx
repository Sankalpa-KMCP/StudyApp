import { useConfirm } from '../../context/useConfirm'
import { STUDY_NOTES_RESET_KEYS } from '../../lib/settings/settingsSections'
import { useTranslation } from '../../i18n/useTranslation'
import { useSettingsPanel } from '../../context/settingsPanelContext'
import { SettingsCard } from '../shared/settings/SettingsCard'

export function NotesSettingsPanel() {
  const { t } = useTranslation()
  const { noteTagColors, updateSetting, resetKeys } = useSettingsPanel()
  const { requestConfirm } = useConfirm()

  const handleColorChange = (index: number, color: string) => {
    const next = [...noteTagColors]
    next[index] = color
    updateSetting('noteTagColors', JSON.stringify(next))
  }

  const handleReset = async () => {
    const ok = await requestConfirm({
      title: t('notesResetConfirmTitle'),
      message: t('notesResetConfirmMessage'),
      confirmLabel: t('notesResetConfirmLabel'),
    })
    if (!ok) return
    void resetKeys(STUDY_NOTES_RESET_KEYS, t('notesTagColorsRestored'))
  }

  return (
    <SettingsCard id="settings-notes" title={t('notesPanelTitle')} defaultCollapsed onResetDefaults={() => void handleReset()}>
      <p className="settings-muted mb-3">{t('notesPanelDescription')}</p>
      <div className="flex flex-wrap gap-3">
        {noteTagColors.map((color, index) => (
          <div key={index} className="flex flex-col items-center gap-1">
            <input
              type="color"
              value={color}
              onChange={e => handleColorChange(index, e.target.value)}
              className="h-8 w-8 rounded-lg border border-[var(--color-border-card)] bg-transparent cursor-pointer"
              aria-label={t('notesTagColorAria', { index: index + 1 })}
            />
            <span className="settings-muted font-mono">{index + 1}</span>
          </div>
        ))}
      </div>
    </SettingsCard>
  )
}
