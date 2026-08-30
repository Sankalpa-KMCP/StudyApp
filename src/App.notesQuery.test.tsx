import { act, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import App from './App'
import * as subjectRead from './db/subjectRead'
import * as goalRead from './db/goalRead'
import { createGoal } from './db/goalService'
import { createNote, updateNote } from './db/notesService'
import * as noteRead from './db/noteRead'
import { createTask } from './db/taskService'
import * as taskRead from './db/taskRead'
import { saveQuickNotes } from './db/quickNotesService'
import { exportStudyData, getStudyData, studyDb } from './db/studyDb'
import { flushDeferredAppWork, resetAppTestEnvironment } from './test/appTestSetup'

describe('App notes live query isolation', () => {
  beforeEach(async () => {
    await resetAppTestEnvironment()
  })

  afterEach(async () => {
    await flushDeferredAppWork()
  })

  it('reruns Notes without rerunning the Subjects query for Note writes and updates consumers', async () => {
    const user = userEvent.setup()
    await studyDb.subjects.add({
      id: 'subject-notes',
      name: 'Chemistry',
      color: '#2563eb',
      targetHours: 2,
      progress: 0,
      progressMode: 'manual',
      createdAt: '2026-07-01T00:00:00.000Z',
      updatedAt: '2026-07-01T00:00:00.000Z',
    })

    const shellSpy = vi.spyOn(subjectRead, 'listSubjects')
    const notesSpy = vi.spyOn(noteRead, 'listNotes')

    render(<App />)
    await screen.findByRole('heading', { name: /Good (morning|afternoon|evening)/ })
    await waitFor(() => expect(shellSpy).toHaveBeenCalled())
    await waitFor(() => expect(notesSpy).toHaveBeenCalled())
    const shellBefore = shellSpy.mock.calls.length
    const notesBefore = notesSpy.mock.calls.length

    await user.click(screen.getByRole('button', { name: 'Notes' }))
    await user.click(screen.getByRole('button', { name: 'New note' }))
    await user.type(screen.getByLabelText('Note title'), 'Isolation note')
    await user.type(screen.getByLabelText('Body'), 'Body with taggable content')
    await user.selectOptions(screen.getByLabelText('Subject'), 'subject-notes')
    await user.type(screen.getByLabelText('Tags'), 'lab')
    await user.click(screen.getByRole('button', { name: 'Save' }))
    expect(await screen.findByText('Isolation note')).toBeInTheDocument()

    await waitFor(() => expect(notesSpy.mock.calls.length).toBeGreaterThan(notesBefore))
    expect(shellSpy.mock.calls.length).toBe(shellBefore)

    await user.click(screen.getByRole('button', { name: 'Home' }))
    expect(await screen.findByRole('heading', { name: 'Recent Notes' })).toBeInTheDocument()
    expect(screen.getByText('Isolation note')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Subjects' }))
    const subjectCard = (await screen.findByText('Chemistry')).closest('article') as HTMLElement
    expect(within(subjectCard).getByText(/1 linked records/i)).toBeInTheDocument()
  }, 15_000)

  it('does not rerun Notes for unrelated task writes', async () => {
    const notesSpy = vi.spyOn(noteRead, 'listNotes')
    const tasksSpy = vi.spyOn(taskRead, 'listTasks')

    render(<App />)
    await screen.findByRole('heading', { name: /Good (morning|afternoon|evening)/ })
    await waitFor(() => expect(notesSpy).toHaveBeenCalled())
    await waitFor(() => expect(tasksSpy).toHaveBeenCalled())
    const notesBefore = notesSpy.mock.calls.length
    const tasksBefore = tasksSpy.mock.calls.length

    await createTask({
      title: 'Unrelated task',
      subjectId: '',
      dueDate: '',
      priority: 'normal',
      minutes: 20,
    })

    await waitFor(() => expect(tasksSpy.mock.calls.length).toBeGreaterThan(tasksBefore))
    expect(notesSpy.mock.calls.length).toBe(notesBefore)
  })

  it('does not rerun Notes for a Goal-only write', async () => {
    const user = userEvent.setup()
    const notesSpy = vi.spyOn(noteRead, 'listNotes')
    const goalsSpy = vi.spyOn(goalRead, 'listGoals')

    render(<App />)
    await user.click(await screen.findByRole('button', { name: 'Goals' }))
    await screen.findByRole('heading', { name: 'Goals' })
    await waitFor(() => expect(notesSpy).toHaveBeenCalled())
    await waitFor(() => expect(goalsSpy).toHaveBeenCalled())
    const notesBefore = notesSpy.mock.calls.length
    const goalsBefore = goalsSpy.mock.calls.length

    await createGoal({
      title: 'Manual goal only',
      target: 30,
      progress: 0,
      period: 'weekly',
      metric: 'manual',
    })

    await waitFor(() => expect(goalsSpy.mock.calls.length).toBeGreaterThan(goalsBefore))
    expect(notesSpy.mock.calls.length).toBe(notesBefore)
  })

  it('does not rerun Study Notes for Quick Notes settings writes', async () => {
    const shellSpy = vi.spyOn(subjectRead, 'listSubjects')
    const notesSpy = vi.spyOn(noteRead, 'listNotes')

    render(<App />)
    await screen.findByRole('heading', { name: /Good (morning|afternoon|evening)/ })
    await waitFor(() => expect(shellSpy).toHaveBeenCalled())
    await waitFor(() => expect(notesSpy).toHaveBeenCalled())
    const shellBefore = shellSpy.mock.calls.length
    const notesBefore = notesSpy.mock.calls.length

    await saveQuickNotes('Quick line one')

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 40))
    })
    expect(shellSpy.mock.calls.length).toBe(shellBefore)
    expect(notesSpy.mock.calls.length).toBe(notesBefore)
  })

  it('refreshes Notes after Dexie clear and restore without a page reload', async () => {
    const user = userEvent.setup()
    const created = await createNote({
      title: 'Restore me',
      body: 'persisted',
      subjectId: '',
      tags: [],
    })

    render(<App />)
    await user.click(await screen.findByRole('button', { name: 'Notes' }))
    expect(await screen.findByText('Restore me')).toBeInTheDocument()

    const snapshot = await exportStudyData()
    expect(snapshot.notes.map((note) => note.title)).toContain('Restore me')

    await studyDb.notes.clear()
    await waitFor(() => expect(screen.getByText('No notes yet')).toBeInTheDocument())

    await studyDb.notes.bulkPut(snapshot.notes)
    expect(await screen.findByText('Restore me')).toBeInTheDocument()
    expect(created.id).toBe(snapshot.notes[0]?.id)
  })

  it('keeps full getStudyData / export snapshots including Notes', async () => {
    await createNote({
      title: 'Export note',
      body: 'full snapshot',
      subjectId: '',
      tags: ['keep'],
    })
    const full = await getStudyData()
    const exported = await exportStudyData()
    expect(full.notes).toHaveLength(1)
    expect(full.notes[0]?.title).toBe('Export note')
    expect(exported.notes).toEqual(full.notes)
    expect(exported.version).toBe(4)
  })

  it('updates Home recent notes ordering after a Note update without shell Notes reads', async () => {
    // Distinct updatedAt values: back-to-back createNote() often shares one ISO millisecond,
    // and Dexie orderBy(updatedAt).reverse() is non-deterministic on ties.
    await studyDb.notes.bulkAdd([
      {
        id: 'note-older-recent',
        title: 'Older recent',
        body: 'a',
        subjectId: '',
        tags: [],
        createdAt: '2026-07-01T10:00:00.000Z',
        updatedAt: '2026-07-01T10:00:00.000Z',
      },
      {
        id: 'note-newer-recent',
        title: 'Newer recent',
        body: 'b',
        subjectId: '',
        tags: [],
        createdAt: '2026-07-01T11:00:00.000Z',
        updatedAt: '2026-07-01T11:00:00.000Z',
      },
    ])

    const shellSpy = vi.spyOn(subjectRead, 'listSubjects')
    const notesSpy = vi.spyOn(noteRead, 'listNotes')

    render(<App />)
    await screen.findByRole('heading', { name: 'Recent Notes' })
    const list = screen.getByRole('heading', { name: 'Recent Notes' }).closest('section') as HTMLElement
    await waitFor(() => {
      const titles = within(list).getAllByRole('heading', { level: 3 }).map((node) => node.textContent)
      expect(titles[0]).toBe('Newer recent')
    })

    const shellBefore = shellSpy.mock.calls.length
    const notesBefore = notesSpy.mock.calls.length
    await updateNote('note-older-recent', {
      title: 'Older recent bumped',
      body: 'a',
      subjectId: '',
      tags: [],
    })

    await waitFor(() => expect(notesSpy.mock.calls.length).toBeGreaterThan(notesBefore))
    expect(shellSpy.mock.calls.length).toBe(shellBefore)
    await waitFor(() => {
      const nextTitles = within(list).getAllByRole('heading', { level: 3 }).map((node) => node.textContent)
      expect(nextTitles[0]).toBe('Older recent bumped')
    })
  })
})
