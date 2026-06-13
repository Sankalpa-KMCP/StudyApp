import { describe, it, expect } from 'vitest'
import { escapeCsvField, buildStudyLogsCsv } from '../csvExport'

describe('csvExport', () => {
  it('escapes formula-like note fields', () => {
    expect(escapeCsvField('=SUM(A1)')).toBe(`"'=SUM(A1)"`)
    expect(escapeCsvField('normal')).toBe('"normal"')
    expect(escapeCsvField('say "hi"')).toBe('"say ""hi"""')
  })

  it('builds study logs CSV with formula guard', () => {
    const csv = buildStudyLogsCsv([
      {
        dateString: '2026-01-01',
        studyMinutes: 30,
        breakMinutes: 5,
        mood: 'good',
        notes: '=evil',
      },
    ])
    expect(csv).toContain("'=evil")
  })
})
