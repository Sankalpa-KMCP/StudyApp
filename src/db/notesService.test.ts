import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { createNote, deleteNote, updateNote } from './notesService'
import { SubjectNotFoundError } from './subjectValidation'
import { studyDb } from './studyDb'

describe('notesService', () => {
  beforeEach(async () => {
    await studyDb.delete()
    await studyDb.open()
  })

  afterEach(async () => {
    if (studyDb.isOpen()) studyDb.close()
    await studyDb.delete()
  })

  it('creates a note with generated id, fields, and matching created/updated timestamps for existing subject', async () => {
    await studyDb.subjects.add({
      id: 'subject-chem',
      name: 'Chemistry',
      color: '#10b981',
      targetHours: 8,
      progress: 0,
      progressMode: 'manual',
      createdAt: '2026-07-01T00:00:00.000Z',
      updatedAt: '2026-07-01T00:00:00.000Z',
    })

    const created = await createNote({
      title: 'Exam checklist',
      body: 'Past papers',
      subjectId: 'subject-chem',
      tags: ['exam', 'review'],
    })

    expect(created.id).toMatch(/^note-/)
    expect(created).toMatchObject({
      title: 'Exam checklist',
      body: 'Past papers',
      subjectId: 'subject-chem',
      tags: ['exam', 'review'],
    })
    expect(created.createdAt).toBe(created.updatedAt)
    expect(Number.isNaN(Date.parse(created.createdAt))).toBe(false)
    expect(await studyDb.notes.get(created.id)).toEqual(created)
  })

  it('creates a note with general subjectId: ""', async () => {
    const created = await createNote({
      title: 'General note',
      body: 'General thought',
      subjectId: '',
      tags: ['general'],
    })

    expect(created.subjectId).toBe('')
    expect(await studyDb.notes.get(created.id)).toEqual(created)
  })

  it('rejects createNote when subjectId does not exist and leaves notes store empty', async () => {
    let thrownError: unknown = null
    try {
      await createNote({
        title: 'Orphan note',
        body: 'Orphan body',
        subjectId: 'subject-nonexistent',
        tags: ['orphan'],
      })
    } catch (err) {
      thrownError = err
    }

    expect(thrownError).toBeInstanceOf(SubjectNotFoundError)
    expect((thrownError as SubjectNotFoundError).code).toBe('subject_not_found')
    expect((thrownError as SubjectNotFoundError).subjectId).toBe('subject-nonexistent')
    expect(await studyDb.notes.count()).toBe(0)
  })

  it('updates editable fields and refreshes updatedAt while preserving createdAt', async () => {
    await studyDb.subjects.add({
      id: 'subject-math',
      name: 'Mathematics',
      color: '#3b82f6',
      targetHours: 10,
      progress: 0,
      progressMode: 'manual',
      createdAt: '2026-07-01T00:00:00.000Z',
      updatedAt: '2026-07-01T00:00:00.000Z',
    })

    const original = await createNote({
      title: 'Original',
      body: 'Body',
      subjectId: '',
      tags: ['a'],
    })

    await updateNote(original.id, {
      title: 'Renamed',
      body: 'New body',
      subjectId: 'subject-math',
      tags: ['b', 'c'],
    })

    const stored = await studyDb.notes.get(original.id)
    expect(stored).toMatchObject({
      id: original.id,
      title: 'Renamed',
      body: 'New body',
      subjectId: 'subject-math',
      tags: ['b', 'c'],
      createdAt: original.createdAt,
    })
    expect(stored?.updatedAt).toBeTruthy()
    expect(Date.parse(stored!.updatedAt)).toBeGreaterThanOrEqual(Date.parse(original.createdAt))
  })

  it('rejects updateNote when assigning a nonexistent subjectId and preserves original note', async () => {
    const original = await createNote({
      title: 'Preserve note',
      body: 'Original content',
      subjectId: '',
      tags: ['safe'],
    })

    let thrownError: unknown = null
    try {
      await updateNote(original.id, {
        title: 'Attempted note rename',
        body: 'New body',
        subjectId: 'subject-ghost',
        tags: ['ghost'],
      })
    } catch (err) {
      thrownError = err
    }

    expect(thrownError).toBeInstanceOf(SubjectNotFoundError)
    expect((thrownError as SubjectNotFoundError).subjectId).toBe('subject-ghost')

    const stored = await studyDb.notes.get(original.id)
    expect(stored).toEqual(original)
  })

  it('throws when updating a missing note', async () => {
    await expect(updateNote('note-missing', {
      title: 'Gone',
      body: '',
      subjectId: '',
      tags: [],
    })).rejects.toThrow('Note no longer exists.')
  })

  it('deletes an existing note', async () => {
    const created = await createNote({
      title: 'Temporary',
      body: '',
      subjectId: '',
      tags: [],
    })

    await deleteNote(created.id)
    expect(await studyDb.notes.get(created.id)).toBeUndefined()
  })

  it('treats deleting a missing note as success', async () => {
    await expect(deleteNote('note-already-gone')).resolves.toBeUndefined()
    expect(await studyDb.notes.count()).toBe(0)
  })
})
