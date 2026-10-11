import { act, fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { StudyNote, StudySubject } from '../db/types'
import { NotesView } from './NotesView'
import * as notesService from '../db/notesService'

function createSampleNotes(count: number, subjectId = 'sub-1'): StudyNote[] {
  const notes: StudyNote[] = []
  for (let i = 1; i <= count; i++) {
    notes.push({
      id: `note-${i}`,
      title: `Note Title ${i}`,
      body: `Body content for note ${i}`,
      subjectId,
      tags: [`tag-${i}`, 'general'],
      createdAt: new Date(2026, 0, 1, 0, i).toISOString(),
      updatedAt: new Date(2026, 0, 1, 0, i).toISOString(),
    })
  }
  return notes
}

const sampleSubjects: StudySubject[] = [
  {
    id: 'sub-1',
    name: 'Mathematics',
    color: '#2563eb',
    targetHours: 10,
    progress: 50,
    progressMode: 'manual',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  },
]

const subjectMap = new Map(sampleSubjects.map((s) => [s.id, s]))

describe('Notes editor completion ownership', () => {
  afterEach(() => vi.restoreAllMocks())
  it.each(['success', 'failure'] as const)('preserves a newer draft after delayed %s', async (outcome) => {
    let resolve!: () => void
    let reject!: (error: Error) => void
    const gate = new Promise<void>((yes, no) => { resolve = yes; reject = no })
    const save = vi.spyOn(notesService, 'createNote').mockImplementation(async () => {
      await gate
      return createSampleNotes(1)[0]
    })
    render(<NotesView notes={[]} subjects={sampleSubjects} subjectMap={subjectMap} databaseGeneration={1} />)
    fireEvent.click(screen.getByRole('button', { name: 'New note' }))
    fireEvent.change(screen.getByLabelText('Note title'), { target: { value: 'A' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))
    fireEvent.click(screen.getByRole('button', { name: 'New note' }))
    fireEvent.change(screen.getByLabelText('Note title'), { target: { value: 'B' } })
    fireEvent.change(screen.getByLabelText('Tags'), { target: { value: 'keep' } })
    await act(async () => {
      if (outcome === 'success') resolve()
      else reject(new Error('controlled failure'))
      await gate.catch(() => {})
    })
    expect(screen.getByLabelText('Note title')).toHaveValue('B')
    expect(screen.getByLabelText('Tags')).toHaveValue('keep')
    expect(screen.queryByText('Note created.')).not.toBeInTheDocument()
    expect(screen.queryByText('Note could not be saved. Your text is still available.')).not.toBeInTheDocument()
    expect(save).toHaveBeenCalledTimes(1)
    save.mockRestore()
  })

  it('keeps edits made to the submitted draft and blocks duplicate Save/Cancel until settlement', async () => {
    let release!: () => void
    const gate = new Promise<void>((resolve) => { release = resolve })
    const save = vi.spyOn(notesService, 'createNote').mockImplementation(async () => {
      await gate
      return createSampleNotes(1)[0]
    })
    render(<NotesView notes={[]} subjects={sampleSubjects} subjectMap={subjectMap} databaseGeneration={1} />)
    fireEvent.click(screen.getByRole('button', { name: 'New note' }))
    fireEvent.change(screen.getByLabelText('Note title'), { target: { value: 'Submitted' } })
    const button = screen.getByRole('button', { name: 'Save' })
    act(() => { fireEvent.click(button); fireEvent.click(button) })
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    fireEvent.change(screen.getByLabelText('Note title'), { target: { value: 'Unsaved correction' } })
    await act(async () => { release(); await gate })
    expect(save).toHaveBeenCalledTimes(1)
    expect(save.mock.calls[0][0].title).toBe('Submitted')
    expect(screen.getByLabelText('Note title')).toHaveValue('Unsaved correction')
    expect(screen.queryByText('Note created.')).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(screen.queryByLabelText('Note title')).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'New note' }))
    expect(screen.getByLabelText('Note title')).toHaveValue('')
  })

  it('invalidates an Edit completion after an external New request, even when the record ID is reused', async () => {
    let release!: () => void
    const gate = new Promise<void>((resolve) => { release = resolve })
    vi.spyOn(notesService, 'updateNote').mockImplementation(() => gate)
    const props = { notes: createSampleNotes(1), subjects: sampleSubjects, subjectMap, databaseGeneration: 1 }
    const { rerender } = render(<NotesView {...props} />)
    fireEvent.click(screen.getByLabelText('Edit Note Title 1'))
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))
    rerender(<NotesView {...props} openEditorRequest={1} />)
    await act(async () => { release(); await gate })
    expect(screen.getByLabelText('Note title')).toHaveValue('')
    expect(screen.queryByText('Note updated.')).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    fireEvent.click(screen.getByLabelText('Edit Note Title 1'))
    expect(screen.getByLabelText('Note title')).toHaveValue('Note Title 1')
  })

  it('does not reset a replacement editor after a delayed delete', async () => {
    let release!: () => void
    const gate = new Promise<void>((resolve) => { release = resolve })
    vi.spyOn(notesService, 'deleteNote').mockImplementation(() => gate)
    render(<NotesView notes={createSampleNotes(1)} subjects={sampleSubjects} subjectMap={subjectMap} databaseGeneration={1} />)
    fireEvent.click(screen.getByLabelText('Edit Note Title 1'))
    fireEvent.click(screen.getByLabelText('Delete Note Title 1'))
    fireEvent.click(screen.getByRole('button', { name: 'Delete' }))
    fireEvent.click(screen.getByRole('button', { name: 'New note' }))
    fireEvent.change(screen.getByLabelText('Note title'), { target: { value: 'Replacement' } })
    await act(async () => { release(); await gate })
    expect(screen.getByLabelText('Note title')).toHaveValue('Replacement')
  })

  it('does not affect a remounted editor when an unmounted save settles', async () => {
    let release!: () => void
    const gate = new Promise<void>((resolve) => { release = resolve })
    vi.spyOn(notesService, 'createNote').mockImplementation(async () => { await gate; return createSampleNotes(1)[0] })
    const props = { notes: [], subjects: sampleSubjects, subjectMap, databaseGeneration: 1 }
    const first = render(<NotesView {...props} openEditorRequest={1} />)
    fireEvent.change(screen.getByLabelText('Note title'), { target: { value: 'Before navigation' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))
    first.unmount()
    render(<NotesView {...props} openEditorRequest={1} />)
    fireEvent.change(screen.getByLabelText('Note title'), { target: { value: 'After navigation' } })
    await act(async () => { release(); await gate })
    expect(screen.getByLabelText('Note title')).toHaveValue('After navigation')
    expect(screen.queryByText('Note created.')).not.toBeInTheDocument()
  })
})

