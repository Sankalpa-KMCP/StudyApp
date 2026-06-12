import { describe, it, expect } from 'vitest'
import { parseStudyBackupPayload, validateBackupPayload } from '../studyDashboard/backupSchema'

describe('backupSchema', () => {
  it('rejects non-object backup payloads', () => {
    expect(validateBackupPayload(null)).toBe(false)
    expect(validateBackupPayload([])).toBe(false)
    expect(validateBackupPayload('string')).toBe(false)
  })

  it('accepts minimal valid backup shape', () => {
    expect(validateBackupPayload({ version: 2, tasks: [], history: [] })).toBe(true)
  })

  it('rejects tasks with invalid entries', () => {
    expect(validateBackupPayload({ tasks: [{ text: 1, completed: true }] })).toBe(false)
  })

  it('parses backup JSON with quick_notes alias', () => {
    const raw = JSON.stringify({
      version: 2,
      quick_notes: [{ title: 'Note', content: 'Body', updatedAt: 1 }],
    })
    const parsed = parseStudyBackupPayload(raw)
    expect(parsed?.quickNotes).toHaveLength(1)
    expect(parsed?.quickNotes[0].title).toBe('Note')
  })

  it('returns null for invalid JSON', () => {
    expect(parseStudyBackupPayload('not-json')).toBeNull()
  })
})
