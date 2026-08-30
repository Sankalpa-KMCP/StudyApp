import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import App from './App'
import { studyDb } from './db/studyDb'
import { flushDeferredAppWork, resetAppTestEnvironment } from './test/appTestSetup'
import { importStudyExport, makeEmptyExport } from './test/backupTestHelpers'

describe('App backup', () => {
  beforeEach(async () => {
    await resetAppTestEnvironment()
  })

  afterEach(async () => {
    await flushDeferredAppWork()
  })

  it('confirms before clearing all study data and reports success', async () => {
    const user = userEvent.setup()

    await studyDb.tasks.add({
      id: 'task-clear-test',
      title: 'Keep until confirmed',
      subjectId: '',
      dueDate: '',
      priority: 'normal',
      status: 'open',
      minutes: 30,
      createdAt: '2026-06-29T00:00:00.000Z',
      updatedAt: '2026-06-29T00:00:00.000Z',
    })
    await studyDb.settings.put({ key: 'quickNotes', value: ['Important quick note'] })

    render(<App />)

    await user.click(await screen.findByRole('button', { name: 'Settings' }))
    const resetBtn = screen.getByRole('button', { name: /Reset all study data/ })
    await user.click(resetBtn)

    // Check Cancel flow
    const cancelBtn = screen.getByRole('button', { name: 'Cancel' })
    await user.click(cancelBtn)

    await user.click(screen.getByRole('button', { name: 'Tasks' }))
    expect(await screen.findByText('Keep until confirmed')).toBeInTheDocument()

    // Now confirm deletion
    await user.click(screen.getByRole('button', { name: 'Settings' }))
    await user.click(screen.getByRole('button', { name: /Reset all study data/ }))

    const confirmInput = screen.getByPlaceholderText('DELETE')
    const deleteBtn = screen.getByRole('button', { name: 'Delete all data' })

    expect(deleteBtn).toBeDisabled()
    await user.type(confirmInput, 'DELETE')
    expect(deleteBtn).not.toBeDisabled()

    await user.click(deleteBtn)

    // Verify success message and redirection to Home (empty state)
    expect(await screen.findByRole('status', { name: '' })).toHaveTextContent('All study data has been permanently deleted.')
    expect(await screen.findByRole('heading', { name: /Good (morning|afternoon|evening)/ })).toBeInTheDocument()

    // Quick notes should be gone
    const quickNotesData = await studyDb.settings.get('quickNotes')
    expect(quickNotesData).toBeUndefined()

    await user.click(screen.getByRole('button', { name: 'Tasks' }))
    await waitFor(() => expect(screen.queryByText('Keep until confirmed')).not.toBeInTheDocument())
  }, 15_000)

  it('handles deletion errors safely', async () => {
    const user = userEvent.setup()

    // Mock the error
    const spy = vi.spyOn(studyDb.tasks, 'clear').mockRejectedValue(new Error('Simulated error'))

    render(<App />)
    await user.click(await screen.findByRole('button', { name: 'Settings' }))
    await user.click(screen.getByRole('button', { name: /Reset all study data/ }))

    await user.type(screen.getByPlaceholderText('DELETE'), 'DELETE')
    await user.click(screen.getByRole('button', { name: 'Delete all data' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('Study data could not be cleared. Please try again.')
    expect(screen.getByPlaceholderText('DELETE')).toHaveValue('DELETE')
    expect(screen.getByRole('button', { name: 'Delete all data' })).toBeEnabled()
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeEnabled()

    spy.mockRestore()
  })

  it('reports import success and failure', async () => {
    const user = userEvent.setup()
    const validExport = makeEmptyExport()

    render(<App />)

    await user.click(await screen.findByRole('button', { name: 'Settings' }))
    const importInput = screen.getByLabelText(/Import data/)

    await user.upload(importInput, new File([JSON.stringify(validExport)], 'study-dashboard.json', { type: 'application/json' }))
    expect(await screen.findByRole('status')).toHaveTextContent('Study data imported.')

    await user.upload(importInput, new File(['not valid json'], 'broken.json', { type: 'application/json' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Import failed. Choose a valid Study Dashboard export.')
  })

  it('shows the onboarding control, restores the checklist, and does not clear study data', async () => {
    const user = userEvent.setup()
    await studyDb.tasks.add({
      id: 'task-onboarding-keep',
      title: 'Keep my task',
      subjectId: '',
      dueDate: '',
      priority: 'normal',
      status: 'open',
      minutes: 20,
      createdAt: '2026-06-29T00:00:00.000Z',
      updatedAt: '2026-06-29T00:00:00.000Z',
    })
    await studyDb.settings.put({ key: 'onboardingChecklistDismissed', value: true })

    render(<App />)
    await user.click(await screen.findByRole('button', { name: 'Settings' }))

    const showButton = screen.getByRole('button', { name: 'Show onboarding checklist' })
    expect(showButton).toBeInTheDocument()
    expect(screen.getByText(/Bring the Home checklist back without changing your saved study data./i)).toBeInTheDocument()

    await user.click(showButton)
    expect(await screen.findByRole('status')).toHaveTextContent('Onboarding checklist will appear on Home.')
    expect(await studyDb.settings.get('onboardingChecklistDismissed')).toBeUndefined()

    await user.click(screen.getByRole('button', { name: 'Home' }))
    expect(await screen.findByRole('region', { name: 'Your first study loop' })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Tasks' }))
    expect(await screen.findByText('Keep my task')).toBeInTheDocument()
  })

  it('keeps the onboarding control disabled while restart is pending and reports failures safely', async () => {
    const user = userEvent.setup()
    vi.spyOn(console, 'error').mockImplementation(() => undefined)
    await studyDb.settings.put({ key: 'onboardingChecklistDismissed', value: true })

    let releaseDelete!: () => void
    const gate = new Promise<void>((resolve) => {
      releaseDelete = resolve
    })
    const deleteSpy = vi.spyOn(studyDb.settings, 'delete').mockImplementation(async (key) => {
      if (key === 'onboardingChecklistDismissed') {
        await gate
        throw new Error('restart failed')
      }
      return Promise.resolve(undefined as never)
    })

    render(<App />)
    await user.click(await screen.findByRole('button', { name: 'Settings' }))
    const showButton = screen.getByRole('button', { name: 'Show onboarding checklist' })
    await user.click(showButton)

    const pendingButton = await screen.findByRole('button', { name: 'Show onboarding checklist' })
    expect(pendingButton).toHaveTextContent('Showing onboarding...')
    expect(pendingButton).toBeDisabled()
    await user.click(pendingButton)
    expect(deleteSpy).toHaveBeenCalledTimes(1)

    releaseDelete()
    expect(await screen.findByRole('alert')).toHaveTextContent('Onboarding checklist could not be shown. Please try again.')
    expect(screen.getByRole('button', { name: 'Show onboarding checklist' })).toBeEnabled()
    expect((await studyDb.settings.get('onboardingChecklistDismissed'))?.value).toBe(true)
  })

  it('import replaces all existing study data', async () => {
    const user = userEvent.setup()
    await studyDb.tasks.add({
      id: 'task-to-replace',
      title: 'Will be replaced',
      subjectId: '',
      dueDate: '',
      priority: 'normal',
      status: 'open',
      minutes: 30,
      createdAt: '2026-06-29T00:00:00.000Z',
      updatedAt: '2026-06-29T00:00:00.000Z',
    })

    render(<App />)

    await importStudyExport(user, makeEmptyExport(), 'empty.json')
    expect(await screen.findByRole('status')).toHaveTextContent('Study data imported.')

    const tasks = await studyDb.tasks.toArray()
    expect(tasks).toHaveLength(0)
  })

  it('exports study data as a JSON file', async () => {
    const user = userEvent.setup()
    render(<App />)

    const createObjectURLMock = vi.fn().mockReturnValue('blob:test-url')
    const revokeObjectURLMock = vi.fn()
    global.URL.createObjectURL = createObjectURLMock
    global.URL.revokeObjectURL = revokeObjectURLMock

    const clickMock = vi.fn()
    const originalCreateElement = document.createElement.bind(document)
    const createElementSpy = vi.spyOn(document, 'createElement').mockImplementation((tagName: string) => {
      if (tagName === 'a') {
        return { click: clickMock, href: '', download: '', setAttribute: vi.fn() } as unknown as HTMLElement
      }
      return originalCreateElement(tagName)
    })

    await screen.findByRole('heading', { name: /Good (morning|afternoon|evening)/ })
    await user.click(screen.getByRole('button', { name: 'Settings' }))
    await user.click(screen.getByText('Export data'))

    await waitFor(() => {
      expect(createObjectURLMock).toHaveBeenCalled()
    })
    expect(clickMock).toHaveBeenCalled()
    expect(revokeObjectURLMock).toHaveBeenCalledWith('blob:test-url')
    const blob = createObjectURLMock.mock.calls[0][0] as Blob
    const exported = JSON.parse(await blob.text()) as { version: number }
    expect(exported.version).toBe(4)
    expect(await screen.findByRole('status')).toHaveTextContent('Backup exported.')

    createElementSpy.mockRestore()
  })

  it('prevents duplicate export while one export is pending', async () => {
    const user = userEvent.setup()
    let releaseExport!: () => void
    const gate = new Promise<void>((resolve) => {
      releaseExport = resolve
    })
    const studyDbModule = await import('./db/studyDb')
    const originalExport = studyDbModule.exportStudyData
    const exportSpy = vi.spyOn(studyDbModule, 'exportStudyData').mockImplementation(async () => {
      await gate
      return originalExport()
    })

    render(<App />)
    await user.click(await screen.findByRole('button', { name: 'Settings' }))

    const createObjectURLMock = vi.fn().mockReturnValue('blob:pending-export')
    const revokeObjectURLMock = vi.fn()
    global.URL.createObjectURL = createObjectURLMock
    global.URL.revokeObjectURL = revokeObjectURLMock
    const originalCreateElement = document.createElement.bind(document)
    const createElementSpy = vi.spyOn(document, 'createElement').mockImplementation((tagName: string) => {
      if (tagName === 'a') {
        return { click: vi.fn(), href: '', download: '', setAttribute: vi.fn() } as unknown as HTMLElement
      }
      return originalCreateElement(tagName)
    })

    await user.click(screen.getByRole('button', { name: /Export data/ }))

    const exportingButton = await screen.findByRole('button', { name: /Creating backup/ })
    expect(exportingButton).toBeDisabled()
    await user.click(exportingButton)
    expect(exportSpy).toHaveBeenCalledTimes(1)

    releaseExport()
    expect(await screen.findByRole('status')).toHaveTextContent('Backup exported.')
    createElementSpy.mockRestore()
  })

  it('shows a friendly error when backup export fails', async () => {
    const user = userEvent.setup()
    vi.spyOn(console, 'error').mockImplementation(() => undefined)
    vi.spyOn(await import('./db/studyDb'), 'exportStudyData').mockRejectedValueOnce(new Error('serialize failed'))

    render(<App />)
    await user.click(await screen.findByRole('button', { name: 'Settings' }))
    await user.click(screen.getByRole('button', { name: /Export data/ }))

    expect(await screen.findByRole('alert')).toHaveTextContent('Backup could not be exported.')
    expect(screen.queryByText(/serialize failed/i)).not.toBeInTheDocument()
  })

  it('keeps clear-all confirmation state when clearing fails and blocks duplicate clears', async () => {
    const user = userEvent.setup()
    vi.spyOn(console, 'error').mockImplementation(() => undefined)
    await studyDb.tasks.add({
      id: 'task-clear-fail',
      title: 'Keep me',
      subjectId: '',
      dueDate: '',
      priority: 'normal',
      status: 'open',
      minutes: 20,
      createdAt: '2026-06-29T00:00:00.000Z',
      updatedAt: '2026-06-29T00:00:00.000Z',
    })

    let releaseClear!: () => void
    const gate = new Promise<void>((resolve) => {
      releaseClear = resolve
    })
    const originalClear = studyDb.tasks.clear.bind(studyDb.tasks)
    const clearSpy = vi.spyOn(studyDb.tasks, 'clear').mockImplementation(async () => {
      await gate
      throw new Error('clear failed')
    })

    render(<App />)
    await user.click(await screen.findByRole('button', { name: 'Settings' }))
    await user.click(screen.getByRole('button', { name: /Reset all study data/ }))
    await user.type(screen.getByPlaceholderText('DELETE'), 'DELETE')
    await user.click(screen.getByRole('button', { name: 'Delete all data' }))

    expect(await screen.findByRole('button', { name: /Deleting study data/ })).toBeDisabled()
    await user.click(screen.getByRole('button', { name: /Deleting study data/ }))
    expect(clearSpy).toHaveBeenCalledTimes(1)

    releaseClear()
    expect(await screen.findByRole('alert')).toHaveTextContent('Study data could not be cleared. Please try again.')
    expect(screen.getByPlaceholderText('DELETE')).toHaveValue('DELETE')
    expect(await studyDb.tasks.count()).toBe(1)

    clearSpy.mockImplementation(async () => originalClear())
    await user.click(screen.getByRole('button', { name: 'Delete all data' }))
    expect(await screen.findByRole('heading', { name: /Good (morning|afternoon|evening)/ })).toBeInTheDocument()
    expect(await studyDb.tasks.count()).toBe(0)
  })

  it('displays exact active-operation status labels and disables controls while a Settings operation is active', async () => {
    const user = userEvent.setup()
    let releaseExport!: () => void
    const exportGate = new Promise<void>((resolve) => {
      releaseExport = resolve
    })
    vi.spyOn(await import('./db/studyDb'), 'exportStudyData').mockImplementationOnce(async () => {
      await exportGate
      return makeEmptyExport()
    })

    render(<App />)
    await user.click(await screen.findByRole('button', { name: 'Settings' }))

    // Trigger Export
    await user.click(screen.getByRole('button', { name: /Export data/ }))

    // Status label should be displayed accessibly
    expect((await screen.findAllByText('Creating backup…'))[0]).toBeInTheDocument()

    // All three Settings data-operation controls should be disabled while export is active
    expect(screen.getByRole('button', { name: /Creating backup/ })).toBeDisabled()
    expect(screen.getByLabelText(/Import data/)).toBeDisabled()
    expect(screen.getByRole('button', { name: /Reset all study data/ })).toBeDisabled()

    releaseExport()

    await waitFor(() => {
      expect(screen.queryByText('Creating backup…')).not.toBeInTheDocument()
    })
    expect(screen.getByRole('button', { name: /Export data/ })).toBeEnabled()
    expect(screen.getByLabelText(/Import data/)).toBeEnabled()
    expect(screen.getByRole('button', { name: /Reset all study data/ })).toBeEnabled()
  })

  it('disables Import and Delete All during an active focus-session write while keeping Export enabled', async () => {
    const user = userEvent.setup()

    // Start a focus write (via activeFocusSession create)
    let releaseFocusWrite!: () => void
    const focusGate = new Promise<void>((resolve) => { releaseFocusWrite = resolve })
    const realCreate = (await import('./db/activeFocusSession')).createActiveFocusSession
    vi.spyOn(await import('./db/activeFocusSession'), 'createActiveFocusSession').mockImplementationOnce(async (session) => {
      await focusGate
      return realCreate(session)
    })

    render(<App />)

    // Start a focus session to acquire focus write lease
    const { waitForFocusStartEnabled } = await import('./test/focusTestHelpers')
    const startBtn = await waitForFocusStartEnabled()
    await user.click(startBtn)

    // Navigate to Settings while focus write is in-flight
    await user.click(screen.getByRole('button', { name: 'Settings' }))

    // Import and Delete All must be disabled during active focus write
    expect(screen.getByLabelText(/Import data/)).toBeDisabled()
    expect(screen.getByRole('button', { name: /Reset all study data/ })).toBeDisabled()

    // Export remains enabled during focus write
    expect(screen.getByRole('button', { name: /Export data/ })).toBeEnabled()

    releaseFocusWrite()
    await waitFor(() => {
      expect(screen.getByLabelText(/Import data/)).toBeEnabled()
    })
    expect(screen.getByRole('button', { name: /Reset all study data/ })).toBeEnabled()
  })

  it('Scenario 49: omitted active focus session in imported backup clears durable IndexedDB setting and resets React UI focus state to idle without creating a study session', async () => {
    const user = userEvent.setup()
    const { createActiveFocusSession } = await import('./db/activeFocusSession')
    const { makeDurableFocusSession, waitForFocusStartEnabled } = await import('./test/focusTestHelpers')

    await createActiveFocusSession(makeDurableFocusSession({
      id: 'focus-omitted-test',
      subjectId: '',
      plannedMinutes: 0,
    }))

    render(<App />)
    expect(await screen.findByRole('button', { name: 'Stop session' })).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Settings' }))
    const validExportNoFocus = makeEmptyExport()

    await importStudyExport(user, validExportNoFocus, 'no-focus.json')
    expect(await screen.findByRole('status')).toHaveTextContent('Study data imported.')

    const focusSetting = await studyDb.settings.get('activeFocusSession')
    expect(focusSetting).toBeUndefined()

    await user.click(screen.getByRole('button', { name: 'Home' }))
    await waitForFocusStartEnabled()
    expect(screen.queryByRole('button', { name: 'Stop session' })).not.toBeInTheDocument()

    expect(await studyDb.studySessions.count()).toBe(0)
  })
})

