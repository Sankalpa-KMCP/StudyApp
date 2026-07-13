import { Button } from '../../shared/Button'
import { useTranslation } from '../../../i18n/useTranslation'
import type { StudyBackupExportOptions } from '../../../hooks/backup/types'

interface EncryptedExportSectionProps {
  encryptPassphrase: string
  setEncryptPassphrase: (v: string) => void
  exportStudyBackup: (options?: StudyBackupExportOptions) => void
  shareStudyBackupVault?: () => void
  canShareBackup: boolean
  isExporting: boolean
}

export function EncryptedExportSection({
  encryptPassphrase,
  setEncryptPassphrase,
  exportStudyBackup,
  shareStudyBackupVault,
  canShareBackup,
  isExporting,
}: EncryptedExportSectionProps) {
  const { t } = useTranslation()

  return (
    <div className="rounded-2xl border border-[var(--color-border-card)] bg-[color-mix(in_srgb,var(--color-surface-card)_40%,transparent)] p-4">
      <span className="settings-label block mb-2">{t('backupVaultEncryptedExport')}</span>
      <label className="flex items-center gap-2 text-xs settings-muted">
        <input
          type="checkbox"
          checked={!!encryptPassphrase}
          onChange={e => setEncryptPassphrase(e.target.checked ? ' ' : '')}
        />
        {t('backupVaultEncryptPassphrase')}
      </label>
      {encryptPassphrase !== '' && (
        <input
          type="password"
          value={encryptPassphrase.trim()}
          onChange={e => setEncryptPassphrase(e.target.value)}
          placeholder={t('backupVaultPassphrasePlaceholder')}
          className="mt-2 w-full rounded-lg border border-card surface-subtle px-3 py-2 text-xs text-primary"
        />
      )}
      <Button
        variant="secondary"
        onClick={() => exportStudyBackup({
          destination: 'download',
          encrypt: encryptPassphrase.trim().length > 0,
          passphrase: encryptPassphrase.trim() || undefined,
        })}
        disabled={isExporting}
        className="w-full mt-3"
      >
        {t('backupVaultExportEncrypted')}
      </Button>
      {canShareBackup && shareStudyBackupVault && (
        <Button variant="secondary" onClick={shareStudyBackupVault} disabled={isExporting} className="w-full mt-2">
          {t('backupVaultShareBackup')}
        </Button>
      )}
    </div>
  )
}
