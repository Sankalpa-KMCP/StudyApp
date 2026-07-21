import { useRef, useState } from 'react'
import { Download, Upload, Layers3, RotateCcw } from 'lucide-react'
import { MutationNotice, PanelHeader } from '../components/ui'
import { useMutationState, type MutationPhase } from '../hooks/useMutationState'
import type { ThemeMode } from '../App'

const themeOptions: Array<{ id: ThemeMode; label: string; description: string; swatches: string[] }> = [
  { id: 'monochrome', label: 'Monochrome', description: 'Crisp black ink on quiet neutral paper.', swatches: ['#f3f3f1', '#111111', '#6a6a67'] },
  { id: 'light', label: 'Canvas', description: 'Warm paper, forest ink, vermilion details.', swatches: ['#f4f0e8', '#24594d', '#d45a43'] },
  { id: 'blueprint', label: 'Blueprint', description: 'Cool drafting paper with precise navy lines.', swatches: ['#eaf0f5', '#153f73', '#1556c0'] },
  { id: 'moss', label: 'Moss Library', description: 'Olive green, aged paper, and muted brass.', swatches: ['#eee7d6', '#315b3a', '#805d1f'] },
  { id: 'dark', label: 'Midnight', description: 'Inky blue with a soft amber reading light.', swatches: ['#10141d', '#f2b56b', '#72c9c0'] },
  { id: 'aurora', label: 'Aurora', description: 'Deep violet, orchid, and electric mint.', swatches: ['#111323', '#aa8df5', '#55d6c6'] },
  { id: 'ember', label: 'Ember', description: 'Terracotta, parchment, and library blue.', swatches: ['#f3e4d2', '#b74e32', '#496a7d'] },
]