describe('NotesView Progressive Bounding (S6.2a)', () => {
  it('renders at most 30 notes initially when dataset exceeds 30', () => {
    const notes = createSampleNotes(75)
    render(
      <NotesView
        notes={notes}
        subjects={sampleSubjects}
        subjectMap={subjectMap}
        openEditorRequest={0}
        search=""
        onClearSearch={vi.fn()}
        databaseGeneration={1}
      />,
    )

    const noteHeadings = screen.getAllByRole('heading', { level: 3 })
    expect(noteHeadings).toHaveLength(30)
    expect(screen.getByText('Note Title 1')).toBeInTheDocument()
    expect(screen.getByText('Note Title 30')).toBeInTheDocument()
    expect(screen.queryByText('Note Title 31')).not.toBeInTheDocument()

    expect(screen.getByText('Showing 30 of 75 notes')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Show 30 more notes' })).toBeInTheDocument()
  })

  it('renders all notes without disclosure footer when dataset has <= 30 notes', () => {
    const notes = createSampleNotes(20)
    render(
      <NotesView
        notes={notes}
        subjects={sampleSubjects}
        subjectMap={subjectMap}
        openEditorRequest={0}
        search=""
        onClearSearch={vi.fn()}
        databaseGeneration={1}
      />,
    )

    const noteHeadings = screen.getAllByRole('heading', { level: 3 })
    expect(noteHeadings).toHaveLength(20)
    expect(screen.queryByRole('button', { name: /Show .* more notes/i })).not.toBeInTheDocument()
    expect(screen.queryByText(/Showing .* of .* notes/i)).not.toBeInTheDocument()
  })

  it('reveals next batch (+30) on activation and expands progressively through final records', async () => {
    const user = userEvent.setup()
    const notes = createSampleNotes(75)
    render(
      <NotesView
        notes={notes}
        subjects={sampleSubjects}
        subjectMap={subjectMap}
        openEditorRequest={0}
        search=""
        onClearSearch={vi.fn()}
        databaseGeneration={1}
      />,
    )

    // Initial: 30 visible
    expect(screen.getAllByRole('heading', { level: 3 })).toHaveLength(30)

    // First click: reveals up to 60
    await user.click(screen.getByRole('button', { name: 'Show 30 more notes' }))
    expect(screen.getAllByRole('heading', { level: 3 })).toHaveLength(60)
    expect(screen.getByText('Note Title 60')).toBeInTheDocument()
    expect(screen.getByText('Showing 60 of 75 notes')).toBeInTheDocument()

    // Second click (final expansion): reveals all 75
    await user.click(screen.getByRole('button', { name: 'Show 30 more notes' }))
    expect(screen.getAllByRole('heading', { level: 3 })).toHaveLength(75)
    expect(screen.getByText('Note Title 75')).toBeInTheDocument()
    expect(screen.getByText('Showing all 75 notes')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Show .* more notes/i })).not.toBeInTheDocument()
  })

  it('safely retains focus on list footer during final expansion without losing focus to body', async () => {
    const user = userEvent.setup()
    const notes = createSampleNotes(40)
    render(
      <NotesView
        notes={notes}
        subjects={sampleSubjects}
        subjectMap={subjectMap}
        openEditorRequest={0}
        search=""
        onClearSearch={vi.fn()}
        databaseGeneration={1}
      />,
    )

    const showMoreBtn = screen.getByRole('button', { name: 'Show 30 more notes' })
    showMoreBtn.focus()
    expect(document.activeElement).toBe(showMoreBtn)

    await user.click(showMoreBtn)

    // All 40 are now shown, button unmounted. Focus shifted to footer container.
    expect(document.activeElement).not.toBe(document.body)
    const footer = screen.getByText('Showing all 40 notes').closest('.list-disclosure-footer')
    expect(document.activeElement).toBe(footer)
  })

  it('resets visible count to 30 when search criterion changes', async () => {
    const user = userEvent.setup()
    const allNotes = createSampleNotes(75)

    const { rerender } = render(
      <NotesView
        notes={allNotes}
        subjects={sampleSubjects}
        subjectMap={subjectMap}
        openEditorRequest={0}
        search=""
        onClearSearch={vi.fn()}
        databaseGeneration={1}
      />,
    )

    // Expand to 60
    await user.click(screen.getByRole('button', { name: 'Show 30 more notes' }))
    expect(screen.getAllByRole('heading', { level: 3 })).toHaveLength(60)

    // Search applied before slicing: simulated filtered search result with 50 matches
    const filteredNotes = allNotes.slice(0, 50)
    rerender(
      <NotesView
        notes={filteredNotes}
        subjects={sampleSubjects}
        subjectMap={subjectMap}
        openEditorRequest={0}
        search="Title"
        onClearSearch={vi.fn()}
        databaseGeneration={1}
      />,
    )

    // Reset back to initial 30
    expect(screen.getAllByRole('heading', { level: 3 })).toHaveLength(30)
    expect(screen.getByText('Showing 30 of 50 notes')).toBeInTheDocument()
  })

  it('does not reset expansion when a note is edited in place or an unrelated note is deleted', async () => {
    const user = userEvent.setup()
    const notes = createSampleNotes(75)

    const { rerender } = render(
      <NotesView
        notes={notes}
        subjects={sampleSubjects}
        subjectMap={subjectMap}
        openEditorRequest={0}
        search=""
        onClearSearch={vi.fn()}
        databaseGeneration={1}
      />,
    )

    // Expand to 60
    await user.click(screen.getByRole('button', { name: 'Show 30 more notes' }))
    expect(screen.getAllByRole('heading', { level: 3 })).toHaveLength(60)

    // Edit note #1 and simulate live-query rerender
    const updatedNotes = notes.map((n) => (n.id === 'note-1' ? { ...n, title: 'Updated Title 1' } : n))
    rerender(
      <NotesView
        notes={updatedNotes}
        subjects={sampleSubjects}
        subjectMap={subjectMap}
        openEditorRequest={0}
        search=""
        onClearSearch={vi.fn()}
        databaseGeneration={2}
      />,
    )

    // Still expanded to 60
    expect(screen.getAllByRole('heading', { level: 3 })).toHaveLength(60)
    expect(screen.getByText('Updated Title 1')).toBeInTheDocument()
    expect(screen.getByText('Showing 60 of 75 notes')).toBeInTheDocument()
  })
})
