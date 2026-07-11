import { useState } from 'react'
import { Download, Upload, CircleUserRound, Layers3, RotateCcw } from 'lucide-react'
import { PanelHeader } from '../components/ui'
import type { ThemeMode } from '../App'

type SettingsFeedback = { tone: 'success' | 'error'; message: string }

const themeOptions: Array<{ id: ThemeMode; label: string; description: string; swatches: string[] }> = [
  { id: 'light', label: 'Canvas', description: 'Warm paper, forest ink, vermilion details.', swatches: ['#f4f0e8', '#24594d', '#d45a43'] },
  { id: 'dark', label: 'Midnight', description: 'Inky blue with a soft amber reading light.', swatches: ['#10141d', '#f2b56b', '#72c9c0'] },
  { id: 'aurora', label: 'Aurora', description: 'Deep violet, orchid, and electric mint.', swatches: ['#111323', '#aa8df5', '#55d6c6'] },
  { id: 'ember', label: 'Ember', description: 'Terracotta, parchment, and library blue.', swatches: ['#f3e4d2', '#b74e32', '#496a7d'] },
]

export function SettingsView({
  onExport,
  onImport,
  onClear,
  onClearSearch,
  profileNotice,
  theme,
  onThemeChange,
}: {
  onExport: () => void
  onImport: (file: File) => Promise<void>
  onClear: () => Promise<void>
  onClearSearch: () => void
  profileNotice: string
  theme: ThemeMode
  onThemeChange: (theme: ThemeMode) => void
}) {
  const [feedback, setFeedback] = useState<SettingsFeedback | null>(null)
  const [resetState, setResetState] = useState<'idle' | 'confirm' | 'deleting'>('idle')
  const [deleteInput, setDeleteInput] = useState('')

  const handleImport = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    try {
      await onImport(file)
      setFeedback({ tone: 'success', message: 'Study data imported.' })
    } catch {
      setFeedback({ tone: 'error', message: 'Import failed. Choose a valid Study Dashboard export.' })
    } finally {
      event.target.value = ''
    }
  }

  const handleClear = async () => {
    if (deleteInput !== 'DELETE') return
    setResetState('deleting')
    try {
      await onClear()
      // Success is handled by App.tsx navigating away
    } catch {
      setFeedback({ tone: 'error', message: 'Could not clear study data. Try again.' })
      setResetState('idle')
      setDeleteInput('')
    }
  }

  return (
    <section className="workspace-panel" aria-labelledby="settings-workspace-title">
      <PanelHeader title="Settings" actionLabel="Clear search" onAction={onClearSearch} />
      {profileNotice ? <p className="settings-feedback" role="status">{profileNotice}</p> : null}
      {feedback ? (
        <p className={`settings-feedback ${feedback.tone}`} role={feedback.tone === 'error' ? 'alert' : 'status'} aria-live="polite">
          {feedback.message}
        </p>
      ) : null}
      <div className="card-grid">
        <button className="action-card" type="button" onClick={onExport}>
          <Download size={24} aria-hidden="true" />
          <strong>Export data</strong>
          <span>Download an IndexedDB-backed JSON snapshot.</span>
        </button>
        <label className="action-card import-card">
          <Upload size={24} aria-hidden="true" />
          <strong>Import data</strong>
          <span>Restore a previously exported study snapshot.</span>
          <input className="sr-only" type="file" accept="application/json" onChange={(event) => void handleImport(event)} />
        </label>
        <button className="action-card" type="button" onClick={() => onThemeChange(theme === 'dark' ? 'light' : 'dark')}>
          <CircleUserRound size={24} aria-hidden="true" />
          <strong>{theme === 'dark' ? 'Light mode' : 'Dark mode'}</strong>
          <span>Switch the local visual theme for this device.</span>
        </button>
        <div className="action-card theme-card">
          <Layers3 size={24} aria-hidden="true" />
          <strong>Atmosphere</strong>
          <span>Choose the room you want to study in.</span>
          <div className="theme-grid" role="radiogroup" aria-label="Theme">
            {themeOptions.map((option) => (
              <button
                className={theme === option.id ? 'theme-option is-active' : 'theme-option'}
                type="button"
                role="radio"
                aria-checked={theme === option.id}
                key={option.id}
                onClick={() => onThemeChange(option.id)}
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
      <div className="section-heading" style={{ marginTop: '24px' }}>
        <h2>Danger zone</h2>
      </div>
      <div className="card-grid danger-zone">
        {resetState === 'idle' ? (
          <button className="action-card danger-card" type="button" onClick={() => setResetState('confirm')}>
            <RotateCcw size={24} aria-hidden="true" />
            <strong>Reset all study data</strong>
            <span>Permanently deletes local study data on this device.</span>
          </button>
        ) : (
          <div className="action-card danger-card is-confirming">
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
              <button className="secondary-command" type="button" onClick={() => { setResetState('idle'); setDeleteInput('') }} disabled={resetState === 'deleting'}>Cancel</button>
              <button className="primary-command" type="button" disabled={deleteInput !== 'DELETE' || resetState === 'deleting'} onClick={() => void handleClear()}>Delete all data</button>
            </div>
          </div>
        )}
      </div>
    </section>
  )
}
