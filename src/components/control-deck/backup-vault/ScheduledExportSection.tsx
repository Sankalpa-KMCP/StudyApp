import { ToggleSetting } from '../../shared/settings/ToggleSetting'
import { RangeSetting } from '../../shared/settings/RangeSetting'
import { useTranslation } from '../../../i18n/useTranslation'
import { scrollToSettingsSection } from '../../../lib/settings/settingsSections'
import { isTauri } from '../../../lib/desktop/tauri'

import type { SettingsKey, SettingsValue } from '../../../db/types'

interface ScheduledExportSectionProps {
  autoExportEnabled: boolean
  autoExportIntervalDays: number
  syncFolderPath: string
  updateSetting: (key: SettingsKey, value: SettingsValue) => void
}

export function ScheduledExportSection({
  autoExportEnabled,
  autoExportIntervalDays,
  syncFolderPath,
  updateSetting,
}: ScheduledExportSectionProps) {
  const { t } = useTranslation()

  return (
    <div className="rounded-2xl border border-[var(--color-border-card)] bg-[color-mix(in_srgb,var(--color-surface-card)_40%,transparent)] p-4 space-y-3">
      <p className="text-xs font-bold uppercase tracking-wider text-accent-blue">{t('backupVaultScheduledExport')}</p>
      <ToggleSetting
        label={t('backupVaultAutoExport')}
        description={
          isTauri() && syncFolderPath
            ? t('backupVaultAutoExportDescTauri')
            : t('backupVaultAutoExportDescWeb')
        }
        checked={autoExportEnabled}
        onChange={v => updateSetting('autoExportEnabled', v)}
      />
      {autoExportEnabled && (
        <RangeSetting
          label={t('backupVaultExportInterval')}
          value={autoExportIntervalDays}
          min={1}
          max={30}
          step={1}
          unit={t('commonDays')}
          onChange={v => updateSetting('autoExportIntervalDays', v)}
        />
      )}
      {isTauri() && syncFolderPath && (
        <p className="text-micro settings-muted">
          {t('backupVaultScheduledExportsSaveTo')}{' '}
          <span className="font-mono text-micro break-all">{syncFolderPath}</span>
          {' · '}
          <button
            type="button"
            className="text-accent-blue hover:text-accent-blue/80 font-semibold"
            onClick={() => scrollToSettingsSection('settings-backup-vault')}
          >
            {t('backupVaultChangeFolder')}
          </button>
        </p>
      )}
    </div>
  )
}
