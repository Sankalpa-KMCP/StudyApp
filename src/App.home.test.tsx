import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import App from './App'
import { formatHeroDate } from './components/heroDate'
import { getMillisecondsUntilNextLocalMidnight } from './hooks/useCurrentDate'
import { studyDb, clearAllStudyData, getStudyData, importStudyData } from './db/studyDb'
import * as quickNotesService from './db/quickNotesService'
import { flushDeferredAppWork, resetAppTestEnvironment } from './test/appTestSetup'
import {
  addFirstStudyEvent,
  addFirstStudyFocusHistory,
  addFirstStudySession,
  addFirstStudySubject,
  addFirstStudyTask,
} from './test/homeTestHelpers'
import { makeEmptyExport } from './test/backupTestHelpers'
import { ACTIVE_FOCUS_SESSION_KEY, getActiveFocusSession } from './db/activeFocusSession'

describe('App home', () => {
  beforeEach(async () => {
    await resetAppTestEnvironment()
  })

  afterEach(async () => {
    await flushDeferredAppWork()
  })

  it('renders an empty database-backed dashboard shell', async () => {
    render(<App />)

    expect(await screen.findByRole('heading', { name: /Good (morning|afternoon|evening)/ })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Study Tasks' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Weekly Progress' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Home' })).toHaveClass('is-active')
    expect(screen.getByText('No tasks yet')).toBeInTheDocument()
    expect(screen.queryByText('Chemistry lab report')).not.toBeInTheDocument()
    expect(document.documentElement.dataset.theme).toBe('monochrome')
    expect(localStorage.getItem('study-dashboard-theme')).toBe('monochrome')
    expect(document.querySelector('meta[name="theme-color"]')).toHaveAttribute('content', '#111111')

    const checklist = screen.getByRole('region', { name: 'Your first study loop' })
    const progress = within(checklist).getByRole('progressbar', { name: 'First study loop progress' })
    expect(progress).toHaveAttribute('aria-valuenow', '0')
    expect(progress).toHaveAttribute('aria-valuetext', '0 of 3 steps complete')
    expect(within(checklist).getByRole('button', { name: 'Create subject' })).toBeInTheDocument()
    expect(within(checklist).getByRole('button', { name: 'Add task' })).toBeInTheDocument()
    expect(within(checklist).getByRole('button', { name: 'Go to focus' })).toBeInTheDocument()
  })

  it('keeps a single Home h1 and exposes the topbar label outside the heading outline', async () => {
    render(<App />)

    expect(await screen.findByRole('heading', { level: 1, name: /Good (morning|afternoon|evening)/ })).toBeInTheDocument()
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1)
    expect(screen.getByRole('heading', { level: 2, name: 'Study Tasks' })).toBeInTheDocument()

    const topbar = document.querySelector('.topbar')
    expect(topbar).not.toBeNull()
    expect(within(topbar as HTMLElement).getByText('Dashboard')).toBeInTheDocument()
    expect(within(topbar as HTMLElement).queryByRole('heading')).not.toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'Dashboard' })).not.toBeInTheDocument()
  })

  it('derives checklist progress from subjects, tasks, and truthful focus evidence with live updates', async () => {
    await addFirstStudySubject()
    render(<App />)

    const checklist = await screen.findByRole('region', { name: 'Your first study loop' })
    expect(within(checklist).getByRole('progressbar', { name: 'First study loop progress' })).toHaveAttribute('aria-valuenow', '1')
    expect(within(screen.getByRole('heading', { name: 'Create a subject' }).closest('li')! as HTMLElement).getByText('Complete')).toBeInTheDocument()

    await addFirstStudyEvent()
    expect(screen.getByRole('button', { name: 'Add task' })).toBeInTheDocument()

    await addFirstStudyTask()
    await waitFor(() => expect(within(screen.getByRole('region', { name: 'Your first study loop' })).getByRole('progressbar')).toHaveAttribute('aria-valuenow', '2'))

    await studyDb.tasks.delete('first-study-task')
    await waitFor(() => expect(screen.getByRole('button', { name: 'Add task' })).toBeInTheDocument())

    await addFirstStudyTask()
    await waitFor(() => expect(within(screen.getByRole('region', { name: 'Your first study loop' })).getByRole('progressbar')).toHaveAttribute('aria-valuenow', '2'))

    await addFirstStudySession()
    expect(within(screen.getByRole('region', { name: 'Your first study loop' })).getByRole('button', { name: 'Go to focus' })).toBeInTheDocument()

    await addFirstStudyFocusHistory()
    await waitFor(() => expect(screen.queryByRole('region', { name: 'Your first study loop' })).not.toBeInTheDocument())

    await studyDb.studySessions.delete('first-study-session')
    await studyDb.studySessions.delete('focus-first-study')
    expect(await screen.findByRole('region', { name: 'Your first study loop' })).toBeInTheDocument()
    expect(within(screen.getByRole('region', { name: 'Your first study loop' })).getByRole('button', { name: 'Go to focus' })).toBeInTheDocument()
  })

  it('keeps the checklist hidden for existing users who completed the study loop', async () => {
    await addFirstStudySubject()
    await addFirstStudyTask()
    await addFirstStudyFocusHistory()

    render(<App />)

    expect(await screen.findByRole('heading', { name: /Good (morning|afternoon|evening)/ })).toBeInTheDocument()
    expect(screen.queryByRole('region', { name: 'Your first study loop' })).not.toBeInTheDocument()
  })

  it('hides the checklist after dismissal without changing study data or focus state', async () => {
    const user = userEvent.setup()
    render(<App />)

    const before = await getStudyData()
    expect(before.subjects).toHaveLength(0)
    expect(before.tasks).toHaveLength(0)
    expect(before.events).toHaveLength(0)
    expect(before.studySessions).toHaveLength(0)
    expect(await getActiveFocusSession()).toBeNull()

    await user.click(await screen.findByRole('button', { name: 'Hide checklist' }))
    await waitFor(() => expect(screen.queryByRole('region', { name: 'Your first study loop' })).not.toBeInTheDocument())

    expect((await studyDb.settings.get('onboardingChecklistDismissed'))?.value).toBe(true)
    const after = await getStudyData()
    expect(after.subjects).toHaveLength(0)
    expect(after.tasks).toHaveLength(0)
    expect(after.events).toHaveLength(0)
    expect(after.studySessions).toHaveLength(0)
    expect(await getActiveFocusSession()).toBeNull()
  })

  it('preserves dismissal across reload and render restart', async () => {
    const user = userEvent.setup()
    const firstRender = render(<App />)
    await user.click(await screen.findByRole('button', { name: 'Hide checklist' }))
    await waitFor(() => expect(screen.queryByRole('region', { name: 'Your first study loop' })).not.toBeInTheDocument())

    firstRender.unmount()
    render(<App />)

    expect(await screen.findByRole('heading', { name: /Good (morning|afternoon|evening)/ })).toBeInTheDocument()
    expect(screen.queryByRole('region', { name: 'Your first study loop' })).not.toBeInTheDocument()
  })

  it('keeps completed onboarding hidden after restart from Settings', async () => {
    const user = userEvent.setup()
    await addFirstStudySubject()
    await addFirstStudyTask()
    await addFirstStudyFocusHistory()
    await studyDb.settings.put({ key: 'onboardingChecklistDismissed', value: true })

    render(<App />)
    expect(await screen.findByRole('heading', { name: /Good (morning|afternoon|evening)/ })).toBeInTheDocument()
    expect(screen.queryByRole('region', { name: 'Your first study loop' })).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Settings' }))
    await user.click(screen.getByRole('button', { name: 'Show onboarding checklist' }))
    expect(await screen.findByRole('status')).toHaveTextContent('Onboarding checklist will appear on Home.')

    await user.click(screen.getByRole('button', { name: 'Home' }))
    expect(await screen.findByRole('heading', { name: 'Today' })).toBeInTheDocument()
    expect(screen.queryByRole('region', { name: 'Your first study loop' })).not.toBeInTheDocument()
  })

  it('moves focus to Today after keyboard dismissal removes the checklist', async () => {
    const user = userEvent.setup()
    render(<App />)

    const dismissButton = await screen.findByRole('button', { name: 'Hide checklist' })
    dismissButton.focus()
    await user.keyboard('{Enter}')

    await waitFor(() => expect(screen.queryByRole('region', { name: 'Your first study loop' })).not.toBeInTheDocument())
    expect(screen.getByRole('heading', { name: 'Today' })).toHaveFocus()
  })

  it('opens checklist workflows with native keyboard actions and supported focus', async () => {
    const user = userEvent.setup()
    render(<App />)

    const createSubject = within(await screen.findByRole('region', { name: 'Your first study loop' })).getByRole('button', { name: 'Create subject' })
    createSubject.focus()
    await user.keyboard('{Enter}')
    expect(await screen.findByLabelText('Subject name')).toHaveFocus()

    await user.type(screen.getByLabelText('Subject name'), 'Physics')
    await user.click(screen.getByRole('button', { name: 'Save' }))
    await user.click(screen.getByRole('button', { name: 'Home' }))

    const planTask = screen.getByRole('button', { name: 'Add task' })
    planTask.focus()
    await user.keyboard('{Enter}')
    expect(await screen.findByLabelText('Task title')).toHaveFocus()

    await user.click(screen.getByRole('button', { name: 'Home' }))
    const checklist = screen.getByRole('region', { name: 'Your first study loop' })
    const startFocus = within(checklist).getByRole('button', { name: 'Go to focus' })
    startFocus.focus()
    await user.keyboard('{Enter}')

    expect(await screen.findByRole('button', { name: 'Start focus' })).toHaveFocus()
    expect(await getActiveFocusSession()).toBeNull()
    expect(screen.queryByRole('form', { name: 'Log study session' })).not.toBeInTheDocument()
  })

  it('opens new task and subject editors from the home hero', async () => {
    const user = userEvent.setup()
    render(<App />)

    const hero = await screen.findByLabelText('Today overview')
    await user.click(within(hero).getByRole('button', { name: 'Task' }))
    expect(await screen.findByLabelText('Task title')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Home' }))
    await user.click(within(screen.getByLabelText('Today overview')).getByRole('button', { name: 'Subject' }))
    expect(await screen.findByLabelText('Subject name')).toBeInTheDocument()
  })

  it('shows meaningful search results on Home', async () => {
    const user = userEvent.setup()
    await studyDb.subjects.add({
      id: 'subject-search',
      name: 'Biology',
      color: '#0f766e',
      targetHours: 5,
      progress: 20,
      progressMode: 'manual',
      createdAt: '2026-06-29T00:00:00.000Z',
      updatedAt: '2026-06-29T00:00:00.000Z',
    })
    await studyDb.tasks.add({
      id: 'task-search',
      title: 'Cell cycle worksheet',
      subjectId: 'subject-search',
      dueDate: '',
      priority: 'normal',
      status: 'open',
      minutes: 30,
      createdAt: '2026-06-29T00:00:00.000Z',
      updatedAt: '2026-06-29T00:00:00.000Z',
    })

    render(<App />)

    await user.type(await screen.findByPlaceholderText('Search'), 'cell')

    expect(await screen.findByRole('option', { name: /Task.*Cell cycle worksheet/i })).toBeInTheDocument()
  })

  it('keeps Home subject cards and search metadata on the same calculated progress', async () => {
    const user = userEvent.setup()
    await studyDb.subjects.add({
      id: 'subject-consistent',
      name: 'Astronomy',
      color: '#7c3aed',
      targetHours: 2,
      progress: 15,
      progressMode: 'study_time',
      createdAt: '2026-06-29T00:00:00.000Z',
      updatedAt: '2026-06-29T00:00:00.000Z',
    })
    await studyDb.studySessions.add({
      id: 'session-astro',
      subjectId: 'subject-consistent',
      startedAt: '2026-06-29T09:00:00.000Z',
      endedAt: '2026-06-29T10:00:00.000Z',
      minutes: 60,
      note: 'Stars',
    })

    render(<App />)

    const homeSubjects = await screen.findByRole('heading', { name: 'Subjects' })
    expect(within(homeSubjects.closest('section')! as HTMLElement).getByRole('progressbar', { name: '50%' })).toBeInTheDocument()

    await user.type(screen.getByPlaceholderText('Search'), 'Astronomy')
    expect(await screen.findByRole('option', { name: /Subject.*Astronomy.*50% progress/i })).toBeInTheDocument()

    await user.clear(screen.getByPlaceholderText('Search'))
    await user.click(screen.getByRole('button', { name: 'Subjects' }))
    expect(screen.getByRole('progressbar', { name: '50%' })).toBeInTheDocument()
  })

  it('saves quick notes from the home page', async () => {
    render(<App />)

    const textarea = await screen.findByPlaceholderText(/Capture fast ideas/i)
    fireEvent.change(textarea, { target: { value: 'Review chapter 5 for exam' } })
    expect(screen.getByText('Saving...')).toBeInTheDocument()

    await waitFor(async () => {
      const setting = await studyDb.settings.get('quickNotes')
      expect(Array.isArray(setting?.value) ? setting!.value[0] : setting?.value).toContain('Review chapter 5')
    })
    expect(screen.getByText('Saved locally')).toBeInTheDocument()
  })

  it('preserves quick-note drafts on failure and keeps newest write last', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined)
    render(<App />)
    const textarea = await screen.findByPlaceholderText(/Capture fast ideas/i)

    const originalSave = quickNotesService.saveQuickNotes
    let releaseFirst!: () => void
    const firstGate = new Promise<void>((resolve) => {
      releaseFirst = resolve
    })
    const saveSpy = vi.spyOn(quickNotesService, 'saveQuickNotes').mockImplementation(async () => {
      await firstGate
      throw new Error('quick notes write failed')
    })

    fireEvent.change(textarea, { target: { value: 'First draft line' } })
    expect(await screen.findByText('Saving...')).toBeInTheDocument()
    await waitFor(() => expect(saveSpy).toHaveBeenCalled())
    releaseFirst()

    expect(await screen.findByRole('alert')).toHaveTextContent('Quick notes could not be saved. Your text is still available.')
    expect(textarea).toHaveValue('First draft line')

    let olderRelease!: () => void
    let newerRelease!: () => void
    const olderGate = new Promise<void>((resolve) => {
      olderRelease = resolve
    })
    const newerGate = new Promise<void>((resolve) => {
      newerRelease = resolve
    })
    const writes: string[] = []
    saveSpy.mockImplementation(async (value) => {
      if (value.includes('Older')) {
        await olderGate
      } else {
        await newerGate
      }
      writes.push(value)
      return originalSave(value)
    })

    fireEvent.change(textarea, { target: { value: 'Older value' } })
    await waitFor(() => expect(saveSpy).toHaveBeenCalled())
    fireEvent.change(textarea, { target: { value: 'Newer value' } })
    newerRelease()
    olderRelease()

    await waitFor(() => expect(screen.getByText('Saved locally')).toBeInTheDocument())
    expect(writes.at(-1)).toContain('Newer value')
    expect((await studyDb.settings.get('quickNotes'))?.value).toEqual(['Newer value'])
  })

  it('retries the current quick-note draft when Retry save is clicked after a failure', async () => {
    const user = userEvent.setup()
    vi.spyOn(console, 'error').mockImplementation(() => undefined)
    render(<App />)
    const textarea = await screen.findByPlaceholderText(/Capture fast ideas/i)

    const originalSave = quickNotesService.saveQuickNotes
    let shouldFail = true
    const saveSpy = vi.spyOn(quickNotesService, 'saveQuickNotes').mockImplementation(async (value) => {
      if (shouldFail) throw new Error('quick notes write failed')
      return originalSave(value)
    })

    fireEvent.change(textarea, { target: { value: 'Initial failed draft' } })
    expect(await screen.findByRole('alert')).toHaveTextContent('Quick notes could not be saved. Your text is still available.')
    expect(screen.getByRole('button', { name: 'Retry save' })).toBeInTheDocument()

    fireEvent.change(textarea, { target: { value: 'Updated draft after failure' } })
    expect(textarea).toHaveValue('Updated draft after failure')
    expect(await screen.findByRole('button', { name: 'Retry save' })).toBeInTheDocument()

    shouldFail = false
    await user.click(screen.getByRole('button', { name: 'Retry save' }))

    await waitFor(() => expect(screen.getByText('Saved locally')).toBeInTheDocument())
    expect(saveSpy).toHaveBeenCalledWith('Updated draft after failure')
    expect((await studyDb.settings.get('quickNotes'))?.value).toEqual(['Updated draft after failure'])
  })

  it('applies external Quick Notes clears and imports while Home stays mounted', async () => {
    await studyDb.settings.put({ key: 'quickNotes', value: ['mounted note'] })
    render(<App />)
    expect(await screen.findByLabelText('Quick notes')).toHaveValue('mounted note')

    await clearAllStudyData()
    await waitFor(() => expect(screen.getByLabelText('Quick notes')).toHaveValue(''))

    await importStudyData(makeEmptyExport({
      settings: [{ key: 'quickNotes', value: ['imported while mounted'] }],
    }))
    await waitFor(() => {
      expect(screen.getByLabelText('Quick notes')).toHaveValue('imported while mounted')
    })
    expect(screen.getByRole('heading', { name: /Good (morning|afternoon|evening)/ })).toBeInTheDocument()
  })

  it('does not overwrite an unsaved Quick Notes draft when live props change externally', async () => {
    await studyDb.settings.put({ key: 'quickNotes', value: ['persisted'] })
    render(<App />)
    const textarea = await screen.findByLabelText('Quick notes')
    expect(textarea).toHaveValue('persisted')

    fireEvent.change(textarea, { target: { value: 'unsaved local draft' } })
    expect(textarea).toHaveValue('unsaved local draft')

    await studyDb.settings.delete('quickNotes')
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 40))
    })

    expect(textarea).toHaveValue('unsaved local draft')
  })

  it('does not overwrite a queued or in-flight Quick Notes save when live props change', async () => {
    await studyDb.settings.put({ key: 'quickNotes', value: ['seed'] })
    render(<App />)
    const textarea = await screen.findByLabelText('Quick notes')

    let releaseSave!: () => void
    const saveGate = new Promise<void>((resolve) => {
      releaseSave = resolve
    })
    const originalSave = quickNotesService.saveQuickNotes
    const saveSpy = vi.spyOn(quickNotesService, 'saveQuickNotes').mockImplementation(async (value) => {
      await saveGate
      return originalSave(value)
    })

    fireEvent.change(textarea, { target: { value: 'in flight draft' } })
    await waitFor(() => expect(saveSpy).toHaveBeenCalledWith('in flight draft'))
    expect(screen.getByText('Saving...')).toBeInTheDocument()

    await studyDb.settings.put({ key: 'quickNotes', value: ['stale external'] })
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 40))
    })
    expect(textarea).toHaveValue('in flight draft')

    releaseSave()
    await waitFor(() => expect(screen.getByText('Saved locally')).toBeInTheDocument())
    expect(textarea).toHaveValue('in flight draft')
    expect((await studyDb.settings.get('quickNotes'))?.value).toEqual(['in flight draft'])
  })

  it('does not re-persist when a successful local save is echoed by the live query', async () => {
    render(<App />)
    const textarea = await screen.findByLabelText('Quick notes')
    const saveSpy = vi.spyOn(quickNotesService, 'saveQuickNotes')

    fireEvent.change(textarea, { target: { value: 'echo me once' } })
    await waitFor(() => expect(screen.getByText('Saved locally')).toBeInTheDocument())
    expect(saveSpy).toHaveBeenCalledTimes(1)
    const callsAfterSave = saveSpy.mock.calls.length

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 100))
    })
    expect(saveSpy.mock.calls.length).toBe(callsAfterSave)
    expect(textarea).toHaveValue('echo me once')
  })

  it('persists unsaved quick-note draft when navigating away before debounce timeout', async () => {
    const user = userEvent.setup()
    render(<App />)
    const textarea = await screen.findByLabelText('Quick notes')
    const saveSpy = vi.spyOn(quickNotesService, 'saveQuickNotes')

    fireEvent.change(textarea, { target: { value: 'Fast typed note before navigation' } })

    // Immediately navigate away before the 250ms debounce fires
    await user.click(screen.getByRole('button', { name: /^Tasks\b/i }))
    expect(await screen.findByRole('heading', { name: 'Tasks', level: 1 })).toBeInTheDocument()

    // Verify save occurred on unmount
    await waitFor(() => expect(saveSpy).toHaveBeenCalledWith('Fast typed note before navigation'))
    expect((await studyDb.settings.get('quickNotes'))?.value).toEqual(['Fast typed note before navigation'])

    // Navigate back to Dashboard/Home and verify the draft is restored
    await user.click(screen.getByRole('button', { name: /^Home\b/i }))
    const restoredTextarea = await screen.findByLabelText('Quick notes')
    expect(restoredTextarea).toHaveValue('Fast typed note before navigation')
  })

  it('persists quick-note draft when clicking Open Notes button before debounce timeout', async () => {
    const user = userEvent.setup()
    render(<App />)
    const textarea = await screen.findByLabelText('Quick notes')
    const saveSpy = vi.spyOn(quickNotesService, 'saveQuickNotes')

    fireEvent.change(textarea, { target: { value: 'Idea to expand in notes' } })

    // Click Open Notes inside the card immediately
    await user.click(screen.getByRole('button', { name: 'Open Notes' }))
    expect(await screen.findByRole('heading', { name: 'Notes', level: 1 })).toBeInTheDocument()

    await waitFor(() => expect(saveSpy).toHaveBeenCalledWith('Idea to expand in notes'))
    expect((await studyDb.settings.get('quickNotes'))?.value).toEqual(['Idea to expand in notes'])
  })

  it('persists latest draft when an older save is in flight during unmount', async () => {
    const user = userEvent.setup()
    render(<App />)
    const textarea = await screen.findByLabelText('Quick notes')

    let releaseFirstSave!: () => void
    const firstSaveGate = new Promise<void>((resolve) => {
      releaseFirstSave = resolve
    })
    const originalSave = quickNotesService.saveQuickNotes
    const writes: string[] = []
    const saveSpy = vi.spyOn(quickNotesService, 'saveQuickNotes').mockImplementation(async (value) => {
      if (value.includes('First draft')) {
        await firstSaveGate
      }
      writes.push(value)
      return originalSave(value)
    })

    // Start first save (which enters in-flight)
    fireEvent.change(textarea, { target: { value: 'First draft' } })
    await waitFor(() => expect(saveSpy).toHaveBeenCalledWith('First draft'))

    // User types second draft while first save is still in flight
    fireEvent.change(textarea, { target: { value: 'Second newer draft' } })

    // User navigates away before debounce or first save finishes
    await user.click(screen.getByRole('button', { name: /^Tasks\b/i }))
    expect(await screen.findByRole('heading', { name: 'Tasks', level: 1 })).toBeInTheDocument()

    // Release first save
    releaseFirstSave()

    // Verify queue processed the second write after the first
    await waitFor(() => expect(writes).toContain('Second newer draft'))
    expect((await studyDb.settings.get('quickNotes'))?.value).toEqual(['Second newer draft'])
  })

  it('does not trigger redundant write on unmount if draft was already persisted', async () => {
    const user = userEvent.setup()
    render(<App />)
    const textarea = await screen.findByLabelText('Quick notes')
    const saveSpy = vi.spyOn(quickNotesService, 'saveQuickNotes')

    fireEvent.change(textarea, { target: { value: 'Already persisted note' } })
    await waitFor(() => expect(screen.getByText('Saved locally')).toBeInTheDocument())
    expect(saveSpy).toHaveBeenCalledTimes(1)

    // Navigate away when text is already saved
    await user.click(screen.getByRole('button', { name: /^Tasks\b/i }))
    expect(await screen.findByRole('heading', { name: 'Tasks', level: 1 })).toBeInTheDocument()

    // No extra save call occurred
    expect(saveSpy).toHaveBeenCalledTimes(1)
  })

  it('flushes unsaved draft immediately on textarea blur', async () => {
    render(<App />)
    const textarea = await screen.findByLabelText('Quick notes')
    const saveSpy = vi.spyOn(quickNotesService, 'saveQuickNotes')

    fireEvent.change(textarea, { target: { value: 'Blurred note' } })
    expect(saveSpy).not.toHaveBeenCalled()

    fireEvent.blur(textarea)
    await waitFor(() => expect(saveSpy).toHaveBeenCalledWith('Blurred note'))
    expect((await studyDb.settings.get('quickNotes'))?.value).toEqual(['Blurred note'])
  })

  it('clears search when no results are found', async () => {
    const user = userEvent.setup()
    render(<App />)

    await screen.findByRole('heading', { name: /Good (morning|afternoon|evening)/ })

    // Navigate to tasks
    await user.click(screen.getByRole('button', { name: 'Tasks' }))

    // Search for something that doesn't exist
    const searchInput = screen.getByPlaceholderText('Search')
    await user.type(searchInput, 'nonexistentterm')

    // Click the "Clear search" button that appears in the empty state
    // We should have multiple clear search buttons since we are in a view, let's just click the one in the main area if possible, or any.
    // The Topbar has one, and the empty state has one. The empty state one is usually what users click when there's no results.
    const clearButtons = screen.getAllByRole('button', { name: 'Clear search' })
    await user.click(clearButtons[clearButtons.length - 1])

    expect(searchInput).toHaveValue('')
  })

  it('does not recalculate today metrics before local midnight', async () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    const beforeMidnight = new Date(2026, 6, 13, 23, 0, 0, 0)
    vi.setSystemTime(beforeMidnight)

    const midnightCallbacks: Array<() => void> = []
    const nativeSetTimeout = globalThis.setTimeout.bind(globalThis)
    const nativeClearTimeout = globalThis.clearTimeout.bind(globalThis)
    vi.spyOn(globalThis, 'setTimeout').mockImplementation(((handler: TimerHandler, delay?: number, ...args: unknown[]) => {
      if (typeof handler === 'function' && typeof delay === 'number' && delay >= 60_000) {
        midnightCallbacks.push(() => {
          handler(...args)
        })
        return 90_001 as unknown as ReturnType<typeof setTimeout>
      }
      return nativeSetTimeout(handler, delay, ...args)
    }) as typeof setTimeout)
    vi.spyOn(globalThis, 'clearTimeout').mockImplementation(((id?: number | NodeJS.Timeout) => {
      if (id === 90_001) return
      return nativeClearTimeout(id as Parameters<typeof nativeClearTimeout>[0])
    }) as typeof clearTimeout)

    await studyDb.studySessions.add({
      id: 'session-before-midnight',
      subjectId: '',
      startedAt: new Date(2026, 6, 13, 10, 0).toISOString(),
      endedAt: new Date(2026, 6, 13, 10, 45).toISOString(),
      minutes: 45,
      note: '',
    })

    render(<App />)
    await screen.findByRole('heading', { name: /Good (morning|afternoon|evening)/ })
    expect(midnightCallbacks).toHaveLength(1)

    const hero = screen.getByLabelText('Today overview')
    expect(within(hero).getByText('45m')).toBeInTheDocument()
    expect(within(hero).getByText(formatHeroDate(beforeMidnight))).toBeInTheDocument()
    expect(within(hero).getByRole('heading', { level: 1, name: 'Good evening' })).toBeInTheDocument()
    expect(within(screen.getByRole('region', { name: 'Streak' })).getByText('1')).toBeInTheDocument()

    // Wall clock approaches midnight without firing the rollover callback.
    vi.setSystemTime(new Date(beforeMidnight.getTime() + getMillisecondsUntilNextLocalMidnight(beforeMidnight) - 1))

    expect(within(hero).getByText('45m')).toBeInTheDocument()
    expect(within(hero).getByText(formatHeroDate(beforeMidnight))).toBeInTheDocument()
    expect(within(hero).getByRole('heading', { level: 1, name: 'Good evening' })).toBeInTheDocument()
    expect(within(screen.getByRole('region', { name: 'Streak' })).getByText('1')).toBeInTheDocument()
  })

  it('recalculates today focus, weekly window, upcoming, and streak after local midnight without mutating data', async () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    const beforeMidnight = new Date(2026, 6, 13, 23, 0, 0, 0)
    vi.setSystemTime(beforeMidnight)

    const midnightCallbacks: Array<() => void> = []
    const nativeSetTimeout = globalThis.setTimeout.bind(globalThis)
    const nativeClearTimeout = globalThis.clearTimeout.bind(globalThis)
    vi.spyOn(globalThis, 'setTimeout').mockImplementation(((handler: TimerHandler, delay?: number, ...args: unknown[]) => {
      if (typeof handler === 'function' && typeof delay === 'number' && delay >= 60_000) {
        midnightCallbacks.push(() => {
          handler(...args)
        })
        return 90_001 as unknown as ReturnType<typeof setTimeout>
      }
      return nativeSetTimeout(handler, delay, ...args)
    }) as typeof setTimeout)
    vi.spyOn(globalThis, 'clearTimeout').mockImplementation(((id?: number | NodeJS.Timeout) => {
      if (id === 90_001) return
      return nativeClearTimeout(id as Parameters<typeof nativeClearTimeout>[0])
    }) as typeof clearTimeout)

    await studyDb.studySessions.add({
      id: 'session-rollover-day',
      subjectId: '',
      startedAt: new Date(2026, 6, 13, 10, 0).toISOString(),
      endedAt: new Date(2026, 6, 13, 10, 45).toISOString(),
      minutes: 45,
      note: '',
    })
    await studyDb.events.add({
      id: 'event-rollover-morning',
      title: 'Morning review',
      subjectId: '',
      startAt: new Date(2026, 6, 13, 9, 0).toISOString(),
      endAt: new Date(2026, 6, 13, 10, 0).toISOString(),
      location: '',
      createdAt: new Date(2026, 6, 13, 8, 0).toISOString(),
      updatedAt: new Date(2026, 6, 13, 8, 0).toISOString(),
    })

    render(<App />)
    await screen.findByRole('heading', { name: /Good (morning|afternoon|evening)/ })
    expect(midnightCallbacks).toHaveLength(1)

    const hero = screen.getByLabelText('Today overview')
    const rightColumn = screen.getByRole('complementary', { name: 'Progress and schedule' })
    expect(within(hero).getByText('45m')).toBeInTheDocument()
    expect(within(hero).getByText(formatHeroDate(beforeMidnight))).toBeInTheDocument()
    expect(within(hero).getByRole('heading', { level: 1, name: 'Good evening' })).toBeInTheDocument()
    expect(within(rightColumn).getByText('Morning review')).toBeInTheDocument()
    expect(within(screen.getByRole('region', { name: 'Streak' })).getByText('1')).toBeInTheDocument()

    const weeklyBeforeLabels = within(screen.getByRole('region', { name: 'Weekly Progress' }))
      .getAllByText(/^(Sun|Mon|Tue|Wed|Thu|Fri|Sat)$/)
    expect(weeklyBeforeLabels.at(-1)).toHaveTextContent(
      new Intl.DateTimeFormat('en-US', { weekday: 'short' }).format(beforeMidnight),
    )

    const sessionCountBefore = await studyDb.studySessions.count()
    const eventCountBefore = await studyDb.events.count()

    const afterMidnight = new Date(2026, 6, 14, 0, 0, 0, 0)
    vi.setSystemTime(afterMidnight)
    await act(async () => {
      midnightCallbacks[0]!()
    })

    expect(within(hero).getByText('0m')).toBeInTheDocument()
    expect(within(hero).getByText(formatHeroDate(afterMidnight))).toBeInTheDocument()
    expect(within(hero).queryByText(formatHeroDate(beforeMidnight))).not.toBeInTheDocument()
    expect(within(hero).getByRole('heading', { level: 1, name: 'Good morning' })).toBeInTheDocument()
    expect(within(rightColumn).queryByText('Morning review')).not.toBeInTheDocument()
    expect(within(screen.getByRole('region', { name: 'Streak' })).getByText('0')).toBeInTheDocument()

    const weeklyAfterLabels = within(screen.getByRole('region', { name: 'Weekly Progress' }))
      .getAllByText(/^(Sun|Mon|Tue|Wed|Thu|Fri|Sat)$/)
    expect(weeklyAfterLabels.at(-1)).toHaveTextContent(
      new Intl.DateTimeFormat('en-US', { weekday: 'short' }).format(afterMidnight),
    )

    expect(await studyDb.studySessions.count()).toBe(sessionCountBefore)
    expect(await studyDb.events.count()).toBe(eventCountBefore)
  })

  it('exposes the weekly progress bar chart as a named non-interactive image', async () => {
    render(<App />)

    expect(await screen.findByRole('heading', { name: 'Weekly Progress' })).toBeInTheDocument()
    const chart = screen.getByRole('img', { name: 'Weekly progress by day' })
    expect(chart).toHaveClass('bar-chart')
    expect(chart).not.toHaveAttribute('tabindex')
    expect(chart.tabIndex).toBeLessThan(0)
    expect(within(chart).queryByRole('button')).not.toBeInTheDocument()
    expect(document.querySelector('.bar-days')).toHaveAttribute('aria-hidden', 'true')
  })

  it('exposes the Study Time line chart as a named non-interactive image', async () => {
    render(<App />)

    expect(await screen.findByRole('heading', { name: 'Study Time' })).toBeInTheDocument()
    const chart = screen.getByRole('img', { name: 'Study time trend' })
    expect(chart).toHaveClass('line-chart')
    expect(chart).not.toHaveAttribute('tabindex')
    expect(chart.tabIndex).toBeLessThan(0)
    expect(within(chart).queryByRole('button')).not.toBeInTheDocument()
    expect(within(chart).queryByRole('img')).not.toBeInTheDocument()
    expect(chart.querySelector('svg')).toHaveAttribute('aria-hidden', 'true')
    expect(document.querySelector('.line-days')).toHaveAttribute('aria-hidden', 'true')
  })

  it('shows actionable Today metrics and recommends create-subject on an empty database', async () => {
    const user = userEvent.setup()
    render(<App />)

    expect(await screen.findByRole('heading', { name: 'Today' })).toBeInTheDocument()
    const today = screen.getByRole('heading', { name: 'Today' }).closest('section') as HTMLElement
    expect(within(today).getByRole('listitem', { name: '0 tasks due today' })).toHaveTextContent('0')
    expect(within(today).getByRole('listitem', { name: '0 overdue tasks' })).toHaveTextContent('0')
    expect(within(today).getByRole('listitem', { name: '0 events today' })).toHaveTextContent('0')
    expect(within(today).getByRole('listitem', { name: '0 day study streak' })).toHaveTextContent('0')
    expect(within(today).getByText('Recommended next')).toBeInTheDocument()
    expect(within(today).getByRole('heading', { name: 'Create a subject' })).toBeInTheDocument()

    await user.click(within(today).getByRole('button', { name: 'Create subject' }))
    expect(await screen.findByLabelText('Subject name')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Subjects', level: 1 })).toBeInTheDocument()
  })

  it('surfaces due-today, overdue, event, streak, and week focus with a task recommendation', async () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    const now = new Date(2026, 6, 26, 15, 0, 0, 0)
    vi.setSystemTime(now)
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })

    await studyDb.subjects.add({
      id: 'dash-subject',
      name: 'Biology',
      color: '#2563eb',
      targetHours: 2,
      progress: 0,
      progressMode: 'manual',
      createdAt: '2026-07-01T00:00:00.000Z',
      updatedAt: '2026-07-01T00:00:00.000Z',
    })
    await studyDb.tasks.bulkAdd([
      {
        id: 'task-overdue',
        title: 'Overdue lab writeup',
        subjectId: 'dash-subject',
        dueDate: '2026-07-25',
        priority: 'normal',
        status: 'open',
        minutes: 40,
        createdAt: '2026-07-01T00:00:00.000Z',
        updatedAt: '2026-07-01T00:00:00.000Z',
      },
      {
        id: 'task-today',
        title: 'Due today reading',
        subjectId: 'dash-subject',
        dueDate: '2026-07-26',
        priority: 'normal',
        status: 'open',
        minutes: 25,
        createdAt: '2026-07-02T00:00:00.000Z',
        updatedAt: '2026-07-02T00:00:00.000Z',
      },
      {
        id: 'task-done-today',
        title: 'Finished today',
        subjectId: 'dash-subject',
        dueDate: '2026-07-26',
        priority: 'normal',
        status: 'done',
        minutes: 20,
        createdAt: '2026-07-03T00:00:00.000Z',
        updatedAt: '2026-07-03T00:00:00.000Z',
      },
      {
        id: 'task-tomorrow',
        title: 'Tomorrow task',
        subjectId: 'dash-subject',
        dueDate: '2026-07-27',
        priority: 'normal',
        status: 'open',
        minutes: 20,
        createdAt: '2026-07-04T00:00:00.000Z',
        updatedAt: '2026-07-04T00:00:00.000Z',
      },
    ])
    await studyDb.events.bulkAdd([
      {
        id: 'event-today',
        title: 'Lab block',
        subjectId: 'dash-subject',
        startAt: new Date(2026, 6, 26, 11, 0).toISOString(),
        endAt: new Date(2026, 6, 26, 12, 0).toISOString(),
        location: '',
        createdAt: '2026-07-01T00:00:00.000Z',
        updatedAt: '2026-07-01T00:00:00.000Z',
      },
      {
        id: 'event-tomorrow',
        title: 'Tomorrow seminar',
        subjectId: 'dash-subject',
        startAt: new Date(2026, 6, 27, 11, 0).toISOString(),
        endAt: new Date(2026, 6, 27, 12, 0).toISOString(),
        location: '',
        createdAt: '2026-07-01T00:00:00.000Z',
        updatedAt: '2026-07-01T00:00:00.000Z',
      },
    ])
    await studyDb.studySessions.add({
      id: 'session-today',
      subjectId: 'dash-subject',
      startedAt: new Date(2026, 6, 26, 9, 0).toISOString(),
      endedAt: new Date(2026, 6, 26, 9, 45).toISOString(),
      minutes: 45,
      note: '',
    })

    render(<App />)
    const today = (await screen.findByRole('heading', { name: 'Today' })).closest('section') as HTMLElement
    expect(within(today).getByRole('listitem', { name: '1 tasks due today' })).toHaveTextContent('1')
    expect(within(today).getByRole('listitem', { name: '1 overdue tasks' })).toHaveTextContent('1')
    expect(within(today).getByRole('listitem', { name: '1 events today' })).toHaveTextContent('1')
    expect(within(today).getByRole('listitem', { name: '1 day study streak' })).toHaveTextContent('1')
    expect(within(today).getByRole('listitem', { name: /focus in the last seven days/i })).toHaveTextContent('0h 45m')
    expect(within(today).getByText('Overdue lab writeup')).toBeInTheDocument()
    expect(within(today).getByText('Lab block')).toBeInTheDocument()
    expect(within(today).queryByText('Tomorrow seminar')).not.toBeInTheDocument()
    expect(within(today).queryByText('Finished today')).not.toBeInTheDocument()
    expect(within(today).getByRole('heading', { name: 'Overdue task' })).toBeInTheDocument()
    expect(within(today).getByText(/Catch up on "Overdue lab writeup"/)).toBeInTheDocument()

    await user.click(within(today).getByRole('button', { name: 'Open Tasks' }))
    expect(await screen.findByRole('heading', { name: 'Tasks', level: 1 })).toBeInTheDocument()
    expect(screen.getByText('Overdue lab writeup')).toBeInTheDocument()
    expect(screen.queryByLabelText('Task title')).not.toBeInTheDocument()
  })

  it('recommends continuing an active focus session without mutating it', async () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date(2026, 6, 26, 15, 0, 0, 0))
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })

    await addFirstStudySubject()
    await studyDb.settings.put({
      key: ACTIVE_FOCUS_SESSION_KEY,
      value: {
        id: 'focus-dash',
        subjectId: 'first-study-subject',
        startedAt: new Date(2026, 6, 26, 14, 55).toISOString(),
        plannedMinutes: 0,
        status: 'running',
        pausedAt: null,
        accumulatedPausedMs: 0,
      },
    })

    render(<App />)
    const today = (await screen.findByRole('heading', { name: 'Today' })).closest('section') as HTMLElement
    expect(within(today).getByRole('heading', { name: 'Focus in progress' })).toBeInTheDocument()

    await user.click(within(today).getByRole('button', { name: 'Go to focus' }))
    expect(screen.getByRole('button', { name: 'Pause' })).toHaveFocus()
    expect(await getActiveFocusSession()).toMatchObject({ id: 'focus-dash', status: 'running', plannedMinutes: 0 })
  })

  it('keeps FocusCard and Quick Notes on the actionable Home dashboard', async () => {
    render(<App />)
    expect(await screen.findByRole('heading', { name: 'Today' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Focus session' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Quick Notes' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Weekly Progress' })).toBeInTheDocument()
  })
})
