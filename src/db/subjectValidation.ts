import { studyDb } from './studyDb'

/**
 * Distinguishable domain error thrown when an operation references a non-existent subject.
 */
export class SubjectNotFoundError extends Error {
  readonly code = 'subject_not_found' as const
  readonly subjectId: string

  constructor(subjectId: string, message = 'Subject no longer exists.') {
    super(message)
    this.name = 'SubjectNotFoundError'
    this.subjectId = subjectId
  }
}

/**
 * Type guard to identify SubjectNotFoundError instances.
 */
export function isSubjectNotFoundError(error: unknown): error is SubjectNotFoundError {
  return (
    error instanceof SubjectNotFoundError ||
    (error instanceof Error &&
      (error as { code?: string }).code === 'subject_not_found')
  )
}

/**
 * Validates that a subject reference exists if non-empty.
 * Empty string represents General / unassigned and is always valid.
 * Throws SubjectNotFoundError if a non-empty subjectId does not exist in studyDb.subjects.
 * Must be executed inside a Dexie transaction containing studyDb.subjects to guarantee atomicity.
 */
export async function assertSubjectExists(subjectId: string): Promise<void> {
  if (!subjectId) return
  const subject = await studyDb.subjects.get(subjectId)
  if (!subject) {
    throw new SubjectNotFoundError(subjectId)
  }
}
