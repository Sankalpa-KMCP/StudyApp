import { useId, useRef, useState } from 'react'
import { BookOpen, Check, Download, Layers3, RotateCcw, Upload } from '../components/icons'
import { MutationNotice, PanelHeader } from '../components/ui'
import type { DataCoordinatorSnapshot } from '../db/dataCoordinator'
import { type MutationPhase, useMutationState } from '../hooks/useMutationState'
import { THEME_CONFIGS, type ThemeMode } from '../styles/themeRegistry'

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
  preferenceNotice = null,
  onDismissPreferenceNotice,
  theme,
  onThemeChange,
}: {
  coordinatorState?: DataCoordinatorSnapshot
  onExport: () => Promise<void>
  onImport: (file: File) => Promise<unknown>
  onClear: () => Promise<void>
  onShowOnboardingChecklist: () => Promise<void>
  importPending?: boolean
  profileNotice: string
  preferenceNotice?: string | null
  onDismissPreferenceNotice?: () => void
  theme: ThemeMode
  onThemeChange: (theme: ThemeMode) => void
}) {
  const deleteInputId = useId()
  const deleteHeadingId = useId()
  const [importFeedback, setImportFeedback] = useState<{ tone: 'success' | 'error'; message: string } | null>(null)
  const [clearError, setClearError] = useState<string | null>(null)
  const [resetState, setResetState] = useState<'idle' | 'confirm' | 'deleting'>('idle')
  const [deleteInput, setDeleteInput] = useState('')
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
  const isImportDisabled = importPending || (coordinatorState ? !coordinatorState.canImport : false)
  const isClearDisabled = resetState === 'deleting' || (coordinatorState ? !coordinatorState.canClear : false)

  const noticePhase: MutationPhase = clearError
    ? 'error'
    : preferenceNotice
      ? 'error'
      : onboardingMutation.phase === 'success' || onboardingMutation.phase === 'error'
        ? onboardingMutation.phase
        : exportPhase === 'success' || exportPhase === 'error'
          ? exportPhase
          : importFeedback
            ? importFeedback.tone
            : 'idle'
  const noticeMessage = clearError
    ?? preferenceNotice
    ?? (onboardingMutation.phase === 'success' || onboardingMutation.phase === 'error' ? onboardingMutation.message : null)
    ?? (exportPhase === 'success' || exportPhase === 'error' ? exportMessage : null)
    ?? importFeedback?.message
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
    if (!file) {
      if (event.target) event.target.value = ''
      return
    }
    if (isImportDisabled) {
      if (event.target) event.target.value = ''
      setImportFeedback({ tone: 'error', message: 'A data operation is currently in progress. Please wait.' })
      return
    }

    setClearError(null)
    clearExportFeedback()
    onDismissPreferenceNotice?.()
    try {
      await onImport(file)
      setImportFeedback({ tone: 'success', message: 'Study data imported.' })
    } catch {
      setImportFeedback({ tone: 'error', message: 'Import failed. Choose a valid Study Dashboard export.' })
    } finally {
      if (event.target) event.target.value = ''
    }
  }

  const handleClear = async () => {
    if (deleteInput !== 'DELETE' || isClearDisabled) return
    if (coordinatorState && !coordinatorState.canClear) {
      setClearError('A data operation is currently in progress. Please wait.')
      return
    }
    setClearError(null)
    clearExportFeedback()
    setImportFeedback(null)
    onDismissPreferenceNotice?.()
    setResetState('deleting')
    try {
      await onClear()
      // Success is handled by App.tsx navigating away
    } catch {
      setClearError('Study data could not be cleared. Please try again.')
      setResetState('confirm')
    }
  }

  const handleShowOnboardingChecklist = async () => {
    if (onboardingMutation.isPending || isImportDisabled || resetState === 'deleting') return
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
      {profileNotice ? <p className="settings-feedback" role="status">{profileNotice}</p> : null}
      {coordinatorState?.statusLabel ? (
        <div className="settings-active-operation-status" aria-live="polite">
          {coordinatorState.statusLabel}
        </div>
      ) : null}
      <MutationNotice phase={noticePhase} message={noticeMessage} onDismiss={dismissNotice} />
      <p className="settings-section-description">
        Download an unencrypted JSON backup containing one consistent snapshot of your subjects, tasks, notes, calendar events, study sessions, goals, and supported settings. Active focus-session data is included when present. Changes committed after the snapshot begins may not appear. Device-local appearance and sidebar preferences are excluded.
      </p>
      <div className="card-grid">
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
                  <span className="theme-group-label">{group.label}</span>
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
          disabled={onboardingMutation.isPending || isImportDisabled || resetState === 'deleting'}
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
