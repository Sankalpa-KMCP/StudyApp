import { Button } from '../../shared/Button'
import { useTranslation } from '../../../i18n/useTranslation'

interface StorageRecoveryBannerProps {
  exportStudyBackup: (options?: { destination: 'download' }) => void
  clearSnapshots: () => void
  resetDataSelective: (options: { tasks: boolean; history: boolean; categories: boolean; notes: boolean }) => void
  requestConfirm: (options: {
    title: string
    message: string
    confirmLabel?: string
    danger?: boolean
  }) => Promise<boolean>
}

export function StorageRecoveryBanner({
  exportStudyBackup,
  clearSnapshots,
  resetDataSelective,
  requestConfirm,
}: StorageRecoveryBannerProps) {
  const { t } = useTranslation()

  return (
    <div className="mb-5 rounded-2xl border border-amber-500/25 bg-amber-500/10 p-4 space-y-3">
      <p className="text-xs font-bold status-banner-warning uppercase tracking-wider">{t('backupVaultStorageRecovery')}</p>
      <p className="text-[11px] status-banner-warning-body leading-relaxed">
        {t('backupVaultStorageRecoveryBody')}
      </p>
      <ol className="space-y-2 text-[11px] settings-muted list-decimal list-inside">
        <li>{t('backupVaultStorageRecoveryStep1')}</li>
        <li>{t('backupVaultStorageRecoveryStep2')}</li>
        <li>{t('backupVaultStorageRecoveryStep3')}</li>
      </ol>
      <div className="flex flex-wrap gap-2 pt-1">
        <Button variant="primary" size="sm" onClick={() => exportStudyBackup({ destination: 'download' })}>
          {t('backupVaultStorageRecoveryExport')}
        </Button>
        <Button variant="secondary" size="sm" onClick={clearSnapshots}>
          {t('backupVaultStorageRecoveryClearSnapshots')}
        </Button>
        <Button
          variant="danger"
          size="sm"
          onClick={async () => {
            const ok = await requestConfirm({
              title: t('backupVaultSweepLogsConfirmTitle'),
              message: t('backupVaultSweepLogsConfirmMessage'),
              confirmLabel: t('backupVaultSweepLogsConfirmLabel'),
              danger: true,
            })
            if (!ok) return
            resetDataSelective({ tasks: false, history: true, categories: false, notes: false })
          }}
        >
          {t('backupVaultStorageRecoverySweepLogs')}
        </Button>
      </div>
    </div>
  )
}
