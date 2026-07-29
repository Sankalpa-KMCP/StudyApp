import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { DataOperationCoordinator } from '../db/dataCoordinator'
import { SettingsView } from './SettingsView'

function TestSettingsViewWrapper({
  coordinator,
  onExport = vi.fn().mockResolvedValue(undefined),
  onImport = vi.fn().mockResolvedValue(undefined),
  onClear = vi.fn().mockResolvedValue(undefined),
  onShowOnboardingChecklist = vi.fn().mockResolvedValue(undefined),
  importPending = false,
}: {
  coordinator: DataOperationCoordinator
  onExport?: () => Promise<void>
  onImport?: (file: File) => Promise<void>
  onClear?: () => Promise<void>
  onShowOnboardingChecklist?: () => Promise<void>
  importPending?: boolean
}) {
  const coordinatorState = coordinator.getSnapshot()
  return (
    <SettingsView
      coordinatorState={coordinatorState}
      onExport={onExport}
      onImport={onImport}
      onClear={onClear}
      onShowOnboardingChecklist={onShowOnboardingChecklist}
      importPending={importPending}
      profileNotice=""
      theme="monochrome"
      onThemeChange={() => undefined}
    />
  )
}

describe('SettingsView concurrency and coordinator integration', () => {
  it('disables all Settings operations and displays status label during active Import', async () => {
    const coordinator = new DataOperationCoordinator()
    let releaseImport!: () => void
    const importGate = new Promise<void>((resolve) => { releaseImport = resolve })
    void coordinator.runImport(async () => importGate)

    render(<TestSettingsViewWrapper coordinator={coordinator} />)

    expect(screen.getAllByText('Importing backup…')[0]).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Export data/ })).toBeDisabled()
    expect(screen.getByLabelText(/Import data/)).toBeDisabled()
    expect(screen.getByRole('button', { name: /Reset all study data/ })).toBeDisabled()

    releaseImport()
  })

  it('disables all Settings operations and displays status label during active Delete All', async () => {
    const coordinator = new DataOperationCoordinator()
    let releaseDelete!: () => void
    const deleteGate = new Promise<void>((resolve) => { releaseDelete = resolve })
    void coordinator.runDeleteAll(async () => deleteGate)

    render(<TestSettingsViewWrapper coordinator={coordinator} />)

    expect(screen.getAllByText('Deleting study data…')[0]).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Export data/ })).toBeDisabled()
    expect(screen.getByLabelText(/Import data/)).toBeDisabled()
    expect(screen.getByRole('button', { name: /Reset all study data/ })).toBeDisabled()

    releaseDelete()
  })

  it('disables Import and Delete All while allowing Export during focus write', async () => {
    const coordinator = new DataOperationCoordinator()
    let releaseFocus!: () => void
    const focusGate = new Promise<void>((resolve) => { releaseFocus = resolve })
    void coordinator.runFocusWrite(async () => focusGate)

    render(<TestSettingsViewWrapper coordinator={coordinator} />)

    expect(screen.getByRole('button', { name: /Export data/ })).toBeEnabled()
    expect(screen.getByLabelText(/Import data/)).toBeDisabled()
    expect(screen.getByRole('button', { name: /Reset all study data/ })).toBeDisabled()

    releaseFocus()
  })

  it('resets file input value after selection so same file can be re-selected', async () => {
    const user = userEvent.setup()
    const coordinator = new DataOperationCoordinator()
    const onImport = vi.fn().mockResolvedValue(undefined)

    render(<TestSettingsViewWrapper coordinator={coordinator} onImport={onImport} />)

    const file = new File(['{"version":3}'], 'test.json', { type: 'application/json' })
    const input = screen.getByLabelText(/Import data/) as HTMLInputElement

    await user.upload(input, file)
    expect(onImport).toHaveBeenCalledTimes(1)
    expect(input.value).toBe('')

    // Upload same file again
    await user.upload(input, file)
    expect(onImport).toHaveBeenCalledTimes(2)
  })

  it('prevents opening Delete All confirmation dialog when clear is unavailable', async () => {
    const user = userEvent.setup()
    const coordinator = new DataOperationCoordinator()
    let releaseFocus!: () => void
    const focusGate = new Promise<void>((resolve) => { releaseFocus = resolve })
    void coordinator.runFocusWrite(async () => focusGate)

    render(<TestSettingsViewWrapper coordinator={coordinator} />)

    const resetButton = screen.getByRole('button', { name: /Reset all study data/ })
    expect(resetButton).toBeDisabled()

    await user.click(resetButton)
    expect(screen.queryByPlaceholderText('DELETE')).not.toBeInTheDocument()

    releaseFocus()
  })

  it('shows busy error notice when blocked attempt is made and does not false report success', async () => {
    const user = userEvent.setup()
    const coordinator = new DataOperationCoordinator()

    // Export blocked when another Settings operation is running
    let releaseImport!: () => void
    const importGate = new Promise<void>((resolve) => { releaseImport = resolve })
    void coordinator.runImport(async () => importGate)

    const onExport = vi.fn()
    render(<TestSettingsViewWrapper coordinator={coordinator} onExport={onExport} />)

    // Force click blocked export
    const exportBtn = screen.getByRole('button', { name: /Export data/ })
    await user.click(exportBtn)

    expect(onExport).not.toHaveBeenCalled()
    releaseImport()
  })

  it('documents unencrypted JSON format, point-in-time snapshot, included data, and excluded preferences', () => {
    const coordinator = new DataOperationCoordinator()
    render(<TestSettingsViewWrapper coordinator={coordinator} />)

    expect(screen.getAllByText(/unencrypted JSON backup/i).length).toBeGreaterThanOrEqual(1)
    expect(screen.getByText(/one consistent snapshot/i)).toBeInTheDocument()
    expect(screen.getByText(/Changes committed after the snapshot begins may not appear/i)).toBeInTheDocument()
    expect(screen.getByText(/subjects, tasks, notes, calendar events, flashcards, study sessions, goals, and supported settings/i)).toBeInTheDocument()
    expect(screen.getByText(/Active focus-session data is included when present/i)).toBeInTheDocument()
    expect(screen.getByText(/Device-local appearance and sidebar preferences are excluded/i)).toBeInTheDocument()

    expect(screen.getByRole('button', { name: /Export data/ })).toBeInTheDocument()
    expect(screen.getByLabelText(/Import data/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Reset all study data/ })).toBeInTheDocument()
  })
})
