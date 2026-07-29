import { useState } from 'react'
import { Download, Upload, CircleUserRound, Layers3, RotateCcw } from 'lucide-react'
import { PanelHeader } from '../components/ui'
import type { ThemeMode } from '../App'

type SettingsFeedback = { tone: 'success' | 'error'; message: string }

const themeOptions: Array<{ id: ThemeMode; label: string; description: string; swatches: string[] }> = [
  { id: 'light', label: 'Dawn', description: 'Clean, bright, and calm.', swatches: ['#f6f8f7', '#126a5a', '#c44924'] },
  { id: 'dark', label: 'Night', description: 'Low glare for deep focus.', swatches: ['#0e1111', '#5ee0c2', '#ff9069'] },
  { id: 'aurora', label: 'Aurora', description: 'Cool energy with a premium glow.', swatches: ['#08111f', '#7dd3fc', '#c084fc'] },
  { id: 'ember', label: 'Ember', description: 'Warm editorial study desk.', swatches: ['#fff4e8', '#9a3412', '#2563eb'] },
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
    if (!window.confirm('Clear all study data? This cannot be undone.')) return

    try {
      await onClear()
      setFeedback({ tone: 'success', message: 'Study data cleared.' })
    } catch {
      setFeedback({ tone: 'error', message: 'Could not clear study data. Try again.' })
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
          <strong>Theme Studio</strong>
          <span>Choose a production palette for the whole workspace.</span>
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
        <button className="action-card danger-card" type="button" onClick={() => void handleClear()}>
          <RotateCcw size={24} aria-hidden="true" />
          <strong>Clear all data</strong>
          <span>Remove tasks, notes, subjects, events, cards, sessions, and goals.</span>
        </button>
      </div>
    </section>
  )
}
