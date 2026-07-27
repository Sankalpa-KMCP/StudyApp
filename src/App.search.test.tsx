import { act, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import App from './App'
import { studyDb } from './db/studyDb'
import { createNote } from './db/notesService'
import { createFlashcard } from './db/flashcardService'
import { createCalendarEvent } from './db/calendarEventService'
import { createTask } from './db/taskService'
import { pathForView } from './navigation/viewRoutes'
import { flushDeferredAppWork, resetAppTestEnvironment } from './test/appTestSetup'
import * as subjectRead from './db/subjectRead'

async function seedSearchCorpus() {
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
  await createTask({
    title: 'Cell cycle worksheet',
    subjectId: 'subject-search',
    dueDate: '',
    priority: 'high',
    minutes: 30,
  })
  await createNote({
    title: 'Mitosis summary',
    body: 'Phases of mitosis',
    subjectId: 'subject-search',
    tags: ['exam'],
  })
  await createFlashcard({
    front: 'What is DNA?',
    back: 'Genetic material',
    subjectId: 'subject-search',
  })
  await createCalendarEvent({
    title: 'Lab block',
    subjectId: 'subject-search',
    startAt: new Date(Date.now() + 3_600_000).toISOString(),
    endAt: new Date(Date.now() + 7_200_000).toISOString(),
    location: 'Room 12',
  })
}

describe('App global search', () => {
  beforeEach(async () => {
    await resetAppTestEnvironment()
  })

  afterEach(async () => {
    await flushDeferredAppWork()
  })

  it('opens results from Home and navigates Task selection without mutation', async () => {
    const user = userEvent.setup()
    await seedSearchCorpus()
    const taskCount = await studyDb.tasks.count()
    render(<App />)

    const search = await screen.findByRole('combobox', { name: 'Search' })
    await user.type(search, 'cell')
    expect(await screen.findByRole('listbox')).toBeInTheDocument()
    await user.click(await screen.findByRole('option', { name: /Task.*Cell cycle worksheet/i }))

    expect(window.location.pathname).toBe(pathForView('Tasks'))
    expect(await screen.findByRole('heading', { level: 1, name: 'Tasks' })).toBeInTheDocument()
    expect(search).toHaveValue('')
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument()
    expect(await studyDb.tasks.count()).toBe(taskCount)
  })

  it('navigates Note, Subject, Flashcard, and Event results from a non-Home route', async () => {
    const user = userEvent.setup()
    await seedSearchCorpus()
    render(<App />)

    await user.click(await screen.findByRole('button', { name: 'Progress' }))
    const search = screen.getByRole('combobox', { name: 'Search' })

    await user.type(search, 'Mitosis')
    await user.click(await screen.findByRole('option', { name: /Note.*Mitosis summary/i }))
    expect(window.location.pathname).toBe(pathForView('Notes'))
    expect(search).toHaveValue('')

    await user.type(search, 'Biology')
    await user.click(await screen.findByRole('option', { name: /Subject.*Biology/i }))
    expect(window.location.pathname).toBe(pathForView('Subjects'))

    await user.type(search, 'DNA')
    await user.click(await screen.findByRole('option', { name: /Flashcard.*What is DNA/i }))
    expect(window.location.pathname).toBe(pathForView('Flashcards'))

    await user.type(search, 'Lab block')
    await user.click(await screen.findByRole('option', { name: /Event.*Lab block/i }))
    expect(window.location.pathname).toBe(pathForView('Calendar'))
  })

  it('supports keyboard navigation and Enter activation', async () => {
    const user = userEvent.setup()
    await seedSearchCorpus()
    render(<App />)

    const search = await screen.findByRole('combobox', { name: 'Search' })
    await user.type(search, 'Biology')
    const listbox = await screen.findByRole('listbox')
    expect(within(listbox).getAllByRole('option').length).toBeGreaterThan(0)

    await user.keyboard('{ArrowDown}')
    await user.keyboard('{Enter}')
    expect(window.location.pathname).not.toBe(pathForView('Home'))
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument()
  })

  it('closes with Escape without clearing, then clears on a second Escape', async () => {
    const user = userEvent.setup()
    await seedSearchCorpus()
    render(<App />)

    const search = await screen.findByRole('combobox', { name: 'Search' })
    await user.type(search, 'cell')
    expect(await screen.findByRole('listbox')).toBeInTheDocument()
    await user.keyboard('{Escape}')
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument()
    expect(search).toHaveValue('cell')
    expect(search).toHaveFocus()

    await user.keyboard('{Escape}')
    expect(search).toHaveValue('')
  })

  it('preserves Back/Forward after selecting a result', async () => {
    const user = userEvent.setup()
    await seedSearchCorpus()
    render(<App />)

    const search = await screen.findByRole('combobox', { name: 'Search' })
    await user.type(search, 'cell')
    await user.click(await screen.findByRole('option', { name: /Task.*Cell cycle worksheet/i }))
    expect(window.location.pathname).toBe(pathForView('Tasks'))

    act(() => {
      window.history.back()
    })
    await waitFor(() => {
      expect(window.location.pathname).toBe(pathForView('Home'))
    })

    act(() => {
      window.history.forward()
    })
    await waitFor(() => {
      expect(window.location.pathname).toBe(pathForView('Tasks'))
    })
  })

  it('keeps workspace filtering after typing without selecting a result', async () => {
    const user = userEvent.setup()
    await seedSearchCorpus()
    await createTask({
      title: 'Unrelated chemistry homework',
      subjectId: '',
      dueDate: '',
      priority: 'normal',
      minutes: 20,
    })
    render(<App />)

    await user.click(await screen.findByRole('button', { name: 'Tasks' }))
    await user.type(screen.getByRole('combobox', { name: 'Search' }), 'cell')
    expect(await screen.findByRole('option', { name: /Task.*Cell cycle worksheet/i })).toBeInTheDocument()
    const tasksMain = within(screen.getByRole('main'))
    expect(await tasksMain.findByRole('heading', { name: 'Cell cycle worksheet' })).toBeInTheDocument()
    expect(tasksMain.queryByRole('heading', { name: 'Unrelated chemistry homework' })).not.toBeInTheDocument()
  })

  it('disables search in the live-read fallback and does not reopen results after Retry', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined)
    const user = userEvent.setup()
    let shouldFail = true
    vi.spyOn(subjectRead, 'listSubjects').mockImplementation(async () => {
      if (shouldFail) throw new Error('subjects unavailable')
      return studyDb.subjects.orderBy('createdAt').toArray()
    })

    render(<App />)
    expect(await screen.findByRole('alert')).toBeInTheDocument()
    const search = screen.getByRole('combobox', { name: 'Search' })
    expect(search).toBeDisabled()
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument()

    shouldFail = false
    await user.click(screen.getByRole('button', { name: 'Retry' }))
    await screen.findByRole('heading', { name: /Good (morning|afternoon|evening)/ })
    expect(screen.getByRole('combobox', { name: 'Search' })).toBeEnabled()
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument()
  })

  it('coexists with Quick add without leaving the results panel open', async () => {
    const user = userEvent.setup()
    await seedSearchCorpus()
    render(<App />)

    const search = await screen.findByRole('combobox', { name: 'Search' })
    await user.type(search, 'cell')
    expect(await screen.findByRole('listbox')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Quick add' }))
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument()
    expect(screen.getByRole('menu', { name: 'Quick add' })).toBeInTheDocument()
  })
})
