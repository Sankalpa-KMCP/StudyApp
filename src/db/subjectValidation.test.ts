import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import {
  assertSubjectExists,
  isSubjectNotFoundError,
  SubjectNotFoundError,
} from './subjectValidation'
import { studyDb } from './studyDb'

describe('subjectValidation', () => {
  beforeEach(async () => {
    await studyDb.delete()
    await studyDb.open()
  })

  afterEach(async () => {
    if (studyDb.isOpen()) studyDb.close()
    await studyDb.delete()
  })

  it('allows empty subjectId without database query', async () => {
    await expect(assertSubjectExists('')).resolves.toBeUndefined()
  })

  it('allows valid existing subjectId within transaction', async () => {
    await studyDb.subjects.add({
      id: 'subject-math',
      name: 'Mathematics',
      color: '#3b82f6',
      targetHours: 10,
      progress: 0,
      progressMode: 'manual',
      createdAt: '2026-08-22T00:00:00.000Z',
      updatedAt: '2026-08-22T00:00:00.000Z',
    })

    await expect(
      studyDb.transaction('r', studyDb.subjects, async () => {
        await assertSubjectExists('subject-math')
      }),
    ).resolves.toBeUndefined()
  })

  it('throws SubjectNotFoundError when subjectId does not exist', async () => {
    let thrownError: unknown = null
    try {
      await studyDb.transaction('r', studyDb.subjects, async () => {
        await assertSubjectExists('subject-missing')
      })
    } catch (err) {
      thrownError = err
    }

    expect(thrownError).toBeInstanceOf(SubjectNotFoundError)
    expect(thrownError).toBeInstanceOf(Error)
    expect(isSubjectNotFoundError(thrownError)).toBe(true)

    const subjectError = thrownError as SubjectNotFoundError
    expect(subjectError.name).toBe('SubjectNotFoundError')
    expect(subjectError.code).toBe('subject_not_found')
    expect(subjectError.subjectId).toBe('subject-missing')
    expect(subjectError.message).toBe('Subject no longer exists.')
  })

  it('isSubjectNotFoundError returns false for ordinary errors', () => {
    expect(isSubjectNotFoundError(new Error('Generic error'))).toBe(false)
    expect(isSubjectNotFoundError(null)).toBe(false)
    expect(isSubjectNotFoundError(undefined)).toBe(false)
    expect(isSubjectNotFoundError({ message: 'Fake error' })).toBe(false)
  })
})
