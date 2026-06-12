import { useConfirm } from '../context/useConfirm'
import { deleteAndReopen, getSchemaVersion } from '../db/repositories/database'
import { exportStudyBackupFile } from '../lib/backup/backupExport'
import { setLastBackupExportAt } from '../lib/backup/backupMetadata'
import { copyDebugInfo } from '../lib/shared/copyDebugInfo'
import { useTranslation } from '../i18n/useTranslation'
import { Button } from './shared/Button'

interface ErrorFallbackProps {
  message: string
  stack?: string
  contextLabel?: string
  onRetry: () => void
  onReload: () => void
}

export function ErrorFallback({ message, stack, contextLabel, onRetry, onReload }: ErrorFallbackProps) {
  const { requestConfirm } = useConfirm()
  const { t } = useTranslation()

  const handleCopyDebug = async () => {
    const debugInfo = [
      `message: ${message}`,
      `stack: ${stack ?? 'n/a'}`,
      `userAgent: ${navigator.userAgent}`,
      `dbSchemaVersion: ${getSchemaVersion()}`,
      `timestamp: ${new Date().toISOString()}`,
    ].join('\n')
    await copyDebugInfo(debugInfo)
  }

  const handleExportData = async () => {
    try {
      await exportStudyBackupFile('study-emergency-export')
      setLastBackupExportAt()
    } catch (err) {
      console.error('Emergency export failed:', err)
    }
  }

  const handleResetDatabase = async () => {
    const ok = await requestConfirm({
      title: 'Reset database?',
      message: 'Export a backup first if you need your data.',
      confirmLabel: 'Reset',
      danger: true,
    })
    if (!ok) return
    try {
      await deleteAndReopen()
      window.location.reload()
    } catch (err) {
      console.error('Database reset failed:', err)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-[var(--body-base)] p-6">
      <div className="max-w-md rounded-2xl border border-[var(--color-border-card)] bg-[color-mix(in_srgb,var(--color-surface-card)_80%,transparent)] p-8 text-center backdrop-blur-xl">
        <h1 className="text-lg font-bold text-[var(--color-text-primary)] mb-2">
          {contextLabel ? t('errorTabCrashed', { label: contextLabel }) : t('errorSomethingWrong')}
        </h1>
        <p className="text-sm text-[var(--color-text-secondary)] font-mono mb-6">{message}</p>
        <div className="flex flex-wrap gap-3 justify-center">
          <Button variant="secondary" size="sm" onClick={onRetry}>
            {t('errorTryAgain')}
          </Button>
          <Button variant="secondary" size="sm" onClick={handleCopyDebug}>
            {t('errorCopyDebug')}
          </Button>
          <Button variant="secondary" size="sm" onClick={handleExportData}>
            {t('errorExportData')}
          </Button>
          <Button variant="danger" size="sm" onClick={handleResetDatabase}>
            {t('errorResetDatabase')}
          </Button>
          <Button variant="primary" size="sm" onClick={onReload}>
            {t('errorReloadApp')}
          </Button>
        </div>
      </div>
    </div>
  )
}
