import { useState } from 'react'
import { useConfirm } from '../../context/useConfirm'
import { useSettingsPanel } from './SettingsPanelContext'
import { SettingsCard } from '../shared/settings/SettingsCard'
import { Button } from '../shared/Button'
import { StorageUsagePanel } from './StorageUsagePanel'
import { archiveHistoryOlderThan } from '../../db/repositories/history'
import { ToggleSetting } from '../shared/settings/ToggleSetting'
import { RangeSetting } from '../shared/settings/RangeSetting'
import { daysSinceLastExport } from '../../lib/backupMetadata'

export function BackupVaultPanel() {
  const {
    backup,
    quotaExceeded,
    historyRetentionDays,
    autoExportEnabled,
    autoExportIntervalDays,
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
  const [sweepCards, setSweepCards] = useState(false)
  const [sweepNotes, setSweepNotes] = useState(false)
  const [storageKey, setStorageKey] = useState(0)

  return (
    <SettingsCard id="settings-backup-vault" title="Backup Vault">
      <StorageUsagePanel key={storageKey} />

      <div className="mb-5 rounded-2xl border border-[var(--color-border-card)] bg-[color-mix(in_srgb,var(--color-surface-card)_40%,transparent)] p-4 space-y-3">
        <p className="text-xs font-bold uppercase tracking-wider text-accent-blue">Scheduled export</p>
        <ToggleSetting
          label="Auto-export vault"
          description="Downloads a backup when the interval elapses (checked on app load)."
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
        <p className="text-micro settings-muted">
          {daysSinceLastExport() === null
            ? 'No vault export recorded yet.'
            : `Last export: ${Math.floor(daysSinceLastExport() ?? 0)} day(s) ago.`}
        </p>
      </div>

      {quotaExceeded && (
        <div className="mb-5 rounded-2xl border border-amber-500/25 bg-amber-500/10 p-4 space-y-3">
          <p className="text-xs font-bold text-amber-200 uppercase tracking-wider">Storage recovery</p>
          <p className="text-[11px] text-amber-100/80 leading-relaxed">
            Your device storage is full. Export first, then clear snapshots or study history to free space.
          </p>
          <ol className="space-y-2 text-[11px] settings-muted list-decimal list-inside">
            <li>Export your backup vault before deleting anything.</li>
            <li>Clear local auto-snapshots (safe if you have an export).</li>
            <li>Sweep study logs and history if you still need room.</li>
          </ol>
          <div className="flex flex-wrap gap-2 pt-1">
            <Button variant="primary" size="sm" onClick={exportStudyBackup}>
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
                resetDataSelective({ tasks: false, history: true, categories: false, cards: false, notes: false })
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

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="rounded-2xl border border-[var(--color-border-card)] bg-[color-mix(in_srgb,var(--color-surface-card)_40%,transparent)] p-4 flex flex-col justify-between">
          <div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-accent-blue mb-2 block">Step 1 — Export</span>
            <span className="settings-label block">Export backup vault</span>
            <span className="settings-muted mt-1 leading-normal font-semibold block">Prepares a JSON package and initiates browser download.</span>
          </div>
          <Button variant="primary" onClick={exportStudyBackup} disabled={isExporting} className="w-full mt-4">
            {isExporting ? `Exporting… ${exportProgress}%` : 'Export Vault'}
          </Button>
          {canShareBackup && shareStudyBackupVault && (
            <Button variant="secondary" onClick={shareStudyBackupVault} disabled={isExporting} className="w-full mt-2">
              Share backup
            </Button>
          )}
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
          onClick={() => fileInputRef.current?.click()}
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
          <span className="text-[10px] font-bold uppercase tracking-wider text-accent-purple mb-2">Step 2 — Import</span>
          <span className="text-2xl mb-1.5">📥</span>
          <span className="settings-label">Drag backup here</span>
          <span className="settings-muted mt-0.5">or browse files to restore</span>
        </div>
      </div>

      <div className="mt-5 border-t border-[var(--color-border-card)] pt-5">
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

      <div className="mt-6 border-t border-red-500/15 pt-5">
        <span className="text-[10px] font-bold uppercase tracking-wider text-red-400/90 mb-2 block">Step 3 — Reset</span>
        <span className="text-xs font-bold text-red-400 block mb-1">Destructive reset zone</span>
        <p className="settings-muted leading-normal mb-4">
          Select specific database tables to clear individually, or sweep all tables to perform a full workspace wipe.
        </p>
        <div className="grid grid-cols-2 gap-3 mb-5 bg-[color-mix(in_srgb,var(--color-surface-card)_30%,transparent)] border border-[var(--color-border-card)] p-4 rounded-2xl">
          {[
            { label: 'Tasks & Subtasks', checked: sweepTasks, set: setSweepTasks },
            { label: 'Study Logs & History', checked: sweepHistory, set: setSweepHistory },
            { label: 'Subject Categories', checked: sweepCategories, set: setSweepCategories },
            { label: 'Flashcard Decks', checked: sweepCards, set: setSweepCards },
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
            disabled={!sweepTasks && !sweepHistory && !sweepCategories && !sweepCards && !sweepNotes}
            onClick={async () => {
              const ok = await requestConfirm({
                title: 'Sweep selected tables?',
                message: 'Are you sure you want to sweep the selected workspace databases? This cannot be undone.',
                confirmLabel: 'Sweep Selected',
                danger: true,
              })
              if (!ok) return
              resetDataSelective({
                tasks: sweepTasks,
                history: sweepHistory,
                categories: sweepCategories,
                cards: sweepCards,
                notes: sweepNotes,
              })
              setSweepTasks(false)
              setSweepHistory(false)
              setSweepCategories(false)
              setSweepCards(false)
              setSweepNotes(false)
            }}
            className="rounded-full bg-red-500/10 border border-red-500/20 px-4 py-2 text-xs font-bold text-red-400 hover:bg-red-500/20 disabled:opacity-40 disabled:pointer-events-none transition-all ios-active-scale cursor-pointer"
          >
            Sweep Selected
          </button>
          <button
            onClick={async () => {
              const ok = await requestConfirm({
                title: 'Reset entire workspace?',
                message: 'Sweeping all tables deletes your workspace stats and configuration permanently.',
                confirmLabel: 'Sweep All',
                danger: true,
              })
              if (!ok) return
              resetData()
            }}
            className="rounded-full bg-[color-mix(in_srgb,var(--color-surface-card)_50%,transparent)] border border-[var(--color-border-card)] px-4 py-2 text-xs font-bold settings-label hover:bg-[color-mix(in_srgb,var(--color-surface-card)_70%,transparent)] transition-all ios-active-scale cursor-pointer"
          >
            Sweep All Tables
          </button>
        </div>
      </div>
    </SettingsCard>
  )
}
