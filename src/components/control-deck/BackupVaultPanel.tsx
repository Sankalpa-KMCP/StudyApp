import { useState } from 'react'
import { useConfirm } from '../../context/useConfirm'
import { useSettingsPanel } from './SettingsPanelContext'
import { SettingsCard } from '../shared/settings/SettingsCard'
import { SettingsDisclosure } from '../shared/settings/SettingsDisclosure'
import { Button } from '../shared/Button'
import { StorageUsagePanel } from './StorageUsagePanel'
import { FolderSyncPanel } from './FolderSyncPanel'
import { archiveHistoryOlderThan } from '../../db/repositories/history'
import { ToggleSetting } from '../shared/settings/ToggleSetting'
import { RangeSetting } from '../shared/settings/RangeSetting'
import { daysSinceLastExport } from '../../lib/backup/backupMetadata'
import { scrollToSettingsSection } from '../../lib/settings/settingsSections'
import { isTauri } from '../../lib/desktop/tauri'

export function BackupVaultPanel() {
  const {
    backup,
    quotaExceeded,
    historyRetentionDays,
    autoExportEnabled,
    autoExportIntervalDays,
    syncFolderPath,
    updateSetting,
    pushToast,
    isDragging,
    setIsDragging,
    handleFileDrop,
  } = useSettingsPanel()
  const {
    exportStudyBackup,
    shareStudyBackupVault,
    exportStudyHistoryIcs,
    canShareBackup = false,
    isExporting = false,
    exportProgress = 0,
    exportStudyLogsCSV,
    exportTaskCompletionLogsCSV,
    importStudyBackup,
    resetData,
    resetDataSelective,
    clearSnapshots,
    fileInputRef,
  } = backup
  const { requestConfirm } = useConfirm()
  const [sweepTasks, setSweepTasks] = useState(false)
  const [sweepHistory, setSweepHistory] = useState(false)
  const [sweepCategories, setSweepCategories] = useState(false)
  const [sweepNotes, setSweepNotes] = useState(false)
  const [storageKey, setStorageKey] = useState(0)
  const [encryptPassphrase, setEncryptPassphrase] = useState('')
  const [importPassphrase, setImportPassphrase] = useState('')
  const [importMode, setImportMode] = useState<'replace' | 'merge'>('replace')

  const lastExportNote = daysSinceLastExport() === null
    ? 'No vault export recorded yet — export manually once before scheduled exports run.'
    : `Last export: ${Math.floor(daysSinceLastExport() ?? 0)} day(s) ago.`

  return (
    <SettingsCard id="settings-backup-vault" title="Backup Vault">
      <StorageUsagePanel key={storageKey} />

      {quotaExceeded && (
        <div className="mb-5 rounded-2xl border border-amber-500/25 bg-amber-500/10 p-4 space-y-3">
          <p className="text-xs font-bold status-banner-warning uppercase tracking-wider">Storage recovery</p>
          <p className="text-[11px] status-banner-warning-body leading-relaxed">
            Your device storage is full. Export first, then clear snapshots or study history to free space.
          </p>
          <ol className="space-y-2 text-[11px] settings-muted list-decimal list-inside">
            <li>Export your backup vault before deleting anything.</li>
            <li>Clear local auto-snapshots (safe if you have an export).</li>
            <li>Sweep study logs and history if you still need room.</li>
          </ol>
          <div className="flex flex-wrap gap-2 pt-1">
            <Button variant="primary" size="sm" onClick={() => exportStudyBackup({ destination: 'download' })}>
              1. Export vault
            </Button>
            <Button variant="secondary" size="sm" onClick={clearSnapshots}>
              2. Clear snapshots
            </Button>
            <Button
              variant="danger"
              size="sm"
              onClick={async () => {
                const ok = await requestConfirm({
                  title: 'Sweep study logs & history?',
                  message: 'This deletes session history and daily logs. Export a backup first if you need them.',
                  confirmLabel: 'Sweep logs',
                  danger: true,
                })
                if (!ok) return
                resetDataSelective({ tasks: false, history: true, categories: false, notes: false })
              }}
            >
              3. Sweep logs
            </Button>
          </div>
        </div>
      )}

      <p className="settings-muted mb-5 leading-relaxed">
        Export backup data bundle to sync tables or local study logs across devices.
      </p>

      <FolderSyncPanel />

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-5">
        <div className="rounded-2xl border border-[var(--color-border-card)] bg-[color-mix(in_srgb,var(--color-surface-card)_40%,transparent)] p-4 flex flex-col justify-between">
          <div>
            <span className="text-micro font-bold uppercase tracking-wider text-accent-blue mb-2 block">Step 1 — Export</span>
            <span className="settings-label block">Export backup vault</span>
            <span className="settings-muted mt-1 leading-normal font-semibold block">
              {isTauri() && syncFolderPath
                ? 'Downloads a JSON package to your browser (independent of the sync folder).'
                : 'Prepares a JSON package and initiates browser download.'}
            </span>
            <span className="text-micro settings-muted mt-2 block">{lastExportNote}</span>
          </div>
          <Button
            variant="primary"
            onClick={() => exportStudyBackup({ destination: 'download' })}
            disabled={isExporting}
            className="w-full mt-4"
          >
            {isExporting ? `Exporting… ${exportProgress}%` : 'Export Vault'}
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
            sessionStorage.setItem('backup_import_mode', importMode)
            sessionStorage.setItem('backup_import_passphrase', importPassphrase)
            fileInputRef.current?.click()
          }}
          onKeyDown={e => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault()
              fileInputRef.current?.click()
            }
          }}
          aria-label="Import backup file"
          className={`flex flex-col items-center justify-center border border-dashed rounded-2xl p-4 text-center transition-all cursor-pointer min-h-[120px] ${
            isDragging ? 'border-accent-purple bg-accent-purple/10' : 'border-[var(--color-border-card)] bg-[color-mix(in_srgb,var(--color-surface-card)_40%,transparent)] hover:border-[color-mix(in_srgb,var(--color-text-primary)_20%,transparent)]'
          }`}
        >
          <span className="text-micro font-bold uppercase tracking-wider text-accent-purple mb-2">Step 2 — Import</span>
          <span className="text-2xl mb-1.5">📥</span>
          <span className="settings-label">Drag backup here</span>
          <span className="settings-muted mt-0.5">or browse files to restore</span>
          <div className="mt-3 flex gap-2 text-micro">
            <button type="button" className={importMode === 'replace' ? 'text-accent-blue font-bold' : 'settings-muted'} onClick={e => { e.stopPropagation(); setImportMode('replace') }}>Replace</button>
            <button type="button" className={importMode === 'merge' ? 'text-accent-blue font-bold' : 'settings-muted'} onClick={e => { e.stopPropagation(); setImportMode('merge') }}>Merge</button>
          </div>
          <input
            type="password"
            value={importPassphrase}
            onChange={e => { e.stopPropagation(); setImportPassphrase(e.target.value) }}
            onClick={e => e.stopPropagation()}
            placeholder="Passphrase (encrypted backups)"
            className="mt-2 w-full max-w-xs rounded-lg border border-card surface-subtle px-2 py-1 text-micro text-primary"
          />
        </div>
      </div>

      <div className="mt-5">
        <SettingsDisclosure title="Advanced backup & data tools" defaultOpen={false}>
          <div className="rounded-2xl border border-[var(--color-border-card)] bg-[color-mix(in_srgb,var(--color-surface-card)_40%,transparent)] p-4 space-y-3">
            <p className="text-xs font-bold uppercase tracking-wider text-accent-blue">Scheduled export</p>
            <ToggleSetting
              label="Auto-export vault"
              description={
                isTauri() && syncFolderPath
                  ? 'Saves a dated backup to your sync folder when the interval elapses (also checked every 6 hours while the app is open).'
                  : 'Downloads a backup when the interval elapses (checked on load and every 6 hours while the app is open). Requires a prior manual export before the first scheduled run.'
              }
              checked={autoExportEnabled}
              onChange={v => updateSetting('autoExportEnabled', v)}
            />
            {autoExportEnabled && (
              <RangeSetting
                label="Export interval"
                value={autoExportIntervalDays}
                min={1}
                max={30}
                step={1}
                unit="days"
                onChange={v => updateSetting('autoExportIntervalDays', v)}
              />
            )}
            {isTauri() && syncFolderPath && (
              <p className="text-micro settings-muted">
                Scheduled exports save to:{' '}
                <span className="font-mono text-micro break-all">{syncFolderPath}</span>
                {' · '}
                <button
                  type="button"
                  className="text-accent-blue hover:text-accent-blue/80 font-semibold"
                  onClick={() => scrollToSettingsSection('settings-backup-vault')}
                >
                  Change folder
                </button>
              </p>
            )}
          </div>

          <div className="rounded-2xl border border-[var(--color-border-card)] bg-[color-mix(in_srgb,var(--color-surface-card)_40%,transparent)] p-4">
            <span className="settings-label block mb-2">Encrypted export</span>
            <label className="flex items-center gap-2 text-xs settings-muted">
              <input
                type="checkbox"
                checked={!!encryptPassphrase}
                onChange={e => setEncryptPassphrase(e.target.checked ? ' ' : '')}
              />
              Encrypt with passphrase
            </label>
            {encryptPassphrase !== '' && (
              <input
                type="password"
                value={encryptPassphrase.trim()}
                onChange={e => setEncryptPassphrase(e.target.value)}
                placeholder="Passphrase"
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
              Export encrypted vault
            </Button>
            {canShareBackup && shareStudyBackupVault && (
              <Button variant="secondary" onClick={shareStudyBackupVault} disabled={isExporting} className="w-full mt-2">
                Share backup
              </Button>
            )}
          </div>

          <div className="border-t border-[var(--color-border-card)] pt-5">
            <span className="settings-label block mb-3">CSV Reports Export</span>
            {historyRetentionDays > 0 && (
              <div className="mb-4">
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={async () => {
                    const ok = await requestConfirm({
                      title: `Archive history older than ${historyRetentionDays} days?`,
                      message: 'Export a backup first if you need old session records. This cannot be undone.',
                      confirmLabel: 'Archive',
                      danger: true,
                    })
                    if (!ok) return
                    const deleted = await archiveHistoryOlderThan(historyRetentionDays)
                    setStorageKey(k => k + 1)
                    pushToast('ARCHIVE', deleted > 0 ? `Archived ${deleted} history entries` : 'No history entries to archive')
                  }}
                >
                  Archive old history ({historyRetentionDays}+ days)
                </Button>
              </div>
            )}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="rounded-2xl border border-[var(--color-border-card)] bg-[color-mix(in_srgb,var(--color-surface-card)_40%,transparent)] p-4 flex flex-col justify-between">
                <div>
                  <span className="settings-label block">Study Logs (CSV)</span>
                  <span className="settings-muted mt-1 leading-normal font-semibold block">Export daily study and break durations, mood, and reflection notes.</span>
                </div>
                <button
                  onClick={exportStudyLogsCSV}
                  className="w-full mt-4 rounded-full bg-accent-blue/10 hover:bg-accent-blue/25 text-accent-blue border border-accent-blue/20 py-2.5 text-xs font-bold transition-all ios-active-scale cursor-pointer"
                >
                  Export CSV Logs
                </button>
                <button
                  onClick={() => exportStudyHistoryIcs?.()}
                  className="w-full mt-4 rounded-full bg-accent-green/10 hover:bg-accent-green/25 text-accent-green border border-accent-green/20 py-2.5 text-xs font-bold transition-all ios-active-scale cursor-pointer"
                >
                  Export ICS Calendar
                </button>
                <label className="w-full mt-2 block">
                  <span className="sr-only">Import ICS calendar</span>
                  <input
                    type="file"
                    accept=".ics,text/calendar"
                    className="text-micro settings-muted w-full"
                    onChange={e => {
                      const file = e.target.files?.[0]
                      if (!file) return
                      const reader = new FileReader()
                      reader.onload = () => {
                        if (typeof reader.result === 'string') backup.importStudyHistoryIcs?.(reader.result)
                      }
                      reader.readAsText(file)
                      e.target.value = ''
                    }}
                  />
                </label>
              </div>
              <div className="rounded-2xl border border-[var(--color-border-card)] bg-[color-mix(in_srgb,var(--color-surface-card)_40%,transparent)] p-4 flex flex-col justify-between">
                <div>
                  <span className="settings-label block">Task Completion (CSV)</span>
                  <span className="settings-muted mt-1 leading-normal font-semibold block">Export tasks registry data, completion status, estimates, and subtask progress.</span>
                </div>
                <button
                  onClick={exportTaskCompletionLogsCSV}
                  className="w-full mt-4 rounded-full bg-accent-blue/10 hover:bg-accent-blue/25 text-accent-blue border border-accent-blue/20 py-2.5 text-xs font-bold transition-all ios-active-scale cursor-pointer"
                >
                  Export CSV Tasks
                </button>
              </div>
            </div>
          </div>

          <div className="border-t border-red-500/15 pt-5">
            <span className="text-micro font-bold uppercase tracking-wider text-red-400/90 mb-2 block">Step 3 — Reset</span>
            <span className="text-xs font-bold text-red-400 block mb-1">Clear workspace data</span>
            <p className="settings-muted leading-normal mb-4">
              Choose what to remove, or reset your entire workspace. This cannot be undone.
            </p>
            <div className="grid grid-cols-2 gap-3 mb-5 bg-[color-mix(in_srgb,var(--color-surface-card)_30%,transparent)] border border-[var(--color-border-card)] p-4 rounded-2xl">
              {[
                { label: 'Tasks & Subtasks', checked: sweepTasks, set: setSweepTasks },
                { label: 'Study Logs & History', checked: sweepHistory, set: setSweepHistory },
                { label: 'Subject Categories', checked: sweepCategories, set: setSweepCategories },
                { label: 'Quick Notes', checked: sweepNotes, set: setSweepNotes },
              ].map(item => (
                <label key={item.label} className="flex items-center gap-2.5 settings-muted font-semibold cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={item.checked}
                    onChange={e => item.set(e.target.checked)}
                    className="rounded border-[var(--color-border-card)] bg-[color-mix(in_srgb,var(--color-surface-card)_50%,transparent)] text-red-500 focus:ring-0 cursor-pointer h-3.5 w-3.5"
                  />
                  <span>{item.label}</span>
                </label>
              ))}
            </div>
            <div className="flex flex-wrap gap-3">
              <button
                disabled={!sweepTasks && !sweepHistory && !sweepCategories && !sweepNotes}
                onClick={async () => {
                  const ok = await requestConfirm({
                    title: 'Clear selected data?',
                    message: 'The selected items will be permanently deleted from your workspace. Export a backup first if you need your data.',
                    confirmLabel: 'Clear selected',
                    danger: true,
                  })
                  if (!ok) return
                  resetDataSelective({
                    tasks: sweepTasks,
                    history: sweepHistory,
                    categories: sweepCategories,
                    notes: sweepNotes,
                  })
                  setSweepTasks(false)
                  setSweepHistory(false)
                  setSweepCategories(false)
                  setSweepNotes(false)
                }}
                className="rounded-full bg-red-500/10 border border-red-500/20 px-4 py-2 text-xs font-bold text-red-400 hover:bg-red-500/20 disabled:opacity-40 disabled:pointer-events-none transition-all ios-active-scale cursor-pointer"
              >
                Clear selected data
              </button>
              <button
                onClick={async () => {
                  const ok = await requestConfirm({
                    title: 'Reset entire workspace?',
                    message: 'This deletes all tasks, history, settings, and other workspace data permanently. Export a backup first if you need your data.',
                    confirmLabel: 'Reset workspace',
                    danger: true,
                  })
                  if (!ok) return
                  resetData()
                }}
                className="rounded-full bg-[color-mix(in_srgb,var(--color-surface-card)_50%,transparent)] border border-[var(--color-border-card)] px-4 py-2 text-xs font-bold settings-label hover:bg-[color-mix(in_srgb,var(--color-surface-card)_70%,transparent)] transition-all ios-active-scale cursor-pointer"
              >
                Reset entire workspace
              </button>
            </div>
          </div>
        </SettingsDisclosure>
      </div>

      <input
        type="file"
        accept=".studybackup,.json"
        ref={fileInputRef}
        className="hidden"
        onChange={e => {
          const file = e.target.files?.[0]
          if (file) {
            const r = new FileReader()
            r.onload = () => importStudyBackup(r.result as string)
            r.readAsText(file)
          }
          e.target.value = ''
        }}
      />
    </SettingsCard>
  )
}
