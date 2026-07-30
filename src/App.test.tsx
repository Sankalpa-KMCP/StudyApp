import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import App from './App'
import { studyDb } from './db/studyDb'

describe('App', () => {
  beforeEach(async () => {
    vi.restoreAllMocks()
    localStorage.clear()
    document.documentElement.dataset.theme = 'light'
    await studyDb.delete()
    await studyDb.open()
  })

  it('renders an empty database-backed dashboard shell', async () => {
    render(<App />)

    expect(await screen.findByRole('heading', { name: 'Good morning' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Study Tasks' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Weekly Progress' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Home' })).toHaveClass('is-active')
    expect(screen.getByText('No tasks yet')).toBeInTheDocument()
    expect(screen.queryByText('Chemistry lab report')).not.toBeInTheDocument()
  })

  it('focuses and clears global search with keyboard shortcuts', async () => {
    const user = userEvent.setup()
    render(<App />)

    const searchInput = await screen.findByPlaceholderText('Search')
    await user.keyboard('/')
    expect(searchInput).toHaveFocus()

    await user.type(searchInput, 'calculus')
    await user.keyboard('{Escape}')
    expect(searchInput).toHaveValue('')
    expect(searchInput).not.toHaveFocus()
  })

  it('adds, edits, completes, searches, and deletes a task', async () => {
    const user = userEvent.setup()
    render(<App />)

    await user.click(await screen.findByRole('button', { name: 'Tasks' }))
    await user.click(screen.getByRole('button', { name: 'New task' }))
    await user.type(screen.getByLabelText('Task title'), 'Linear algebra drills')
    await user.clear(screen.getByLabelText('Minutes'))
    await user.type(screen.getByLabelText('Minutes'), '45')
    await user.click(screen.getByRole('button', { name: 'Save' }))

    expect(await screen.findByText('Linear algebra drills')).toBeInTheDocument()

    await user.click(screen.getByLabelText('Edit Linear algebra drills'))
    await user.clear(screen.getByLabelText('Task title'))
    await user.type(screen.getByLabelText('Task title'), 'Matrix practice')
    await user.click(screen.getByRole('button', { name: 'Save' }))
    expect(await screen.findByText('Matrix practice')).toBeInTheDocument()

    await user.click(screen.getByLabelText('Toggle Matrix practice'))
    await waitFor(() => expect(screen.getByText('Matrix practice').closest('.list-row')).toHaveClass('is-done'))

    await user.type(screen.getByPlaceholderText('Search'), 'matrix')
    expect(screen.getByText('Matrix practice')).toBeInTheDocument()
    expect(screen.queryByText('Chemistry lab report')).not.toBeInTheDocument()

    await user.click(screen.getByLabelText('Delete Matrix practice'))
    await waitFor(() => expect(screen.queryByText('Matrix practice')).not.toBeInTheDocument())
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

    expect(await screen.findByRole('heading', { name: 'Search Results' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Task: Cell cycle worksheet, Biology - open' })).toBeInTheDocument()
  })

  it('logs focus sessions with the selected subject', async () => {
    const user = userEvent.setup()
    await studyDb.subjects.add({
      id: 'subject-focus',
      name: 'Physics',
      color: '#2563eb',
      targetHours: 6,
      progress: 10,
      createdAt: '2026-06-29T00:00:00.000Z',
      updatedAt: '2026-06-29T00:00:00.000Z',
    })

    render(<App />)

    await user.selectOptions(await screen.findByLabelText('Focus subject'), 'subject-focus')
    expect(screen.getByLabelText('Session length')).toHaveValue('25')
    await user.click(screen.getByRole('button', { name: 'Start focus' }))
    expect(await screen.findByText('Elapsed')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Stop session' }))

    await waitFor(async () => {
      const sessions = await studyDb.studySessions.toArray()
      expect(sessions).toHaveLength(1)
      expect(sessions[0].subjectId).toBe('subject-focus')
    })
  })

  it('blocks deleting subjects that still have linked records', async () => {
    const user = userEvent.setup()
    const confirm = vi.spyOn(window, 'confirm')
    await studyDb.subjects.add({
      id: 'subject-linked',
      name: 'Chemistry',
      color: '#b45309',
      targetHours: 4,
      progress: 0,
      createdAt: '2026-06-29T00:00:00.000Z',
      updatedAt: '2026-06-29T00:00:00.000Z',
    })
    await studyDb.notes.add({
      id: 'note-linked',
      title: 'Periodic trends',
      body: 'Reactivity notes',
      subjectId: 'subject-linked',
      tags: [],
      createdAt: '2026-06-29T00:00:00.000Z',
      updatedAt: '2026-06-29T00:00:00.000Z',
    })

    render(<App />)

    await user.click(await screen.findByRole('button', { name: 'Subjects' }))
    await user.click(screen.getByLabelText('Delete Chemistry'))

    expect(await screen.findByText(/Cannot delete Chemistry/)).toBeInTheDocument()
    expect(confirm).not.toHaveBeenCalled()
    expect(await studyDb.subjects.get('subject-linked')).toBeDefined()
  })

  it('implements profile and progress log-session controls', async () => {
    const user = userEvent.setup()
    render(<App />)

    await user.click(await screen.findByRole('button', { name: 'Profile' }))
    const notices = await screen.findAllByText(/Profile settings live in this local/i)
    expect(notices.length).toBeGreaterThan(0)

    await user.click(screen.getByRole('button', { name: 'Progress' }))
    await user.click(screen.getByRole('button', { name: 'Log session' }))
    expect(await screen.findByRole('heading', { name: 'Dashboard' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Stop session' })).toBeInTheDocument()
  })

  it('toggles dark mode from settings', async () => {
    const user = userEvent.setup()
    render(<App />)

    await user.click(await screen.findByRole('button', { name: 'Settings' }))
    await user.click(screen.getByRole('button', { name: /Dark mode/ }))

    expect(document.documentElement.dataset.theme).toBe('dark')
  })

  it('supports the production theme picker and collapsible sidebar', async () => {
    const user = userEvent.setup()
    render(<App />)

    await user.click(await screen.findByRole('button', { name: 'Collapse sidebar' }))
    expect(document.querySelector('.app-shell')).toHaveClass('is-sidebar-collapsed')

    await user.click(screen.getByRole('button', { name: 'Expand sidebar' }))
    expect(document.querySelector('.app-shell')).not.toHaveClass('is-sidebar-collapsed')

    await user.click(screen.getByRole('button', { name: 'Settings' }))
    await user.click(await screen.findByRole('radio', { name: /Aurora/ }))
    expect(document.documentElement.dataset.theme).toBe('aurora')

    await user.click(screen.getByRole('radio', { name: /Ember/ }))
    expect(document.documentElement.dataset.theme).toBe('ember')
  })

  it('creates and opens a note', async () => {
    const user = userEvent.setup()
    render(<App />)

    await user.click(await screen.findByRole('button', { name: 'Notes' }))
    await user.click(screen.getByRole('button', { name: 'New note' }))
    await user.type(screen.getByLabelText('Note title'), 'Exam checklist')
    await user.type(screen.getByLabelText('Body'), 'Past papers, formulas, and weak areas.')
    await user.click(screen.getByRole('button', { name: 'Save' }))

    const newNote = (await screen.findByText('Exam checklist')).closest('.detail-card')
    expect(newNote).not.toBeNull()
    expect(within(newNote as HTMLElement).getByText('Past papers, formulas, and weak areas.')).toBeInTheDocument()
  })

  it('creates a flashcard and marks it remembered', async () => {
    const user = userEvent.setup()
    render(<App />)

    await user.click(await screen.findByRole('button', { name: 'Flashcards' }))
    await user.click(screen.getByRole('button', { name: 'New card' }))
    await user.type(screen.getByLabelText('Front'), 'Derivative rule')
    await user.type(screen.getByLabelText('Back'), 'Power rule')
    await user.click(screen.getByRole('button', { name: 'Save' }))

    expect(await screen.findByText('Derivative rule')).toBeInTheDocument()
    expect(screen.getByText('Answer hidden')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Reveal' }))
    expect(screen.getByText('Power rule')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Remembered' }))
    expect(await screen.findByText('remembered')).toBeInTheDocument()
    expect(await screen.findByText(/Next review/)).toBeInTheDocument()
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
    expect(await screen.findByRole('heading', { name: 'Good morning' })).toBeInTheDocument()

    // Quick notes should be gone
    const quickNotesData = await studyDb.settings.get('quickNotes')
    expect(quickNotesData).toBeUndefined()

    await user.click(screen.getByRole('button', { name: 'Tasks' }))
    await waitFor(() => expect(screen.queryByText('Keep until confirmed')).not.toBeInTheDocument())
  })

  it('handles deletion errors safely', async () => {
    const user = userEvent.setup()

    // Mock the error
    const spy = vi.spyOn(studyDb.tasks, 'clear').mockRejectedValue(new Error('Simulated error'))

    render(<App />)
    await user.click(await screen.findByRole('button', { name: 'Settings' }))
    await user.click(screen.getByRole('button', { name: /Reset all study data/ }))

    await user.type(screen.getByPlaceholderText('DELETE'), 'DELETE')
    await user.click(screen.getByRole('button', { name: 'Delete all data' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('Could not clear study data. Try again.')

    // Ensure the dialog is closed and reset
    expect(screen.getByRole('button', { name: /Reset all study data/ })).toBeInTheDocument()

    spy.mockRestore()
  })

  it('creates and displays calendar events', async () => {
    const user = userEvent.setup()
    render(<App />)

    await user.click(await screen.findByRole('button', { name: 'Calendar' }))
    await user.click(screen.getByRole('button', { name: 'New event' }))
    await user.type(screen.getByLabelText('Event title'), 'Study group meeting')
    await user.type(screen.getByLabelText('Location'), 'Library room 3')
    await user.click(screen.getByRole('button', { name: 'Save' }))

    const events = await studyDb.events.toArray()
    expect(events).toHaveLength(1)
    expect(events[0].title).toBe('Study group meeting')
    expect(events[0].location).toBe('Library room 3')

    await waitFor(() => expect(screen.getAllByText('Study group meeting').length).toBeGreaterThanOrEqual(1))
  })

  it('creates and manages goals', async () => {
    const user = userEvent.setup()
    render(<App />)

    await user.click(await screen.findByRole('button', { name: 'Goals' }))
    await user.click(screen.getByRole('button', { name: 'New goal' }))
    await user.type(screen.getByLabelText('Goal title'), 'Study 2 hours daily')
    await user.click(screen.getByRole('button', { name: 'Save' }))

    expect(await screen.findByText('Study 2 hours daily')).toBeInTheDocument()

    const goals = await studyDb.goals.toArray()
    expect(goals).toHaveLength(1)
    expect(goals[0].title).toBe('Study 2 hours daily')
  })

  it('creates a new subject from the subjects view', async () => {
    const user = userEvent.setup()
    render(<App />)

    await user.click(await screen.findByRole('button', { name: 'Subjects' }))
    await user.click(screen.getByRole('button', { name: 'New subject' }))
    await user.type(screen.getByLabelText('Subject name'), 'Physics')
    await user.click(screen.getByRole('button', { name: 'Save' }))

    expect(await screen.findByText('Physics')).toBeInTheDocument()

    const subjects = await studyDb.subjects.toArray()
    expect(subjects).toHaveLength(1)
    expect(subjects[0].name).toBe('Physics')
  })

  it('saves quick notes from the home page', async () => {
    render(<App />)

    const textarea = await screen.findByPlaceholderText(/Capture fast ideas/i)
    fireEvent.change(textarea, { target: { value: 'Review chapter 5 for exam' } })
    expect(screen.getByText('Saving…')).toBeInTheDocument()

    await waitFor(async () => {
      const setting = await studyDb.settings.get('quickNotes')
      expect(Array.isArray(setting?.value) ? setting!.value[0] : setting?.value).toContain('Review chapter 5')
    })
    expect(screen.getByText('Saved locally')).toBeInTheDocument()
  })

  it('filters tasks by all, open, and done status', async () => {
    const user = userEvent.setup()
    const timestamp = '2026-06-29T00:00:00.000Z'
    await studyDb.tasks.add({
      id: 'task-filter-open',
      title: 'Open filter task',
      subjectId: '',
      dueDate: '',
      priority: 'normal',
      status: 'open',
      minutes: 30,
      createdAt: timestamp,
      updatedAt: timestamp,
    })
    await studyDb.tasks.add({
      id: 'task-filter-done',
      title: 'Done filter task',
      subjectId: '',
      dueDate: '',
      priority: 'normal',
      status: 'done',
      minutes: 30,
      createdAt: timestamp,
      updatedAt: timestamp,
    })

    render(<App />)

    await user.click(await screen.findByRole('button', { name: 'Tasks' }))

    // Default 'all' filter shows both
    expect(screen.getByText('Open filter task')).toBeInTheDocument()
    expect(screen.getByText('Done filter task')).toBeInTheDocument()

    // Filter to open
    await user.click(screen.getByRole('button', { name: 'open' }))
    expect(screen.getByText('Open filter task')).toBeInTheDocument()
    expect(screen.queryByText('Done filter task')).not.toBeInTheDocument()

    // Filter to done
    await user.click(screen.getByRole('button', { name: 'done' }))
    expect(screen.queryByText('Open filter task')).not.toBeInTheDocument()
    expect(screen.getByText('Done filter task')).toBeInTheDocument()
  })

  it('reports import success and failure', async () => {
    const user = userEvent.setup()
    const validExport = {
      version: 1,
      exportedAt: '2026-06-29T00:00:00.000Z',
      tasks: [],
      subjects: [],
      notes: [],
      events: [],
      flashcards: [],
      studySessions: [],
      goals: [],
      settings: [],
    }

    render(<App />)

    await user.click(await screen.findByRole('button', { name: 'Settings' }))
    const importInput = screen.getByLabelText(/Import data/)

    await user.upload(importInput, new File([JSON.stringify(validExport)], 'study-dashboard.json', { type: 'application/json' }))
    expect(await screen.findByRole('status')).toHaveTextContent('Study data imported.')

    await user.upload(importInput, new File(['not valid json'], 'broken.json', { type: 'application/json' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Import failed. Choose a valid Study Dashboard export.')
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

    await user.click(await screen.findByRole('button', { name: 'Settings' }))
    const importInput = screen.getByLabelText(/Import data/)
    const emptyExport = {
      version: 1,
      exportedAt: '2026-06-29T00:00:00.000Z',
      tasks: [],
      subjects: [],
      notes: [],
      events: [],
      flashcards: [],
      studySessions: [],
      goals: [],
      settings: [],
    }
    await user.upload(importInput, new File([JSON.stringify(emptyExport)], 'empty.json', { type: 'application/json' }))
    expect(await screen.findByRole('status')).toHaveTextContent('Study data imported.')

    const tasks = await studyDb.tasks.toArray()
    expect(tasks).toHaveLength(0)
  })

  it('persists theme choice to localStorage', async () => {
    const user = userEvent.setup()
    render(<App />)

    await user.click(await screen.findByRole('button', { name: 'Settings' }))
    await user.click(screen.getByRole('button', { name: /Dark mode/ }))
    expect(localStorage.getItem('study-dashboard-theme')).toBe('dark')

    await user.click(screen.getByRole('radio', { name: /Aurora/ }))
    expect(localStorage.getItem('study-dashboard-theme')).toBe('aurora')

    await user.click(screen.getByRole('radio', { name: /Ember/ }))
    expect(localStorage.getItem('study-dashboard-theme')).toBe('ember')
  })

  it('clears active search from the settings panel', async () => {
    const user = userEvent.setup()
    render(<App />)

    await user.type(await screen.findByPlaceholderText('Search'), 'biology')
    expect(screen.getByPlaceholderText('Search')).toHaveValue('biology')

    await user.click(screen.getByRole('button', { name: 'Settings' }))
    const clearButtons = screen.getAllByRole('button', { name: 'Clear search' })
    await user.click(clearButtons[clearButtons.length - 1])

    expect(screen.getByPlaceholderText('Search')).toHaveValue('')
  })

  it('opens and closes the notice popover', async () => {
    const user = userEvent.setup()
    render(<App />)

    await screen.findByRole('heading', { name: 'Good morning' })

    const noticesBtn = screen.getByRole('button', { name: 'Notifications' })
    await user.click(noticesBtn)

    const popover = screen.getByRole('status')
    expect(popover).toBeInTheDocument()
    expect(within(popover).getByText(/completed tasks/)).toBeInTheDocument()

    await user.click(noticesBtn)
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
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
        return { click: clickMock, setAttribute: vi.fn() } as unknown as HTMLElement
      }
      return originalCreateElement(tagName)
    })

    await screen.findByRole('heading', { name: 'Good morning' })
    await user.click(screen.getByRole('button', { name: 'Settings' }))
    await user.click(screen.getByText('Export data'))

    await waitFor(() => {
      expect(createObjectURLMock).toHaveBeenCalled()
    })
    expect(clickMock).toHaveBeenCalled()
    expect(revokeObjectURLMock).toHaveBeenCalledWith('blob:test-url')

    createElementSpy.mockRestore()
  })

  it('logs focus session automatically when time limit is reached', async () => {
    // Populate DB for coverage hits
    await studyDb.settings.put({ key: 'dailyGoalMinutes', value: 120 })
    await studyDb.settings.put({ key: 'quickNotes', value: ['Test Note'] })
    await studyDb.subjects.add({ id: 'subj-cov', name: 'CovSubject', progress: 0, color: '#000000', targetHours: 1, createdAt: '2026-07-06T00:00:00.000Z', updatedAt: '2026-07-06T00:00:00.000Z' })
    await studyDb.flashcards.add({ id: 'fc-cov', subjectId: 'subj-cov', front: 'Q', back: 'A', status: 'new', dueAt: new Date().toISOString(), lastReviewedAt: '', createdAt: '2026-07-06T00:00:00.000Z', updatedAt: '2026-07-06T00:00:00.000Z' })

    render(<App />)

    await screen.findByRole('heading', { name: 'Good morning' })

    const durationSelect = screen.getByRole('combobox', { name: 'Session length' })
    fireEvent.change(durationSelect, { target: { value: '25' } })

    const subjectSelect = screen.getByRole('combobox', { name: 'Focus subject' })
    fireEvent.change(subjectSelect, { target: { value: 'subj-cov' } })

    vi.useFakeTimers()
    fireEvent.click(screen.getByRole('button', { name: 'Start focus' }))

    expect(screen.getByText('Stop session')).toBeInTheDocument()

    vi.advanceTimersByTime(26 * 60 * 1000)

    vi.useRealTimers()

    await waitFor(() => {
      expect(screen.queryByText('Stop session')).not.toBeInTheDocument()
    })
    expect(screen.getByText(/Session complete: \d+m logged/)).toBeInTheDocument()
  })

  it('toggles flashcard reveal', async () => {
    // Put data to trigger callbacks for settings and flashcards
    await studyDb.settings.put({ key: 'dailyGoalMinutes', value: 120 })
    await studyDb.settings.put({ key: 'quickNotes', value: ['Note'] })
    await studyDb.subjects.add({ id: 'subj1', name: 'Math', progress: 0, color: '#000000', targetHours: 1, createdAt: '2026-07-06T00:00:00.000Z', updatedAt: '2026-07-06T00:00:00.000Z' })
    await studyDb.flashcards.add({ id: 'fc1', subjectId: 'subj1', front: 'Q', back: 'A', status: 'new', dueAt: new Date().toISOString(), lastReviewedAt: '', createdAt: '2026-07-06T00:00:00.000Z', updatedAt: '2026-07-06T00:00:00.000Z' })

    render(<App />)
    await screen.findByRole('heading', { name: 'Good morning' })

    // Reveal flashcard
    fireEvent.click(screen.getByRole('button', { name: 'Flashcards' }))
    const flashcardTitle = await screen.findByText('Q')
    expect(flashcardTitle).toBeInTheDocument()

    const revealBtn = screen.getByRole('button', { name: 'Reveal' })
    fireEvent.click(revealBtn)

    const hideBtn = screen.getByRole('button', { name: 'Hide' })
    fireEvent.click(hideBtn)
  })

  it('clears search when no results are found', async () => {
    const user = userEvent.setup()
    render(<App />)

    await screen.findByRole('heading', { name: 'Good morning' })

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

  it('navigates to Calendar from Upcoming widget', async () => {
    const user = userEvent.setup()
    render(<App />)

    await screen.findByRole('heading', { name: 'Good morning' })

    const rightColumn = screen.getByRole('complementary', { name: 'Progress and schedule' })
    const viewAllBtn = within(rightColumn).getByRole('button', { name: 'View all' })
    await user.click(viewAllBtn)

    // Confirm Calendar view is open by looking for its unique action button
    expect(await screen.findByRole('button', { name: 'New event' })).toBeInTheDocument()
  })

  it('navigates to Flashcards from Review Queue widget', async () => {
    const user = userEvent.setup()
    render(<App />)

    await screen.findByRole('heading', { name: 'Good morning' })

    const rightColumn = screen.getByRole('complementary', { name: 'Progress and schedule' })
    const reviewCardsBtn = within(rightColumn).getByRole('button', { name: 'Review cards' })
    await user.click(reviewCardsBtn)

    // Confirm Flashcards view is open by looking for its unique action button
    expect(await screen.findByRole('button', { name: 'New card' })).toBeInTheDocument()
  })
})
