import { StrictMode, act } from 'react'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import App from './App'
import { studyDb } from './db/studyDb'
import { createNote } from './db/notesService'
import { createFlashcard } from './db/flashcardService'
import { pathForView } from './navigation/viewRoutes'
import { flushDeferredAppWork, resetAppTestEnvironment } from './test/appTestSetup'

async function openQuickAddItem(user: ReturnType<typeof userEvent.setup>, label: 'Task' | 'Note' | 'Event' | 'Flashcard') {
  await user.click(await screen.findByRole('button', { name: 'Quick add' }))
  await user.click(within(screen.getByRole('menu', { name: 'Quick add' })).getByRole('menuitem', { name: label }))
}

describe('App quick add', () => {
  beforeEach(async () => {
    await resetAppTestEnvironment()
  })

  afterEach(async () => {
    await flushDeferredAppWork()
  })

  it('opens Task create from another route and while already on Tasks', async () => {
    const user = userEvent.setup()
    render(<App />)

    await screen.findByRole('heading', { name: /Good (morning|afternoon|evening)/ })
    await openQuickAddItem(user, 'Task')
    expect(await screen.findByLabelText('Task title')).toBeInTheDocument()
    expect(window.location.pathname).toBe(pathForView('Tasks'))
    expect(await studyDb.tasks.count()).toBe(0)

    await user.click(screen.getByRole('button', { name: 'Cancel' }))
    await openQuickAddItem(user, 'Task')
    expect(await screen.findByLabelText('Task title')).toBeInTheDocument()
    expect(window.location.pathname).toBe(pathForView('Tasks'))
  })

  it('opens Note create, repeats after close, and does not create until submit', async () => {
    const user = userEvent.setup()
    render(<App />)

    await openQuickAddItem(user, 'Note')
    expect(await screen.findByLabelText('Note title')).toBeInTheDocument()
    expect(window.location.pathname).toBe(pathForView('Notes'))
    expect(await studyDb.notes.count()).toBe(0)

    await user.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(screen.queryByLabelText('Note title')).not.toBeInTheDocument()

    await openQuickAddItem(user, 'Note')
    expect(await screen.findByLabelText('Note title')).toBeInTheDocument()
  })

  it('opens Event create with local-date defaults and supports cancel/repeat', async () => {
    const user = userEvent.setup()
    render(<App />)

    await openQuickAddItem(user, 'Event')
    expect(await screen.findByLabelText('Event title')).toBeInTheDocument()
    expect(window.location.pathname).toBe(pathForView('Calendar'))
    const today = new Date()
    const localDate = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`
    expect(screen.getByLabelText('Date')).toHaveValue(localDate)
    expect(await studyDb.events.count()).toBe(0)

    await user.click(screen.getByRole('button', { name: 'Cancel' }))
    await openQuickAddItem(user, 'Event')
    expect(await screen.findByLabelText('Event title')).toBeInTheDocument()
  })

  it('opens Flashcard create without changing review reveal state', async () => {
    const user = userEvent.setup()
    await createFlashcard({
      front: 'Capital of France',
      back: 'Paris',
      subjectId: '',
    })
    render(<App />)

    await user.click(await screen.findByRole('button', { name: 'Flashcards' }))
    await user.click(await screen.findByRole('button', { name: 'Reveal' }))
    expect(screen.getByText('Paris')).toBeInTheDocument()

    await openQuickAddItem(user, 'Flashcard')
    expect(await screen.findByLabelText('Front')).toBeInTheDocument()
    expect(window.location.pathname).toBe(pathForView('Flashcards'))
    expect(screen.getByText('Paris')).toBeInTheDocument()
    expect(await studyDb.flashcards.count()).toBe(1)
  })

  it('does not replay stale create intents after popstate Back/Forward', async () => {
    const user = userEvent.setup()
    render(<App />)

    await openQuickAddItem(user, 'Note')
    expect(await screen.findByLabelText('Note title')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Cancel' }))

    await user.click(screen.getByRole('button', { name: 'Tasks' }))
    expect(await screen.findByRole('heading', { level: 1, name: 'Tasks' })).toBeInTheDocument()

    act(() => {
      window.history.back()
    })
    await waitFor(() => {
      expect(window.location.pathname).toBe(pathForView('Notes'))
      expect(screen.getByRole('heading', { level: 1, name: 'Notes' })).toBeInTheDocument()
    })
    expect(screen.queryByLabelText('Note title')).not.toBeInTheDocument()

    act(() => {
      window.history.forward()
    })
    await waitFor(() => {
      expect(window.location.pathname).toBe(pathForView('Tasks'))
    })
    expect(screen.queryByLabelText('Task title')).not.toBeInTheDocument()
  })

  it('matches workspace New draft replacement when an edit editor is already open', async () => {
    const user = userEvent.setup()
    await createNote({
      title: 'Existing note',
      body: 'Keep me until New replaces',
      subjectId: '',
      tags: [],
    })
    render(<App />)

    await user.click(await screen.findByRole('button', { name: 'Notes' }))
    await user.click(await screen.findByRole('button', { name: 'Edit Existing note' }))
    expect(await screen.findByLabelText('Note title')).toHaveValue('Existing note')

    await openQuickAddItem(user, 'Note')
    expect(await screen.findByLabelText('Note title')).toHaveValue('')
    expect(screen.getByLabelText('Body')).toHaveValue('')
  })

  it('does not open the create editor twice under StrictMode', async () => {
    const user = userEvent.setup()
    render(
      <StrictMode>
        <App />
      </StrictMode>,
    )

    await openQuickAddItem(user, 'Task')
    expect(await screen.findAllByLabelText('Task title')).toHaveLength(1)
  })

  it('does not call Dexie write services from menu selection alone', async () => {
    const user = userEvent.setup()
    const bulkAdd = vi.spyOn(studyDb.tasks, 'bulkAdd')
    const add = vi.spyOn(studyDb.tasks, 'add')
    render(<App />)

    await openQuickAddItem(user, 'Task')
    expect(await screen.findByLabelText('Task title')).toBeInTheDocument()
    expect(bulkAdd).not.toHaveBeenCalled()
    expect(add).not.toHaveBeenCalled()
  })
})
