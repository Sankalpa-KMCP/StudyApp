import type { RefObject } from 'react'
import { Button } from '../../shared/Button'
import { useTranslation } from '../../../i18n/useTranslation'
import { isTauri } from '../../../lib/desktop/tauri'

interface BackupExportImportSectionProps {
  syncFolderPath: string
  lastExportNote: string
  isExporting: boolean
  exportProgress: number
  exportStudyBackup: (options?: { destination: 'download' }) => void
  isDragging: boolean
  setIsDragging: (v: boolean) => void
  handleFileDrop: (e: React.DragEvent) => void
  fileInputRef: RefObject<HTMLInputElement | null>
  importMode: 'replace' | 'merge'
  setImportMode: (mode: 'replace' | 'merge') => void
  importPassphrase: string
  setImportPassphrase: (v: string) => void
  prepareImportSession: () => void
}

export function BackupExportImportSection({
  syncFolderPath,
  lastExportNote,
  isExporting,
  exportProgress,
  exportStudyBackup,
  isDragging,
  setIsDragging,
  handleFileDrop,
  fileInputRef,
  importMode,
  setImportMode,
  importPassphrase,
  setImportPassphrase,
  prepareImportSession,
}: BackupExportImportSectionProps) {
  const { t } = useTranslation()

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-5">
      <div className="rounded-2xl border border-[var(--color-border-card)] bg-[color-mix(in_srgb,var(--color-surface-card)_40%,transparent)] p-4 flex flex-col justify-between">
        <div>
          <span className="text-micro font-bold uppercase tracking-wider text-accent-blue mb-2 block">{t('backupVaultStepExport')}</span>
          <span className="settings-label block">{t('backupVaultExportLabel')}</span>
          <span className="settings-muted mt-1 leading-normal font-semibold block">
            {isTauri() && syncFolderPath
              ? t('backupVaultExportDescTauri')
              : t('backupVaultExportDescWeb')}
          </span>
          <span className="text-micro settings-muted mt-2 block">{lastExportNote}</span>
        </div>
        <Button
          variant="primary"
          onClick={() => exportStudyBackup({ destination: 'download' })}
          disabled={isExporting}
          className="w-full mt-4"
        >
          {isExporting ? t('backupVaultExporting', { progress: exportProgress }) : t('backupVaultExportButton')}
        </Button>
        {isExporting && (
          <div className="mt-2 h-1.5 w-full rounded-full bg-[color-mix(in_srgb,var(--color-text-primary)_10%,transparent)] overflow-hidden" aria-hidden>
            <div className="h-full bg-accent-blue transition-all duration-300" style={{ width: `${exportProgress}%` }} />
          </div>
        )}
      </div>

      <div
        role="button"
        tabIndex={0}
        onDragOver={e => { e.preventDefault(); setIsDragging(true) }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleFileDrop}
        onClick={() => {
          prepareImportSession()
          fileInputRef.current?.click()
        }}
        onKeyDown={e => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            fileInputRef.current?.click()
          }
        }}
        aria-label={t('backupVaultImportAria')}
        className={`flex flex-col items-center justify-center border border-dashed rounded-2xl p-4 text-center transition-all cursor-pointer min-h-[120px] ${
          isDragging ? 'border-accent-purple bg-accent-purple/10' : 'border-[var(--color-border-card)] bg-[color-mix(in_srgb,var(--color-surface-card)_40%,transparent)] hover:border-[color-mix(in_srgb,var(--color-text-primary)_20%,transparent)]'
        }`}
      >
        <span className="text-micro font-bold uppercase tracking-wider text-accent-purple mb-2">{t('backupVaultStepImport')}</span>
        <span className="text-2xl mb-1.5">📥</span>
        <span className="settings-label">{t('backupVaultDragBackup')}</span>
        <span className="settings-muted mt-0.5">{t('backupVaultBrowseFiles')}</span>
        <div className="mt-3 flex gap-2 text-micro">
          <button type="button" className={importMode === 'replace' ? 'text-accent-blue font-bold' : 'settings-muted'} onClick={e => { e.stopPropagation(); setImportMode('replace') }}>{t('backupVaultImportReplace')}</button>
          <button type="button" className={importMode === 'merge' ? 'text-accent-blue font-bold' : 'settings-muted'} onClick={e => { e.stopPropagation(); setImportMode('merge') }}>{t('backupVaultImportMerge')}</button>
        </div>
        <input
          type="password"
          value={importPassphrase}
          onChange={e => { e.stopPropagation(); setImportPassphrase(e.target.value) }}
          onClick={e => e.stopPropagation()}
          placeholder={t('backupVaultImportPassphrasePlaceholder')}
          className="mt-2 w-full max-w-xs rounded-lg border border-card surface-subtle px-2 py-1 text-micro text-primary"
        />
      </div>
    </div>
  )
}
