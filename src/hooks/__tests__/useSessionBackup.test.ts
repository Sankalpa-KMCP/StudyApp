import { describe, it, expect } from 'vitest'
import { parseStudyBackupPayload, validateBackupPayload } from '../../lib/studyDashboard'

describe('useSessionBackup payload helpers', () => {
  it('parses valid backup JSON', () => {
    const payload = {
      version: 2,
      exportedAt: new Date().toISOString(),
      tasks: [{ text: 'Task', completed: false }],
      history: [],
      dailyLogs: [],
      settings: [],
      categories: [],
      flashcards: [],
      quickNotes: [],
    }
    const parsed = parseStudyBackupPayload(JSON.stringify(payload))
    expect(parsed).not.toBeNull()
    expect(parsed?.tasks).toHaveLength(1)
  })

  it('rejects invalid backup shape', () => {
    expect(validateBackupPayload({ tasks: [{ text: 1, completed: false }] })).toBe(false)
  })
})
