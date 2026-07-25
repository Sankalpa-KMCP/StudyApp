import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { createNote, deleteNote, updateNote } from './notesService'
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

  it('creates a note with generated id, fields, and matching created/updated timestamps', async () => {
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

  it('updates editable fields and refreshes updatedAt while preserving createdAt', async () => {
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
