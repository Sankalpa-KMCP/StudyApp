import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { listNotes } from './noteRead'
import { studyDb } from './studyDb'

describe('noteRead', () => {
  beforeEach(async () => {
    await studyDb.delete()
    await studyDb.open()
  })

  afterEach(async () => {
    if (studyDb.isOpen()) studyDb.close()
    await studyDb.delete()
  })

  it('returns an empty array when no notes exist', async () => {
    expect(await listNotes()).toEqual([])
  })

  it('returns notes ordered by updatedAt descending like getStudyData', async () => {
    await studyDb.notes.bulkAdd([
      {
        id: 'note-older',
        title: 'Older',
        body: 'a',
        subjectId: '',
        tags: [],
        createdAt: '2026-07-01T10:00:00.000Z',
        updatedAt: '2026-07-01T10:00:00.000Z',
      },
      {
        id: 'note-newest',
        title: 'Newest',
        body: 'b',
        subjectId: '',
        tags: ['tag'],
        createdAt: '2026-07-01T09:00:00.000Z',
        updatedAt: '2026-07-03T12:00:00.000Z',
      },
      {
        id: 'note-middle',
        title: 'Middle',
        body: 'c',
        subjectId: '',
        tags: [],
        createdAt: '2026-07-02T00:00:00.000Z',
        updatedAt: '2026-07-02T00:00:00.000Z',
      },
    ])

    const notes = await listNotes()
    expect(notes.map((note) => note.id)).toEqual(['note-newest', 'note-middle', 'note-older'])
  })
})