export function SettingsView({
  onExport,
  onImport,
  onClear,
  importPending = false,
  profileNotice,
  preferenceNotice = null,
  onDismissPreferenceNotice,
  theme,
  onThemeChange,
}: {
  onExport: () => Promise<void>
  onImport: (file: File) => Promise<void>
  onClear: () => Promise<void>
  importPending?: boolean
  profileNotice: string
  preferenceNotice?: string | null
  onDismissPreferenceNotice?: () => void
  theme: ThemeMode
  onThemeChange: (theme: ThemeMode) => void
}) {
  const [importFeedback, setImportFeedback] = useState<{ tone: 'success' | 'error'; message: string } | null>(null)
  const [clearError, setClearError] = useState<string | null>(null)
  const [resetState, setResetState] = useState<'idle' | 'confirm' | 'deleting'>('idle')
  const [deleteInput, setDeleteInput] = useState('')
  const themeOptionRefs = useRef<Array<HTMLButtonElement | null>>([])
  const exportMutation = useMutationState()
  const {
    clearFeedback: clearExportFeedback,
    isPending: isExporting,
    phase: exportPhase,
    message: exportMessage,
    run: runExport,
  } = exportMutation

  const noticePhase: MutationPhase = clearError
    ? 'error'
    : preferenceNotice
      ? 'error'
      : exportPhase === 'success' || exportPhase === 'error'
        ? exportPhase
        : importFeedback
          ? importFeedback.tone
          : 'idle'
  const noticeMessage = clearError
    ?? preferenceNotice
    ?? (exportPhase === 'success' || exportPhase === 'error' ? exportMessage : null)
    ?? importFeedback?.message
    ?? null

  const dismissNotice = () => {
    setClearError(null)
    setImportFeedback(null)
    clearExportFeedback()
    onDismissPreferenceNotice?.()
  }

  const handleThemeKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>, index: number) => {
    let nextIndex: number | null = null

    if (event.key === 'ArrowRight' || event.key === 'ArrowDown') nextIndex = (index + 1) % themeOptions.length
    if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') nextIndex = (index - 1 + themeOptions.length) % themeOptions.length
    if (event.key === 'Home') nextIndex = 0
    if (event.key === 'End') nextIndex = themeOptions.length - 1
    if (nextIndex === null) return

    event.preventDefault()
    onThemeChange(themeOptions[nextIndex].id)
    themeOptionRefs.current[nextIndex]?.focus()
  }

  const handleExport = async () => {
    if (isExporting || importPending || resetState === 'deleting') return
    setClearError(null)
    setImportFeedback(null)
    onDismissPreferenceNotice?.()
    await runExport(async () => {
      await onExport()
    }, {
      successMessage: 'Backup exported.',
      errorMessage: 'Backup could not be exported.',
    })
  }

  const handleImport = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file || importPending) {
      event.target.value = ''
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
      event.target.value = ''
    }
  }

  const handleClear = async () => {
    if (deleteInput !== 'DELETE' || resetState === 'deleting') return
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

  return (
    <section className="workspace-panel" aria-labelledby="settings-workspace-title">
      <PanelHeader title="Settings" description="Manage appearance, backups, and local data." />
      {profileNotice ? <p className="settings-feedback" role="status">{profileNotice}</p> : null}
      <MutationNotice phase={noticePhase} message={noticeMessage} onDismiss={dismissNotice} />
      <div className="card-grid">
        <button
          className="action-card"
          type="button"
          onClick={() => void handleExport()}
          disabled={isExporting || importPending}
          aria-busy={isExporting || undefined}
        >
          <Download size={24} aria-hidden="true" />
          <strong>{isExporting ? 'Exporting backup...' : 'Export data'}</strong>
          <span>{isExporting ? 'Preparing your JSON backup.' : 'Download a complete JSON backup.'}</span>
        </button>
        <label className={importPending ? 'action-card import-card is-pending' : 'action-card import-card'} aria-busy={importPending}>
          <Upload size={24} aria-hidden="true" />
          <strong>Import data</strong>
          <span>{importPending ? 'Importing and syncing focus state…' : 'Replace local data from a Study Dashboard backup.'}</span>
          <input
            className="sr-only"
            type="file"
            accept="application/json"
            disabled={importPending || isExporting}
            aria-label="Import data"
            onChange={(event) => void handleImport(event)}
          />
        </label>
        <div className="action-card theme-card">
          <Layers3 size={24} aria-hidden="true" />
          <strong>Appearance</strong>
          <span>Choose a theme for this device.</span>
          <div className="theme-grid" role="radiogroup" aria-label="Theme">
            {themeOptions.map((option, index) => (
              <button
                className={theme === option.id ? 'theme-option is-active' : 'theme-option'}
                type="button"
                role="radio"
                aria-checked={theme === option.id}
                tabIndex={theme === option.id ? 0 : -1}
                key={option.id}
                ref={(element) => { themeOptionRefs.current[index] = element }}
                onClick={() => onThemeChange(option.id)}
                onKeyDown={(event) => handleThemeKeyDown(event, index)}
              >
                <span className="theme-swatches" aria-hidden="true">
                  {option.swatches.map((swatch) => <i style={{ backgroundColor: swatch }} key={swatch} />)}
                </span>
                <span>
                  <strong>{option.label}</strong>
                  <small>{option.description}</small>
                </span>
              </button>
            ))}
          </div>
        </div>
      </div>
      <div className="section-heading danger-heading">
        <h2>Danger zone</h2>
      </div>
      <div className="card-grid danger-zone">
        {resetState === 'idle' ? (
          <button className="action-card danger-card" type="button" onClick={() => { setResetState('confirm'); setClearError(null) }}>
            <RotateCcw size={24} aria-hidden="true" />
            <strong>Reset all study data</strong>
            <span>Permanently deletes local study data on this device.</span>
          </button>
        ) : (
          <div className="action-card danger-card is-confirming" aria-busy={resetState === 'deleting' || undefined}>
            <strong>Confirm data deletion</strong>
            <p>Type DELETE to permanently remove all study data.</p>
            <input
              className="reset-confirm-input"
              type="text"
              value={deleteInput}
              onChange={(e) => setDeleteInput(e.target.value)}
              placeholder="DELETE"
              disabled={resetState === 'deleting'}
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
                disabled={deleteInput !== 'DELETE' || resetState === 'deleting'}
                aria-busy={resetState === 'deleting' || undefined}
                onClick={() => void handleClear()}
              >
                {resetState === 'deleting' ? 'Clearing...' : 'Delete all data'}
              </button>
            </div>
          </div>
        )}
      </div>
    </section>
  )
}
