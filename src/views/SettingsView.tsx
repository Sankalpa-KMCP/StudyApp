import { useEffect, useId, useRef, useState } from 'react'
import { ConfirmDialog } from '../components/ConfirmDialog'
import { prepareStudyBackup, type StudyBackupReview } from '../db/prepareStudyBackup'
import { isDataOperationBusyError } from '../hooks/useStudyBackup'
import { BookOpen, Check, CircleUserRound, Download, Layers3, RotateCcw, Upload, X } from '../components/icons'
import { MutationNotice, PanelHeader } from '../components/ui'
import { DashboardModeControl } from '../components/DashboardModeControl'
import type { DataCoordinatorSnapshot } from '../db/dataCoordinator'
import { type MutationPhase, useMutationState } from '../hooks/useMutationState'
import { THEME_CONFIGS, type ThemeMode } from '../styles/themeRegistry'
import type { DensityMode } from '../hooks/useDensityPreference'
import type { CanEnterZenReason } from '../hooks/useFocusSession'

const THEME_GROUPS = [
  { scheme: 'light', label: 'Light themes' },
  { scheme: 'dark', label: 'Dark themes' },
] as const

export function SettingsView({
  coordinatorState,
  onExport,
  onImport,
  onClear,
  onShowOnboardingChecklist,
  importPending = false,
  profileNotice,
  onDismissProfileNotice,
  preferenceNotice = null,
  onDismissPreferenceNotice,
  theme,
  onThemeChange,
  density = 'comfortable',
  onDensityChange,
  canEnterZen = false,
  canEnterZenReason = 'no-session',
  onEnterZen,
}: {
  coordinatorState?: DataCoordinatorSnapshot
  onExport: () => Promise<void>
  onImport: (file: File) => Promise<unknown>
  onClear: () => Promise<void>
  onShowOnboardingChecklist: () => Promise<void>
  importPending?: boolean
  profileNotice: string
  onDismissProfileNotice?: () => void
  preferenceNotice?: string | null
  onDismissPreferenceNotice?: () => void
  theme: ThemeMode
  onThemeChange: (theme: ThemeMode) => void
  density?: DensityMode
  onDensityChange?: (density: DensityMode) => void
  canEnterZen?: boolean
  canEnterZenReason?: CanEnterZenReason
  onEnterZen?: () => void
}) {
  const deleteInputId = useId()
  const deleteHeadingId = useId()
  const [importFeedback, setImportFeedback] = useState<{ tone: 'success' | 'error'; message: string } | null>(null)
  const [clearError, setClearError] = useState<string | null>(null)
  const [resetState, setResetState] = useState<'idle' | 'confirm' | 'deleting'>('idle')
  const [deleteInput, setDeleteInput] = useState('')
  const [preparingImport, setPreparingImport] = useState(false)
  const [replacingData, setReplacingData] = useState(false)
  const [importReview, setImportReview] = useState<{ file: File; summary: StudyBackupReview } | null>(null)
  const importRequestRef = useRef(0)
  const dataWritePendingRef = useRef(false)
  const mountedRef = useRef(true)
  useEffect(() => {
    mountedRef.current = true
    return () => { mountedRef.current = false }
  }, [])
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const themeOptionRefs = useRef<Array<HTMLButtonElement | null>>([])
  const exportMutation = useMutationState()
  const onboardingMutation = useMutationState()
  const {
    clearFeedback: clearExportFeedback,
    isPending: isExporting,
    phase: exportPhase,
    message: exportMessage,
    run: runExport,
  } = exportMutation

  const isExportDisabled = isExporting || (coordinatorState ? !coordinatorState.canExport : false)
  const isImportDisabled = importPending || replacingData || isExporting || resetState === 'deleting' || (coordinatorState ? !coordinatorState.canImport : false)
  const isClearDisabled = resetState === 'deleting' || replacingData || (coordinatorState ? !coordinatorState.canClear : false)

  const noticePhase: MutationPhase = clearError
    ? 'error'
    : preferenceNotice
      ? 'error'
      : onboardingMutation.phase === 'success' || onboardingMutation.phase === 'error'
        ? onboardingMutation.phase
        : importFeedback
          ? importFeedback.tone
          : exportPhase === 'success' || exportPhase === 'error'
            ? exportPhase
            : 'idle'
  const noticeMessage = clearError
    ?? preferenceNotice
    ?? (onboardingMutation.phase === 'success' || onboardingMutation.phase === 'error' ? onboardingMutation.message : null)
    ?? importFeedback?.message
    ?? (exportPhase === 'success' || exportPhase === 'error' ? exportMessage : null)
    ?? null

  const dismissNotice = () => {
    setClearError(null)
    setImportFeedback(null)
    onboardingMutation.clearFeedback()
    clearExportFeedback()
    onDismissPreferenceNotice?.()
  }

  const handleThemeKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>, index: number) => {
    let nextIndex: number | null = null

    if (event.key === 'ArrowRight' || event.key === 'ArrowDown') nextIndex = (index + 1) % THEME_CONFIGS.length
    if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') nextIndex = (index - 1 + THEME_CONFIGS.length) % THEME_CONFIGS.length
    if (event.key === 'Home') nextIndex = 0
    if (event.key === 'End') nextIndex = THEME_CONFIGS.length - 1
    if (nextIndex === null) return

    event.preventDefault()
    onThemeChange(THEME_CONFIGS[nextIndex].id)
    themeOptionRefs.current[nextIndex]?.focus()
  }

  const handleExport = async () => {
    if (isExportDisabled) {
      if (coordinatorState && !coordinatorState.canExport) {
        setClearError('A data operation is currently in progress. Please wait.')
      }
      return
    }
    setClearError(null)
    setImportFeedback(null)
    onDismissPreferenceNotice?.()
    try {
      await runExport(async () => {
        await onExport()
      }, {
        successMessage: 'Backup exported.',
        errorMessage: 'Backup could not be exported.',
      })
    } catch {
      setClearError('A data operation is currently in progress. Please wait.')
    }
  }

  const handleImport = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    if (isImportDisabled || dataWritePendingRef.current) {
      setImportFeedback({ tone: 'error', message: 'A data operation is currently in progress. Please wait.' })
      return
    }

    setClearError(null)
    setImportFeedback(null)
    onboardingMutation.clearFeedback()
    setImportReview(null)
    setPreparingImport(true)
    clearExportFeedback()
    onDismissPreferenceNotice?.()
    const request = ++importRequestRef.current
    const isCurrent = () => mountedRef.current && request === importRequestRef.current
    try {
      const summary = await prepareStudyBackup(file)
      if (!isCurrent()) return
      setImportReview({ file, summary })
      fileInputRef.current?.focus()
    } catch {
      if (isCurrent()) setImportFeedback({ tone: 'error', message: 'Import failed. Choose a valid Study Dashboard export.' })
    } finally {
      if (isCurrent()) setPreparingImport(false)
    }
  }

  const cancelImport = () => {
    if (dataWritePendingRef.current) return
    importRequestRef.current++
    setPreparingImport(false)
    setImportReview(null)
    clearExportFeedback()
    setImportFeedback({ tone: 'success', message: 'Import cancelled. Your study data was not changed.' })
    fileInputRef.current?.focus()
  }

  const confirmImport = async () => {
    if (!importReview || isImportDisabled || dataWritePendingRef.current) return
    dataWritePendingRef.current = true
    setReplacingData(true)
    clearExportFeedback()
    setImportFeedback(null)
    const request = importRequestRef.current
    try {
      await onImport(importReview.file)
      if (mountedRef.current && request === importRequestRef.current) {
        setImportReview(null)
        setImportFeedback({ tone: 'success', message: 'Study data imported.' })
      }
    } catch (error) {
      if (mountedRef.current && request === importRequestRef.current) {
        setImportReview(null)
        setImportFeedback({ tone: 'error', message: isDataOperationBusyError(error)
          ? 'A data operation is currently in progress. Please wait.'
          : 'Import failed. Choose a valid Study Dashboard export.' })
      }
    } finally {
      dataWritePendingRef.current = false
      if (mountedRef.current && request === importRequestRef.current) setReplacingData(false)
    }
  }

  const handleClear = async () => {
    if (deleteInput !== 'DELETE' || isClearDisabled || dataWritePendingRef.current) return
    if (coordinatorState && !coordinatorState.canClear) {
      setClearError('A data operation is currently in progress. Please wait.')
      return
    }
    setClearError(null)
    clearExportFeedback()
    setImportFeedback(null)
    onDismissPreferenceNotice?.()
    setResetState('deleting')
    dataWritePendingRef.current = true
    try {
      await onClear()
      // Success is handled by App.tsx navigating away
    } catch {
      setClearError('Study data could not be cleared. Please try again.')
      setResetState('confirm')
    } finally {
      dataWritePendingRef.current = false
    }
  }

  const handleShowOnboardingChecklist = async () => {
    if (onboardingMutation.isPending || isImportDisabled) return
    setClearError(null)
    setImportFeedback(null)
    clearExportFeedback()
    onDismissPreferenceNotice?.()
    await onboardingMutation.run(async () => {
      await onShowOnboardingChecklist()
    }, {
      successMessage: 'Onboarding checklist will appear on Home.',
      errorMessage: 'Onboarding checklist could not be shown. Please try again.',
    })
  }

  return (
    <section className="workspace-panel" aria-labelledby="settings-workspace-title">
      <PanelHeader title="Settings" description="Manage appearance, backups, and local data." />
      {profileNotice ? (
        <div className="settings-feedback info profile-notice-banner" role="status">
          <div className="profile-notice-content">
            <CircleUserRound size={18} aria-hidden="true" />
            <span>{profileNotice}</span>
          </div>
          {onDismissProfileNotice ? (
            <button
              type="button"
              className="profile-notice-dismiss"
              aria-label="Dismiss profile notice"
              onClick={onDismissProfileNotice}
            >
              <X size={16} aria-hidden="true" />
            </button>
          ) : null}
        </div>
      ) : null}
      {coordinatorState?.statusLabel ? (
        <div className="settings-active-operation-status" aria-live="polite">
          {coordinatorState.statusLabel}
        </div>
      ) : null}
      {!importReview && <MutationNotice phase={noticePhase} message={noticeMessage} onDismiss={dismissNotice} />}
      {preparingImport && <div aria-busy="true">
        <p role="status">Validating backup. Your study data has not changed.</p>
        <button className="secondary-command" type="button" onClick={cancelImport}>Cancel validation</button>
      </div>}
      <ConfirmDialog
        open={!!importReview}
        title="Review study backup"
        description="Importing replaces all current local study data on this device. This cannot be undone. Export your current data first if you want to keep it."
        confirmLabel="Replace my study data"
        pending={replacingData}
        confirmDisabled={isImportDisabled}
        onCancel={cancelImport}
        onConfirm={() => void confirmImport()}
      >
        {importReview && <>
          <p className="backup-review-file">Selected backup: <strong>{importReview.file.name}</strong></p>
          <p>Backup format: version {importReview.summary.version}. Validated for import.</p>
          <ul>
            <li>Subjects: {importReview.summary.counts.subjects}</li>
            <li>Tasks: {importReview.summary.counts.tasks}</li>
            <li>Notes: {importReview.summary.counts.notes}</li>
            <li>Calendar events: {importReview.summary.counts.events}</li>
            <li>Study sessions: {importReview.summary.counts.studySessions}</li>
            <li>Goals: {importReview.summary.counts.goals}</li>
            <li>Settings: {importReview.summary.counts.settings}</li>
          </ul>
          <p>Total records: {importReview.summary.total}. Active focus session: {importReview.summary.hasFocusSession ? 'included' : 'not included'}.</p>
          <button className="secondary-command" type="button" disabled={isExportDisabled || replacingData} onClick={() => void handleExport()}>
            {isExporting ? 'Creating backup…' : 'Export current data first'}
          </button>
          <MutationNotice phase={noticePhase} message={noticeMessage} onDismiss={dismissNotice} />
          {replacingData && <p role="status">Replacing study data and restoring focus state…</p>}
        </>}
      </ConfirmDialog>
      <p className="settings-section-description">
        Download an unencrypted JSON backup containing one consistent snapshot of your subjects, tasks, notes, calendar events, study sessions, goals, and supported settings. Active focus-session data is included when present. Changes committed after the snapshot begins may not appear. Device-local appearance and sidebar preferences are excluded.
      </p>
      <div className="card-grid">
        <div className="action-card profile-card" id="local-profile-card">
          <CircleUserRound size={24} aria-hidden="true" />
          <strong>Local Study Profile</strong>
          <span>
            Your study workspace is local-first. All subjects, notes, focus history, and goals are stored privately in your browser&apos;s IndexedDB without cloud accounts or external tracking.
          </span>
          <div className="profile-badges" aria-label="Profile attributes">
            <span className="profile-badge">Storage: Offline &amp; Private</span>
            <span className="profile-badge">Theme: {THEME_CONFIGS.find((c) => c.id === theme)?.label ?? theme}</span>
            <span className="profile-badge">Layout: {density === 'comfortable' ? 'Comfortable' : 'Compact'}</span>
          </div>
        </div>
        <button
          className="action-card"
          type="button"
          onClick={() => void handleExport()}
          disabled={isExportDisabled}
          aria-busy={isExporting || coordinatorState?.activeDataOperation === 'export' || undefined}
        >
          <Download size={24} aria-hidden="true" />
          <strong>{isExporting || coordinatorState?.activeDataOperation === 'export' ? 'Creating backup…' : 'Export data'}</strong>
          <span>{isExporting || coordinatorState?.activeDataOperation === 'export' ? 'Preparing your JSON backup.' : 'Download an unencrypted JSON backup snapshot.'}</span>
        </button>
        <label
          className={importPending || coordinatorState?.activeDataOperation === 'import' ? 'action-card import-card is-pending' : isImportDisabled ? 'action-card import-card is-disabled' : 'action-card import-card'}
          aria-busy={importPending || coordinatorState?.activeDataOperation === 'import' || undefined}
        >
          <Upload size={24} aria-hidden="true" />
          <strong>{importPending || coordinatorState?.activeDataOperation === 'import' ? 'Importing backup…' : 'Import data'}</strong>
          <span>{importPending || coordinatorState?.activeDataOperation === 'import' ? 'Importing and syncing focus state…' : 'Replace local data from an unencrypted JSON backup.'}</span>
          <input
            ref={fileInputRef}
            className="sr-only"
            type="file"
            accept="application/json"
            disabled={isImportDisabled}
            aria-label="Import data"
            onChange={(event) => void handleImport(event)}
          />
        </label>
        <div className="action-card density-card dashboard-mode-card">
          <strong>Dashboard mode</strong>
          <span>Comfortable and Compact customize dashboard layout. Zen mode provides an immersive distraction-free focus canvas for active sessions.</span>
          {onDensityChange ? (
            <DashboardModeControl
              density={density}
              onDensityChange={onDensityChange}
              canEnterZen={canEnterZen}
              canEnterZenReason={canEnterZenReason}
              onEnterZen={onEnterZen ?? (() => undefined)}
              idPrefix="settings-mode"
            />
          ) : null}
          {!canEnterZen && canEnterZenReason ? (
            <p className="dashboard-mode-hint field-hint">
              {canEnterZenReason === 'stale'
                ? 'Resolve the unfinished Focus session to use Zen.'
                : canEnterZenReason === 'pending'
                  ? 'Focus is updating. Zen will be available when it is ready.'
                  : 'Zen is available during an active Focus session.'}
            </p>
          ) : null}
        </div>
        <div className="action-card theme-card">
          <Layers3 size={24} aria-hidden="true" />
          <strong>Appearance</strong>
          <span>Choose a theme for this device.</span>
          <div className="theme-gallery-groups" role="radiogroup" aria-label="Theme">
            {THEME_GROUPS.map((group) => {
              const groupOptions = THEME_CONFIGS.filter((option) => option.colorScheme === group.scheme)
              if (groupOptions.length === 0) return null
              return (
                <div className="theme-group" key={group.scheme}>
                  <div className="theme-group-header">
                    <span className="theme-group-label">{group.label}</span>
                    <span className="theme-group-count" aria-label={`${groupOptions.length} ${group.label.toLowerCase()}`}>{groupOptions.length}</span>
                  </div>
                  <div className="theme-grid">
                    {groupOptions.map((option) => {
                      const globalIndex = THEME_CONFIGS.findIndex((c) => c.id === option.id)
                      const isSelected = theme === option.id
                      return (
                        <button
                          className={isSelected ? 'theme-option is-active' : 'theme-option'}
                          type="button"
                          role="radio"
                          aria-checked={isSelected}
                          tabIndex={isSelected ? 0 : -1}
                          key={option.id}
                          ref={(element) => { themeOptionRefs.current[globalIndex] = element }}
                          onClick={() => onThemeChange(option.id)}
                          onKeyDown={(event) => handleThemeKeyDown(event, globalIndex)}
                        >
                          <span className="theme-preview" data-theme-preview={option.id} aria-hidden="true">
                            <span className="theme-preview-window">
                              <span className="theme-preview-sidebar">
                                <span className="theme-preview-nav-item is-active" />
                                <span className="theme-preview-nav-item" />
                                <span className="theme-preview-nav-item" />
                              </span>
                              <span className="theme-preview-body">
                                <span className="theme-preview-topbar">
                                  <span className="theme-preview-chip is-accent" />
                                  <span className="theme-preview-chip is-highlight" />
                                </span>
                                <span className="theme-preview-card">
                                  <span className="theme-preview-line is-title" />
                                  <span className="theme-preview-line is-muted" />
                                  <span className="theme-preview-bar">
                                    <span className="theme-preview-bar-fill" />
                                  </span>
                                </span>
                              </span>
                            </span>
                          </span>
                          <span className="theme-option-info">
                            <span className="theme-option-header">
                              <strong>{option.label}</strong>
                              {isSelected ? (
                                <span className="theme-selected-badge">
                                  <Check size={12} aria-hidden="true" />
                                  <span>Active</span>
                                </span>
                              ) : null}
                            </span>
                            <small>{option.description}</small>
                          </span>
                        </button>
                      )
                    })}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
        <button
          className="action-card"
          type="button"
          aria-label="Show onboarding checklist"
          onClick={() => void handleShowOnboardingChecklist()}
          disabled={onboardingMutation.isPending || isImportDisabled}
          aria-busy={onboardingMutation.isPending || undefined}
        >
          <BookOpen size={24} aria-hidden="true" />
          <strong>{onboardingMutation.isPending ? 'Showing onboarding...' : 'Show onboarding checklist'}</strong>
          <span>Bring the Home checklist back without changing your saved study data.</span>
        </button>
      </div>
      <div className="section-heading danger-heading">
        <h2>Danger zone</h2>
      </div>
      <div className="card-grid danger-zone">
        {resetState === 'idle' ? (
          <button
            className="action-card danger-card"
            type="button"
            disabled={isClearDisabled}
            onClick={() => {
              if (coordinatorState && !coordinatorState.canClear) {
                setClearError('A data operation is currently in progress. Please wait.')
                return
              }
              setResetState('confirm')
              setClearError(null)
            }}
          >
            <RotateCcw size={24} aria-hidden="true" />
            <strong>Reset all study data</strong>
            <span>Permanently deletes local study data on this device.</span>
          </button>
        ) : (
          <div
            className="action-card danger-card is-confirming"
            role="region"
            aria-labelledby={deleteHeadingId}
            aria-busy={resetState === 'deleting' || coordinatorState?.activeDataOperation === 'deleteAll' || undefined}
          >
            <strong id={deleteHeadingId}>Confirm data deletion</strong>
            <p>
              <label htmlFor={deleteInputId}>Type DELETE to permanently remove all study data.</label>
            </p>
            <input
              id={deleteInputId}
              className="reset-confirm-input"
              type="text"
              value={deleteInput}
              onChange={(e) => setDeleteInput(e.target.value)}
              placeholder="DELETE"
              disabled={resetState === 'deleting' || isClearDisabled}
              autoComplete="off"
              autoCapitalize="characters"
              spellCheck={false}
            />
            <div className="button-row">
              <button
                className="secondary-command"
                type="button"
                onClick={() => { setResetState('idle'); setDeleteInput(''); setClearError(null) }}
                disabled={resetState === 'deleting'}
              >
                Cancel
              </button>
              <button
                className="primary-command"
                type="button"
                disabled={deleteInput !== 'DELETE' || isClearDisabled}
                aria-busy={resetState === 'deleting' || coordinatorState?.activeDataOperation === 'deleteAll' || undefined}
                onClick={() => void handleClear()}
              >
                {resetState === 'deleting' || coordinatorState?.activeDataOperation === 'deleteAll' ? 'Deleting study data…' : 'Delete all data'}
              </button>
            </div>
          </div>
        )}
      </div>
    </section>
  )
}
