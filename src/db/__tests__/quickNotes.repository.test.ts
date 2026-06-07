import { describe, it, expect, beforeEach } from 'vitest'
import { db } from '../db'
import { resetDatabase } from '../../test/dbTestUtils'
import { addNote, updateNote, deleteNote } from '../repositories/quickNotes'

describe('quickNotes repository', () => {
  beforeEach(async () => {
    await resetDatabase()
  })

  it('addNote creates a note', async () => {
    await addNote('Title', 'Body text')
    const notes = await db.quick_notes.toArray()
    expect(notes).toHaveLength(1)
    expect(notes[0].title).toBe('Title')
    expect(notes[0].content).toBe('Body text')
  })

  it('updateNote changes fields', async () => {
    await addNote('Old', 'Old body')
    const id = (await db.quick_notes.toArray())[0].id!
    await updateNote(id, 'New', 'New body', undefined, '#ff0000')
    const note = await db.quick_notes.get(id)
    expect(note?.title).toBe('New')
    expect(note?.color).toBe('#ff0000')
  })

  it('deleteNote removes the row', async () => {
    await addNote('Temp', 'Remove me')
    const id = (await db.quick_notes.toArray())[0].id!
    await deleteNote(id)
    expect(await db.quick_notes.count()).toBe(0)
  })
})
