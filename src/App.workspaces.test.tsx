import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import App from './App'
import { studyDb } from './db/studyDb'
import { flushDeferredAppWork, resetAppTestEnvironment } from './test/appTestSetup'

describe('App workspaces', () => {
  beforeEach(async () => {
    await resetAppTestEnvironment()
  })

  afterEach(async () => {
    await flushDeferredAppWork()
  })

  it('names task toggles without exposing nested decorative icons', async () => {
    const user = userEvent.setup()
    const timestamp = '2026-06-29T00:00:00.000Z'
    await studyDb.tasks.add({
      id: 'task-a11y-toggle',
      title: 'Accessible toggle task',
      subjectId: '',
      status: 'open',
      priority: 'normal',
      minutes: 30,
      dueDate: '',
      createdAt: timestamp,
      updatedAt: timestamp,
    })

    render(<App />)
    await user.click(await screen.findByRole('button', { name: 'Tasks' }))

    const toggle = await screen.findByRole('button', { name: 'Toggle Accessible toggle task' })
    expect(toggle).toHaveAccessibleName('Toggle Accessible toggle task')
    expect(within(toggle).queryByRole('img')).not.toBeInTheDocument()
    expect(toggle.querySelector('svg')).toHaveAttribute('aria-hidden', 'true')
  })

  it('exposes human-readable subject swatch names and persists the exact hex value', async () => {
    const user = userEvent.setup()
    render(<App />)

    await user.click(await screen.findByRole('button', { name: 'Subjects' }))
    await user.click(screen.getByRole('button', { name: 'New subject' }))

    expect(screen.getByRole('button', { name: 'Use blue' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Use teal' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Use #/ })).not.toBeInTheDocument()

    await user.type(screen.getByLabelText('Subject name'), 'Named swatch subject')
    await user.click(screen.getByRole('button', { name: 'Use amber' }))
    await user.click(screen.getByRole('button', { name: 'Save' }))

    expect(await screen.findByText('Named swatch subject')).toBeInTheDocument()
    expect((await studyDb.subjects.toArray())[0].color).toBe('#b45309')
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
    expect(await screen.findByRole('status')).toHaveTextContent('Task created.')

    await user.click(screen.getByLabelText('Edit Linear algebra drills'))
    await user.clear(screen.getByLabelText('Task title'))
    await user.type(screen.getByLabelText('Task title'), 'Matrix practice')
    await user.click(screen.getByRole('button', { name: 'Save' }))
    expect(await screen.findByText('Matrix practice')).toBeInTheDocument()
    expect(await screen.findByRole('status')).toHaveTextContent('Task updated.')

    await user.click(screen.getByLabelText('Toggle Matrix practice'))
    await waitFor(() => expect(screen.getByText('Matrix practice').closest('.list-row')).toHaveClass('is-done'))
    expect(await screen.findByRole('status')).toHaveTextContent('Task marked complete.')

    await user.type(screen.getByPlaceholderText('Search'), 'matrix')
    expect(screen.getByText('Matrix practice')).toBeInTheDocument()
    expect(screen.queryByText('Chemistry lab report')).not.toBeInTheDocument()

    const confirmDelete = vi.spyOn(window, 'confirm').mockReturnValue(true)
    await user.click(screen.getByLabelText('Delete Matrix practice'))
    await waitFor(() => expect(screen.queryByText('Matrix practice')).not.toBeInTheDocument())
    expect(await screen.findByRole('status')).toHaveTextContent('Task deleted.')
    confirmDelete.mockRestore()
  })

  it('prevents duplicate task create while save is pending', async () => {
    const user = userEvent.setup()
    let releaseAdd!: () => void
    const gate = new Promise<void>((resolve) => {
      releaseAdd = resolve
    })
    const originalAdd = studyDb.tasks.add.bind(studyDb.tasks)
    const addSpy = vi.spyOn(studyDb.tasks, 'add').mockImplementation(async (task) => {
      await gate
      return originalAdd(task)
    })

    render(<App />)
    await user.click(await screen.findByRole('button', { name: 'Tasks' }))
    await user.click(screen.getByRole('button', { name: 'New task' }))
    await user.type(screen.getByLabelText('Task title'), 'Pending create task')
    await user.selectOptions(screen.getByLabelText('Priority'), 'high')
    await user.type(screen.getByLabelText('Due date'), '2026-07-22')
    await user.clear(screen.getByLabelText('Minutes'))
    await user.type(screen.getByLabelText('Minutes'), '40')

    await user.click(screen.getByRole('button', { name: 'Save' }))
    const savingButton = await screen.findByRole('button', { name: 'Creating task...' })
    expect(savingButton).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeDisabled()

    await user.click(savingButton)
    expect(addSpy).toHaveBeenCalledTimes(1)

    releaseAdd()
    expect(await screen.findByText('Pending create task')).toBeInTheDocument()
    expect(await screen.findByRole('status')).toHaveTextContent('Task created.')
    expect(await studyDb.tasks.count()).toBe(1)
  })

  it('preserves task draft after a failed create and allows retry', async () => {
    const user = userEvent.setup()
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    const originalAdd = studyDb.tasks.add.bind(studyDb.tasks)
    const addSpy = vi.spyOn(studyDb.tasks, 'add')
      .mockRejectedValueOnce(new Error('IndexedDB write failed: constraint detail'))
      .mockImplementation(async (task) => originalAdd(task))

    render(<App />)
    await user.click(await screen.findByRole('button', { name: 'Tasks' }))
    await user.click(screen.getByRole('button', { name: 'New task' }))
    await user.type(screen.getByLabelText('Task title'), 'Retryable task')
    await user.selectOptions(screen.getByLabelText('Priority'), 'high')
    await user.type(screen.getByLabelText('Due date'), '2026-07-25')
    fireEvent.change(screen.getByLabelText('Minutes'), { target: { value: '55' } })

    await user.click(screen.getByRole('button', { name: 'Save' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('Task could not be saved. Your details are still in the form.')
    expect(screen.queryByText('IndexedDB')).not.toBeInTheDocument()
    expect(screen.getByLabelText('Task title')).toHaveValue('Retryable task')
    expect(screen.getByLabelText('Task title')).not.toHaveAttribute('aria-invalid', 'true')
    expect(screen.getByLabelText('Priority')).toHaveValue('high')
    expect(screen.getByLabelText('Due date')).toHaveValue('2026-07-25')
    expect(screen.getByLabelText('Minutes')).toHaveValue(55)
    expect(screen.getByRole('button', { name: 'Save' })).toBeEnabled()

    await user.click(screen.getByRole('button', { name: 'Save' }))
    expect(await screen.findByText('Retryable task')).toBeInTheDocument()
    expect(await screen.findByRole('status')).toHaveTextContent('Task created.')
    expect(await studyDb.tasks.count()).toBe(1)
    expect(addSpy).toHaveBeenCalledTimes(2)
    expect(consoleError).toHaveBeenCalled()
  })

  it('associates an empty task title validation error with the title field', async () => {
    const user = userEvent.setup()
    render(<App />)

    await user.click(await screen.findByRole('button', { name: 'Tasks' }))
    await user.click(screen.getByRole('button', { name: 'New task' }))
    await user.click(screen.getByRole('button', { name: 'Save' }))

    const titleInput = screen.getByLabelText('Task title')
    const error = screen.getByRole('alert')
    expect(error).toHaveTextContent('Enter a task title.')
    expect(error).toHaveAttribute('id', 'task-title-error')
    expect(titleInput).toHaveAttribute('aria-invalid', 'true')
    expect(titleInput).toHaveAttribute('aria-describedby', 'task-title-error')
    expect(await studyDb.tasks.count()).toBe(0)

    await user.type(titleInput, 'Associated title task')
    await user.click(screen.getByRole('button', { name: 'Save' }))

    expect(await screen.findByText('Associated title task')).toBeInTheDocument()
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    expect(await studyDb.tasks.count()).toBe(1)
  })

  it('treats a missing-row edit as failure and keeps the editor open', async () => {
    const user = userEvent.setup()
    const timestamp = '2026-06-29T00:00:00.000Z'
    await studyDb.tasks.add({
      id: 'task-missing-edit',
      title: 'Existing task',
      subjectId: '',
      dueDate: '2026-07-01',
      priority: 'normal',
      status: 'open',
      minutes: 30,
      createdAt: timestamp,
      updatedAt: timestamp,
    })
    vi.spyOn(console, 'error').mockImplementation(() => undefined)
    vi.spyOn(studyDb.tasks, 'update').mockResolvedValueOnce(0)

    render(<App />)
    await user.click(await screen.findByRole('button', { name: 'Tasks' }))
    await user.click(await screen.findByLabelText('Edit Existing task'))
    await user.clear(screen.getByLabelText('Task title'))
    await user.type(screen.getByLabelText('Task title'), 'Renamed missing task')
    await user.selectOptions(screen.getByLabelText('Priority'), 'low')
    fireEvent.change(screen.getByLabelText('Minutes'), { target: { value: '70' } })
    await user.click(screen.getByRole('button', { name: 'Save' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('Task could not be saved. Your details are still in the form.')
    expect(screen.getByLabelText('Task title')).toHaveValue('Renamed missing task')
    expect(screen.getByLabelText('Priority')).toHaveValue('low')
    expect(screen.getByLabelText('Due date')).toHaveValue('2026-07-01')
    expect(screen.getByLabelText('Minutes')).toHaveValue(70)
    expect(screen.getByRole('button', { name: 'Save' })).toBeEnabled()
  })

  it('blocks duplicate status toggles and preserves status when toggle fails', async () => {
    const user = userEvent.setup()
    const timestamp = '2026-06-29T00:00:00.000Z'
    await studyDb.tasks.add({
      id: 'task-toggle-pending',
      title: 'Toggle race task',
      subjectId: '',
      dueDate: '',
      priority: 'normal',
      status: 'open',
      minutes: 20,
      createdAt: timestamp,
      updatedAt: timestamp,
    })

    let releaseUpdate!: () => void
    const gate = new Promise<void>((resolve) => {
      releaseUpdate = resolve
    })
    const originalUpdate = studyDb.tasks.update.bind(studyDb.tasks)
    const updateSpy = vi.spyOn(studyDb.tasks, 'update').mockImplementation(async (id, changes) => {
      await gate
      return originalUpdate(id, changes)
    })

    render(<App />)
    await user.click(await screen.findByRole('button', { name: 'Tasks' }))
    const toggle = await screen.findByLabelText('Toggle Toggle race task')
    await user.click(toggle)

    expect(await screen.findByLabelText('Updating Toggle race task')).toBeDisabled()
    expect(screen.getByLabelText('Edit Toggle race task')).toBeDisabled()
    await user.click(screen.getByLabelText('Updating Toggle race task'))
    expect(updateSpy).toHaveBeenCalledTimes(1)

    releaseUpdate()
    await waitFor(() => expect(screen.getByText('Toggle race task').closest('.list-row')).toHaveClass('is-done'))
    expect(await screen.findByRole('status')).toHaveTextContent('Task marked complete.')

    vi.spyOn(console, 'error').mockImplementation(() => undefined)
    updateSpy.mockRejectedValueOnce(new Error('status write failed'))
    await user.click(screen.getByLabelText('Toggle Toggle race task'))
    expect(await screen.findByRole('alert')).toHaveTextContent('Task could not be reopened.')
    expect(screen.getByText('Toggle race task').closest('.list-row')).toHaveClass('is-done')
  })

  it('keeps a task visible when deletion fails', async () => {
    const user = userEvent.setup()
    const timestamp = '2026-06-29T00:00:00.000Z'
    await studyDb.tasks.add({
      id: 'task-delete-fail',
      title: 'Sticky task',
      subjectId: '',
      dueDate: '',
      priority: 'normal',
      status: 'open',
      minutes: 15,
      createdAt: timestamp,
      updatedAt: timestamp,
    })
    vi.spyOn(console, 'error').mockImplementation(() => undefined)
    const deleteSpy = vi.spyOn(studyDb.tasks, 'delete').mockRejectedValueOnce(new Error('delete failed'))
    const confirmDelete = vi.spyOn(window, 'confirm').mockReturnValue(true)

    render(<App />)
    await user.click(await screen.findByRole('button', { name: 'Tasks' }))
    await user.click(await screen.findByLabelText('Delete Sticky task'))

    expect(await screen.findByRole('alert')).toHaveTextContent('Task could not be deleted. Please try again.')
    expect(screen.getByText('Sticky task')).toBeInTheDocument()
    expect(await studyDb.tasks.get('task-delete-fail')).toBeDefined()

    deleteSpy.mockRestore()
    await user.click(screen.getByLabelText('Delete Sticky task'))
    await waitFor(() => expect(screen.queryByText('Sticky task')).not.toBeInTheDocument())
    expect(await screen.findByRole('status')).toHaveTextContent('Task deleted.')
    confirmDelete.mockRestore()
  })

  it('blocks deleting subjects that still have linked records', async () => {
    const user = userEvent.setup()
    const confirm = vi.spyOn(window, 'confirm')
    const deleteSpy = vi.spyOn(studyDb.subjects, 'delete')
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

    expect(await screen.findByRole('alert')).toHaveTextContent(/Cannot delete Chemistry/)
    expect(await screen.findByRole('alert')).toHaveTextContent(/1 notes/)
    expect(confirm).not.toHaveBeenCalled()
    expect(deleteSpy).not.toHaveBeenCalled()
    expect(await studyDb.subjects.get('subject-linked')).toBeDefined()
    expect(screen.getByLabelText('Delete Chemistry')).toBeEnabled()
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
    expect(await screen.findByRole('status')).toHaveTextContent('Note created.')
  })

  it('prevents duplicate note create while save is pending', async () => {
    const user = userEvent.setup()
    let releaseAdd!: () => void
    const gate = new Promise<void>((resolve) => {
      releaseAdd = resolve
    })
    const originalAdd = studyDb.notes.add.bind(studyDb.notes)
    const addSpy = vi.spyOn(studyDb.notes, 'add').mockImplementation(async (note) => {
      await gate
      return originalAdd(note)
    })

    render(<App />)
    await user.click(await screen.findByRole('button', { name: 'Notes' }))
    await user.click(screen.getByRole('button', { name: 'New note' }))
    await user.type(screen.getByLabelText('Note title'), 'Pending note')
    await user.type(screen.getByLabelText('Body'), 'Body while pending')
    await user.click(screen.getByRole('button', { name: 'Save' }))

    const savingButton = await screen.findByRole('button', { name: 'Creating note...' })
    expect(savingButton).toBeDisabled()
    await user.click(savingButton)
    expect(addSpy).toHaveBeenCalledTimes(1)

    releaseAdd()
    expect(await screen.findByText('Pending note')).toBeInTheDocument()
    expect(await screen.findByRole('status')).toHaveTextContent('Note created.')
    expect(await studyDb.notes.count()).toBe(1)
  })

  it('preserves note draft after a failed create and allows retry', async () => {
    const user = userEvent.setup()
    vi.spyOn(console, 'error').mockImplementation(() => undefined)
    const originalAdd = studyDb.notes.add.bind(studyDb.notes)
    const addSpy = vi.spyOn(studyDb.notes, 'add')
      .mockRejectedValueOnce(new Error('IndexedDB note write failed'))
      .mockImplementation(async (note) => originalAdd(note))

    render(<App />)
    await user.click(await screen.findByRole('button', { name: 'Notes' }))
    await user.click(screen.getByRole('button', { name: 'New note' }))
    await user.type(screen.getByLabelText('Note title'), 'Retry note')
    await user.type(screen.getByLabelText('Tags'), 'exam, formulas')
    await user.type(
      screen.getByLabelText('Body'),
      'A long note body that must survive persistence failure without truncation or reset.',
    )
    await user.click(screen.getByRole('button', { name: 'Save' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('Note could not be saved. Your text is still available.')
    expect(screen.queryByText('IndexedDB')).not.toBeInTheDocument()
    expect(screen.getByLabelText('Note title')).toHaveValue('Retry note')
    expect(screen.getByLabelText('Tags')).toHaveValue('exam, formulas')
    expect(screen.getByLabelText('Body')).toHaveValue(
      'A long note body that must survive persistence failure without truncation or reset.',
    )
    expect(screen.getByRole('button', { name: 'Save' })).toBeEnabled()

    await user.click(screen.getByRole('button', { name: 'Save' }))
    expect(await screen.findByText('Retry note')).toBeInTheDocument()
    expect(await screen.findByRole('status')).toHaveTextContent('Note created.')
    expect(await studyDb.notes.count()).toBe(1)
    expect(addSpy).toHaveBeenCalledTimes(2)
  })

  it('treats a missing-row note edit as failure and keeps the editor open', async () => {
    const user = userEvent.setup()
    const timestamp = '2026-06-29T00:00:00.000Z'
    await studyDb.notes.add({
      id: 'note-missing-edit',
      title: 'Existing note',
      body: 'Original body',
      subjectId: '',
      tags: ['review'],
      createdAt: timestamp,
      updatedAt: timestamp,
    })
    vi.spyOn(console, 'error').mockImplementation(() => undefined)
    vi.spyOn(studyDb.notes, 'update').mockResolvedValueOnce(0)

    render(<App />)
    await user.click(await screen.findByRole('button', { name: 'Notes' }))
    await user.click(await screen.findByLabelText('Edit Existing note'))
    await user.clear(screen.getByLabelText('Note title'))
    await user.type(screen.getByLabelText('Note title'), 'Edited missing note')
    await user.clear(screen.getByLabelText('Tags'))
    await user.type(screen.getByLabelText('Tags'), 'edited, tags')
    await user.clear(screen.getByLabelText('Body'))
    await user.type(screen.getByLabelText('Body'), 'Edited body text')
    await user.click(screen.getByRole('button', { name: 'Save' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('Note could not be saved. Your text is still available.')
    expect(screen.getByLabelText('Note title')).toHaveValue('Edited missing note')
    expect(screen.getByLabelText('Tags')).toHaveValue('edited, tags')
    expect(screen.getByLabelText('Body')).toHaveValue('Edited body text')
    expect(screen.getByRole('button', { name: 'Save' })).toBeEnabled()
  })

  it('keeps a note visible when deletion fails and blocks duplicate deletes', async () => {
    const user = userEvent.setup()
    const timestamp = '2026-06-29T00:00:00.000Z'
    await studyDb.notes.add({
      id: 'note-delete-fail',
      title: 'Sticky note',
      body: 'Keep me',
      subjectId: '',
      tags: [],
      createdAt: timestamp,
      updatedAt: timestamp,
    })
    vi.spyOn(console, 'error').mockImplementation(() => undefined)

    let releaseDelete!: () => void
    const gate = new Promise<void>((resolve) => {
      releaseDelete = resolve
    })
    const originalDelete = studyDb.notes.delete.bind(studyDb.notes)
    const deleteSpy = vi.spyOn(studyDb.notes, 'delete').mockImplementation(async () => {
      await gate
      throw new Error('delete failed')
    })
    const confirmDelete = vi.spyOn(window, 'confirm').mockReturnValue(true)

    render(<App />)
    await user.click(await screen.findByRole('button', { name: 'Notes' }))
    await user.click(await screen.findByLabelText('Delete Sticky note'))

    expect(await screen.findByLabelText('Deleting Sticky note')).toBeDisabled()
    expect(screen.getByLabelText('Edit Sticky note')).toBeDisabled()
    await user.click(screen.getByLabelText('Deleting Sticky note'))
    expect(deleteSpy).toHaveBeenCalledTimes(1)

    releaseDelete()
    expect(await screen.findByRole('alert')).toHaveTextContent('Note could not be deleted.')
    expect(screen.getByText('Sticky note')).toBeInTheDocument()
    expect(await studyDb.notes.get('note-delete-fail')).toBeDefined()

    deleteSpy.mockImplementation(async (id) => originalDelete(id))
    await user.click(screen.getByLabelText('Delete Sticky note'))
    await waitFor(() => expect(screen.queryByText('Sticky note')).not.toBeInTheDocument())
    expect(await screen.findByRole('status')).toHaveTextContent('Note deleted.')
    confirmDelete.mockRestore()
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
    expect(await screen.findByRole('status')).toHaveTextContent('Flashcard created.')
    expect(screen.getByText('Answer hidden')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Reveal' }))
    expect(screen.getByText('Power rule')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Remembered' }))
    expect(await screen.findByText('remembered')).toBeInTheDocument()
    expect(await screen.findByText(/Next review/)).toBeInTheDocument()
    expect(await screen.findByRole('status')).toHaveTextContent('Flashcard marked remembered.')
  })

  it('preserves flashcard draft after a failed create', async () => {
    const user = userEvent.setup()
    vi.spyOn(console, 'error').mockImplementation(() => undefined)
    const originalAdd = studyDb.flashcards.add.bind(studyDb.flashcards)
    vi.spyOn(studyDb.flashcards, 'add')
      .mockRejectedValueOnce(new Error('IndexedDB card write failed'))
      .mockImplementation(async (card) => originalAdd(card))

    render(<App />)
    await user.click(await screen.findByRole('button', { name: 'Flashcards' }))
    await user.click(screen.getByRole('button', { name: 'New card' }))
    await user.type(screen.getByLabelText('Front'), 'Retry front')
    await user.type(screen.getByLabelText('Back'), 'Retry back')
    await user.click(screen.getByRole('button', { name: 'Save' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('Flashcard could not be saved. Your details are still in the form.')
    expect(screen.getByLabelText('Front')).toHaveValue('Retry front')
    expect(screen.getByLabelText('Back')).toHaveValue('Retry back')
    expect(screen.getByRole('button', { name: 'Save' })).toBeEnabled()

    await user.click(screen.getByRole('button', { name: 'Save' }))
    expect(await screen.findByText('Retry front')).toBeInTheDocument()
    expect(await screen.findByRole('status')).toHaveTextContent('Flashcard created.')
    expect(await studyDb.flashcards.count()).toBe(1)
  })

  it('treats a missing-row flashcard edit as failure and keeps values', async () => {
    const user = userEvent.setup()
    const timestamp = '2026-06-29T00:00:00.000Z'
    await studyDb.flashcards.add({
      id: 'card-missing-edit',
      front: 'Existing front',
      back: 'Existing back',
      subjectId: '',
      status: 'new',
      lastReviewedAt: '',
      dueAt: timestamp,
      intervalDays: 0,
      reviewCount: 0,
      createdAt: timestamp,
      updatedAt: timestamp,
    })
    vi.spyOn(console, 'error').mockImplementation(() => undefined)
    vi.spyOn(studyDb.flashcards, 'update').mockResolvedValueOnce(0)

    render(<App />)
    await user.click(await screen.findByRole('button', { name: 'Flashcards' }))
    await user.click(await screen.findByLabelText('Edit Existing front'))
    await user.clear(screen.getByLabelText('Front'))
    await user.type(screen.getByLabelText('Front'), 'Edited front')
    await user.clear(screen.getByLabelText('Back'))
    await user.type(screen.getByLabelText('Back'), 'Edited back')
    await user.click(screen.getByRole('button', { name: 'Save' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('Flashcard could not be saved. Your details are still in the form.')
    expect(screen.getByLabelText('Front')).toHaveValue('Edited front')
    expect(screen.getByLabelText('Back')).toHaveValue('Edited back')
  })

  it('blocks duplicate flashcard review and preserves the card when review fails', async () => {
    const user = userEvent.setup()
    const timestamp = new Date().toISOString()
    await studyDb.flashcards.add({
      id: 'card-review-pending',
      front: 'Review race card',
      back: 'Answer',
      subjectId: '',
      status: 'new',
      lastReviewedAt: '',
      dueAt: timestamp,
      intervalDays: 0,
      reviewCount: 0,
      createdAt: timestamp,
      updatedAt: timestamp,
    })

    let releaseUpdate!: () => void
    const gate = new Promise<void>((resolve) => {
      releaseUpdate = resolve
    })
    const originalUpdate = studyDb.flashcards.update.bind(studyDb.flashcards)
    const updateSpy = vi.spyOn(studyDb.flashcards, 'update').mockImplementation(async (id, changes) => {
      await gate
      return originalUpdate(id, changes)
    })

    render(<App />)
    await user.click(await screen.findByRole('button', { name: 'Flashcards' }))
    await user.click(await screen.findByRole('button', { name: 'Remembered' }))

    const savingButtons = await screen.findAllByRole('button', { name: 'Saving review...' })
    expect(savingButtons).toHaveLength(2)
    savingButtons.forEach((button) => expect(button).toBeDisabled())
    expect(screen.getByLabelText('Edit Review race card')).toBeDisabled()
    await user.click(savingButtons[0])
    expect(updateSpy).toHaveBeenCalledTimes(1)

    releaseUpdate()
    expect(await screen.findByRole('status')).toHaveTextContent('Flashcard marked remembered.')
    expect(await screen.findByText('remembered')).toBeInTheDocument()

    vi.spyOn(console, 'error').mockImplementation(() => undefined)
    updateSpy.mockRejectedValueOnce(new Error('review write failed'))
    await user.click(screen.getByRole('button', { name: 'Later' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Review could not be saved. The card has not been advanced.')
    expect(screen.getByText('Review race card')).toBeInTheDocument()
    expect(screen.getByText('remembered')).toBeInTheDocument()
  })

  it('keeps a flashcard visible when deletion fails and blocks duplicate deletes', async () => {
    const user = userEvent.setup()
    const timestamp = new Date().toISOString()
    await studyDb.flashcards.add({
      id: 'card-delete-fail',
      front: 'Sticky card',
      back: 'Keep me',
      subjectId: '',
      status: 'new',
      lastReviewedAt: '',
      dueAt: timestamp,
      intervalDays: 0,
      reviewCount: 0,
      createdAt: timestamp,
      updatedAt: timestamp,
    })
    vi.spyOn(console, 'error').mockImplementation(() => undefined)

    let releaseDelete!: () => void
    const gate = new Promise<void>((resolve) => {
      releaseDelete = resolve
    })
    const originalDelete = studyDb.flashcards.delete.bind(studyDb.flashcards)
    const deleteSpy = vi.spyOn(studyDb.flashcards, 'delete').mockImplementation(async () => {
      await gate
      throw new Error('delete failed')
    })
    const confirmDelete = vi.spyOn(window, 'confirm').mockReturnValue(true)

    render(<App />)
    await user.click(await screen.findByRole('button', { name: 'Flashcards' }))
    await user.click(await screen.findByLabelText('Delete Sticky card'))

    expect(await screen.findByLabelText('Deleting Sticky card')).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Remembered' })).toBeDisabled()
    await user.click(screen.getByLabelText('Deleting Sticky card'))
    expect(deleteSpy).toHaveBeenCalledTimes(1)

    releaseDelete()
    expect(await screen.findByRole('alert')).toHaveTextContent('Flashcard could not be deleted.')
    expect(screen.getByText('Sticky card')).toBeInTheDocument()

    deleteSpy.mockImplementation(async (id) => originalDelete(id))
    await user.click(screen.getByLabelText('Delete Sticky card'))
    await waitFor(() => expect(screen.queryByText('Sticky card')).not.toBeInTheDocument())
    expect(await screen.findByRole('status')).toHaveTextContent('Flashcard deleted.')
    confirmDelete.mockRestore()
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
    expect(await screen.findByRole('status')).toHaveTextContent('Event created.')
  })

  it('validates calendar date and time before calling Dexie', async () => {
    const user = userEvent.setup()
    const addSpy = vi.spyOn(studyDb.events, 'add')

    render(<App />)
    await user.click(await screen.findByRole('button', { name: 'Calendar' }))
    await user.click(screen.getByRole('button', { name: 'New event' }))
    await user.type(screen.getByLabelText('Event title'), 'Broken schedule')
    fireEvent.change(screen.getByLabelText('Date'), { target: { value: '' } })
    fireEvent.change(screen.getByLabelText('Time'), { target: { value: '' } })
    await user.click(screen.getByRole('button', { name: 'Save' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('Enter a valid date and start time.')
    expect(addSpy).not.toHaveBeenCalled()
    expect(screen.getByLabelText('Event title')).toHaveValue('Broken schedule')
    expect(screen.getByLabelText('Date')).toHaveValue('')
    expect(screen.getByLabelText('Time')).toHaveValue('')
  })

  it('preserves calendar draft after a failed create and allows retry', async () => {
    const user = userEvent.setup()
    vi.spyOn(console, 'error').mockImplementation(() => undefined)
    const originalAdd = studyDb.events.add.bind(studyDb.events)
    const addSpy = vi.spyOn(studyDb.events, 'add')
      .mockRejectedValueOnce(new Error('IndexedDB event write failed'))
      .mockImplementation(async (event) => originalAdd(event))

    render(<App />)
    await user.click(await screen.findByRole('button', { name: 'Calendar' }))
    await user.click(screen.getByRole('button', { name: 'New event' }))
    await user.type(screen.getByLabelText('Event title'), 'Retry event')
    fireEvent.change(screen.getByLabelText('Date'), { target: { value: '2026-08-01' } })
    fireEvent.change(screen.getByLabelText('Time'), { target: { value: '14:30' } })
    fireEvent.change(screen.getByLabelText('Duration'), { target: { value: '90' } })
    await user.type(screen.getByLabelText('Location'), 'Room 12')
    await user.click(screen.getByRole('button', { name: 'Save' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('Event could not be saved. Check the details and try again.')
    expect(screen.queryByText('IndexedDB')).not.toBeInTheDocument()
    expect(screen.getByLabelText('Event title')).toHaveValue('Retry event')
    expect(screen.getByLabelText('Date')).toHaveValue('2026-08-01')
    expect(screen.getByLabelText('Time')).toHaveValue('14:30')
    expect(screen.getByLabelText('Duration')).toHaveValue(90)
    expect(screen.getByLabelText('Location')).toHaveValue('Room 12')
    expect(screen.getByRole('button', { name: 'Save' })).toBeEnabled()

    await user.click(screen.getByRole('button', { name: 'Save' }))
    expect(await screen.findByRole('status')).toHaveTextContent('Event created.')
    expect(screen.queryByLabelText('Event title')).not.toBeInTheDocument()
    expect(await studyDb.events.count()).toBe(1)
    expect(addSpy).toHaveBeenCalledTimes(2)
  })

  it('treats a missing-row calendar edit as failure and keeps values', async () => {
    const user = userEvent.setup()
    const timestamp = '2026-06-29T00:00:00.000Z'
    await studyDb.events.add({
      id: 'event-missing-edit',
      title: 'Existing event',
      subjectId: '',
      startAt: '2026-08-02T10:00:00.000Z',
      endAt: '2026-08-02T11:00:00.000Z',
      location: 'Hall A',
      createdAt: timestamp,
      updatedAt: timestamp,
    })
    vi.spyOn(console, 'error').mockImplementation(() => undefined)
    vi.spyOn(studyDb.events, 'update').mockResolvedValueOnce(0)

    render(<App />)
    await user.click(await screen.findByRole('button', { name: 'Calendar' }))
    await user.click(await screen.findByLabelText('Edit Existing event'))
    await user.clear(screen.getByLabelText('Event title'))
    await user.type(screen.getByLabelText('Event title'), 'Edited missing event')
    fireEvent.change(screen.getByLabelText('Date'), { target: { value: '2026-08-03' } })
    fireEvent.change(screen.getByLabelText('Time'), { target: { value: '16:15' } })
    fireEvent.change(screen.getByLabelText('Duration'), { target: { value: '45' } })
    await user.clear(screen.getByLabelText('Location'))
    await user.type(screen.getByLabelText('Location'), 'Hall B')
    await user.click(screen.getByRole('button', { name: 'Save' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('Event could not be saved. Check the details and try again.')
    expect(screen.getByLabelText('Event title')).toHaveValue('Edited missing event')
    expect(screen.getByLabelText('Date')).toHaveValue('2026-08-03')
    expect(screen.getByLabelText('Time')).toHaveValue('16:15')
    expect(screen.getByLabelText('Duration')).toHaveValue(45)
    expect(screen.getByLabelText('Location')).toHaveValue('Hall B')
  })

  it('keeps a calendar event visible when deletion fails and blocks duplicate deletes', async () => {
    const user = userEvent.setup()
    const timestamp = '2026-06-29T00:00:00.000Z'
    await studyDb.events.add({
      id: 'event-delete-fail',
      title: 'Sticky event',
      subjectId: '',
      startAt: '2026-08-04T09:00:00.000Z',
      endAt: '2026-08-04T10:00:00.000Z',
      location: 'Lab',
      createdAt: timestamp,
      updatedAt: timestamp,
    })
    vi.spyOn(console, 'error').mockImplementation(() => undefined)

    let releaseDelete!: () => void
    const gate = new Promise<void>((resolve) => {
      releaseDelete = resolve
    })
    const originalDelete = studyDb.events.delete.bind(studyDb.events)
    const deleteSpy = vi.spyOn(studyDb.events, 'delete').mockImplementation(async () => {
      await gate
      throw new Error('delete failed')
    })
    const confirmDelete = vi.spyOn(window, 'confirm').mockReturnValue(true)

    render(<App />)
    await user.click(await screen.findByRole('button', { name: 'Calendar' }))
    await user.click(await screen.findByLabelText('Delete Sticky event'))

    expect(await screen.findByLabelText('Deleting Sticky event')).toBeDisabled()
    expect(screen.getByLabelText('Edit Sticky event')).toBeDisabled()
    await user.click(screen.getByLabelText('Deleting Sticky event'))
    expect(deleteSpy).toHaveBeenCalledTimes(1)

    releaseDelete()
    expect(await screen.findByRole('alert')).toHaveTextContent('Event could not be deleted. Please try again.')
    expect(screen.getByText('Sticky event')).toBeInTheDocument()
    expect(screen.getByLabelText('Seven day calendar')).toBeInTheDocument()
    expect(await studyDb.events.get('event-delete-fail')).toBeDefined()

    deleteSpy.mockImplementation(async (id) => originalDelete(id))
    await user.click(screen.getByLabelText('Delete Sticky event'))
    await waitFor(() => expect(screen.queryByText('Sticky event')).not.toBeInTheDocument())
    expect(await screen.findByRole('status')).toHaveTextContent('Event deleted.')
    confirmDelete.mockRestore()
  })

  it('creates a new subject from the subjects view', async () => {
    const user = userEvent.setup()
    render(<App />)

    await user.click(await screen.findByRole('button', { name: 'Subjects' }))
    await user.click(screen.getByRole('button', { name: 'New subject' }))
    await user.type(screen.getByLabelText('Subject name'), 'Physics')
    await user.click(screen.getByRole('button', { name: 'Save' }))

    expect(await screen.findByText('Physics')).toBeInTheDocument()
    expect(await screen.findByRole('status')).toHaveTextContent('Subject created.')

    const subjects = await studyDb.subjects.toArray()
    expect(subjects).toHaveLength(1)
    expect(subjects[0].name).toBe('Physics')
  })

  it('prevents duplicate subject create while save is pending', async () => {
    const user = userEvent.setup()
    let releaseAdd!: () => void
    const gate = new Promise<void>((resolve) => {
      releaseAdd = resolve
    })
    const originalAdd = studyDb.subjects.add.bind(studyDb.subjects)
    const addSpy = vi.spyOn(studyDb.subjects, 'add').mockImplementation(async (subject) => {
      await gate
      return originalAdd(subject)
    })

    render(<App />)
    await user.click(await screen.findByRole('button', { name: 'Subjects' }))
    await user.click(screen.getByRole('button', { name: 'New subject' }))
    await user.type(screen.getByLabelText('Subject name'), 'Pending subject')
    fireEvent.change(screen.getByLabelText('Target hours'), { target: { value: '8' } })
    fireEvent.change(screen.getByLabelText('Progress %'), { target: { value: '20' } })
    await user.click(screen.getByRole('button', { name: 'Save' }))

    const savingButton = await screen.findByRole('button', { name: 'Creating subject...' })
    expect(savingButton).toBeDisabled()
    await user.click(savingButton)
    expect(addSpy).toHaveBeenCalledTimes(1)

    releaseAdd()
    expect(await screen.findByText('Pending subject')).toBeInTheDocument()
    expect(await screen.findByRole('status')).toHaveTextContent('Subject created.')
    expect(await studyDb.subjects.count()).toBe(1)
  })

  it('preserves subject draft after a failed create and allows retry', async () => {
    const user = userEvent.setup()
    vi.spyOn(console, 'error').mockImplementation(() => undefined)
    const originalAdd = studyDb.subjects.add.bind(studyDb.subjects)
    const addSpy = vi.spyOn(studyDb.subjects, 'add')
      .mockRejectedValueOnce(new Error('IndexedDB subject write failed'))
      .mockImplementation(async (subject) => originalAdd(subject))

    render(<App />)
    await user.click(await screen.findByRole('button', { name: 'Subjects' }))
    await user.click(screen.getByRole('button', { name: 'New subject' }))
    await user.type(screen.getByLabelText('Subject name'), 'Retry subject')
    await user.click(screen.getByLabelText('Use teal'))
    fireEvent.change(screen.getByLabelText('Target hours'), { target: { value: '7' } })
    fireEvent.change(screen.getByLabelText('Progress %'), { target: { value: '35' } })
    await user.click(screen.getByRole('button', { name: 'Save' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('Subject could not be saved. Your details are still in the form.')
    expect(screen.getByLabelText('Subject name')).toHaveValue('Retry subject')
    expect(screen.getByLabelText('Target hours')).toHaveValue(7)
    expect(screen.getByLabelText('Progress %')).toHaveValue(35)
    expect(screen.getByRole('button', { name: 'Save' })).toBeEnabled()

    await user.click(screen.getByRole('button', { name: 'Save' }))
    expect(await screen.findByText('Retry subject')).toBeInTheDocument()
    expect(await screen.findByRole('status')).toHaveTextContent('Subject created.')
    expect(await studyDb.subjects.count()).toBe(1)
    expect(addSpy).toHaveBeenCalledTimes(2)
    expect((await studyDb.subjects.toArray())[0].color).toBe('#0f766e')
  })

  it('treats a missing-row subject edit as failure and keeps the editor open', async () => {
    const user = userEvent.setup()
    const timestamp = '2026-06-29T00:00:00.000Z'
    await studyDb.subjects.add({
      id: 'subject-missing-edit',
      name: 'Existing subject',
      color: '#2563eb',
      targetHours: 5,
      progress: 10,
      createdAt: timestamp,
      updatedAt: timestamp,
    })
    vi.spyOn(console, 'error').mockImplementation(() => undefined)
    vi.spyOn(studyDb.subjects, 'update').mockResolvedValueOnce(0)

    render(<App />)
    await user.click(await screen.findByRole('button', { name: 'Subjects' }))
    await user.click(await screen.findByLabelText('Edit Existing subject'))
    await user.clear(screen.getByLabelText('Subject name'))
    await user.type(screen.getByLabelText('Subject name'), 'Edited subject')
    fireEvent.change(screen.getByLabelText('Target hours'), { target: { value: '9' } })
    fireEvent.change(screen.getByLabelText('Progress %'), { target: { value: '40' } })
    await user.click(screen.getByRole('button', { name: 'Save' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('Subject could not be saved. Your details are still in the form.')
    expect(screen.getByLabelText('Subject name')).toHaveValue('Edited subject')
    expect(screen.getByLabelText('Target hours')).toHaveValue(9)
    expect(screen.getByLabelText('Progress %')).toHaveValue(40)
  })

  it('keeps a subject visible when confirmed deletion fails and blocks duplicate deletes', async () => {
    const user = userEvent.setup()
    const timestamp = '2026-06-29T00:00:00.000Z'
    await studyDb.subjects.add({
      id: 'subject-delete-fail',
      name: 'Sticky subject',
      color: '#111827',
      targetHours: 3,
      progress: 0,
      createdAt: timestamp,
      updatedAt: timestamp,
    })
    vi.spyOn(console, 'error').mockImplementation(() => undefined)

    let releaseDelete!: () => void
    const gate = new Promise<void>((resolve) => {
      releaseDelete = resolve
    })
    const originalDelete = studyDb.subjects.delete.bind(studyDb.subjects)
    const deleteSpy = vi.spyOn(studyDb.subjects, 'delete').mockImplementation(async () => {
      await gate
      throw new Error('delete failed')
    })
    const confirmDelete = vi.spyOn(window, 'confirm').mockReturnValue(true)

    render(<App />)
    await user.click(await screen.findByRole('button', { name: 'Subjects' }))
    await user.click(await screen.findByLabelText('Delete Sticky subject'))

    expect(await screen.findByLabelText('Deleting Sticky subject')).toBeDisabled()
    expect(screen.getByLabelText('Edit Sticky subject')).toBeDisabled()
    await user.click(screen.getByLabelText('Deleting Sticky subject'))
    expect(deleteSpy).toHaveBeenCalledTimes(1)

    releaseDelete()
    expect(await screen.findByRole('alert')).toHaveTextContent('Subject could not be deleted. Please try again.')
    expect(screen.getByText('Sticky subject')).toBeInTheDocument()

    deleteSpy.mockImplementation(async (id) => originalDelete(id))
    await user.click(screen.getByLabelText('Delete Sticky subject'))
    await waitFor(() => expect(screen.queryByText('Sticky subject')).not.toBeInTheDocument())
    expect(await screen.findByRole('status')).toHaveTextContent('Subject deleted.')
    confirmDelete.mockRestore()
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

  it('toggles flashcard reveal', async () => {
    // Put data to trigger callbacks for settings and flashcards
    await studyDb.settings.put({ key: 'dailyGoalMinutes', value: 120 })
    await studyDb.settings.put({ key: 'quickNotes', value: ['Note'] })
    await studyDb.subjects.add({ id: 'subj1', name: 'Math', progress: 0, color: '#000000', targetHours: 1, createdAt: '2026-07-06T00:00:00.000Z', updatedAt: '2026-07-06T00:00:00.000Z' })
    await studyDb.flashcards.add({ id: 'fc1', subjectId: 'subj1', front: 'Q', back: 'A', status: 'new', dueAt: new Date().toISOString(), lastReviewedAt: '', createdAt: '2026-07-06T00:00:00.000Z', updatedAt: '2026-07-06T00:00:00.000Z' })

    render(<App />)
    await screen.findByRole('heading', { name: /Good (morning|afternoon|evening)/ })

    // Reveal flashcard
    fireEvent.click(screen.getByRole('button', { name: 'Flashcards' }))
    const flashcardTitle = await screen.findByText('Q')
    expect(flashcardTitle).toBeInTheDocument()

    const revealBtn = screen.getByRole('button', { name: 'Reveal' })
    fireEvent.click(revealBtn)

    const hideBtn = screen.getByRole('button', { name: 'Hide' })
    fireEvent.click(hideBtn)
  })
})
