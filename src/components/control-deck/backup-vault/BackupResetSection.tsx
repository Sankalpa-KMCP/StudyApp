import { useTranslation } from '../../../i18n/useTranslation'

interface BackupResetSectionProps {
  sweepTasks: boolean
  setSweepTasks: (v: boolean) => void
  sweepHistory: boolean
  setSweepHistory: (v: boolean) => void
  sweepCategories: boolean
  setSweepCategories: (v: boolean) => void
  sweepNotes: boolean
  setSweepNotes: (v: boolean) => void
  resetDataSelective: (options: { tasks: boolean; history: boolean; categories: boolean; notes: boolean }) => void
  resetData: () => void
  resetSweepFlags: () => void
  requestConfirm: (options: {
    title: string
    message: string
    confirmLabel?: string
    danger?: boolean
  }) => Promise<boolean>
}

export function BackupResetSection({
  sweepTasks,
  setSweepTasks,
  sweepHistory,
  setSweepHistory,
  sweepCategories,
  setSweepCategories,
  sweepNotes,
  setSweepNotes,
  resetDataSelective,
  resetData,
  resetSweepFlags,
  requestConfirm,
}: BackupResetSectionProps) {
  const { t } = useTranslation()

  const sweepOptions = [
    { label: t('backupVaultSweepTasks'), checked: sweepTasks, set: setSweepTasks },
    { label: t('backupVaultSweepHistory'), checked: sweepHistory, set: setSweepHistory },
    { label: t('backupVaultSweepCategories'), checked: sweepCategories, set: setSweepCategories },
    { label: t('backupVaultSweepNotes'), checked: sweepNotes, set: setSweepNotes },
  ]

  return (
    <div className="border-t border-red-500/15 pt-5">
      <span className="text-micro font-bold uppercase tracking-wider text-red-400/90 mb-2 block">{t('backupVaultStepReset')}</span>
      <span className="text-xs font-bold text-red-400 block mb-1">{t('backupVaultClearWorkspaceData')}</span>
      <p className="settings-muted leading-normal mb-4">
        {t('backupVaultClearWorkspaceDesc')}
      </p>
      <div className="grid grid-cols-2 gap-3 mb-5 bg-[color-mix(in_srgb,var(--color-surface-card)_30%,transparent)] border border-[var(--color-border-card)] p-4 rounded-2xl">
        {sweepOptions.map(item => (
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
              title: t('backupVaultClearSelectedConfirmTitle'),
              message: t('backupVaultClearSelectedConfirmMessage'),
              confirmLabel: t('backupVaultClearSelectedConfirmLabel'),
              danger: true,
            })
            if (!ok) return
            resetDataSelective({
              tasks: sweepTasks,
              history: sweepHistory,
              categories: sweepCategories,
              notes: sweepNotes,
            })
            resetSweepFlags()
          }}
          className="rounded-full bg-red-500/10 border border-red-500/20 px-4 py-2 text-xs font-bold text-red-400 hover:bg-red-500/20 disabled:opacity-40 disabled:pointer-events-none transition-all ios-active-scale cursor-pointer"
        >
          {t('backupVaultClearSelectedData')}
        </button>
        <button
          onClick={async () => {
            const ok = await requestConfirm({
              title: t('backupVaultResetWorkspaceConfirmTitle'),
              message: t('backupVaultResetWorkspaceConfirmMessage'),
              confirmLabel: t('backupVaultResetWorkspaceConfirmLabel'),
              danger: true,
            })
            if (!ok) return
            resetData()
          }}
          className="rounded-full bg-[color-mix(in_srgb,var(--color-surface-card)_50%,transparent)] border border-[var(--color-border-card)] px-4 py-2 text-xs font-bold settings-label hover:bg-[color-mix(in_srgb,var(--color-surface-card)_70%,transparent)] transition-all ios-active-scale cursor-pointer"
        >
          {t('backupVaultResetEntireWorkspace')}
        </button>
      </div>
    </div>
  )
}
