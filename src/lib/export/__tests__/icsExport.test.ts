import { describe, expect, it } from 'vitest'
import { buildStudyHistoryIcs } from '../icsExport'

describe('icsExport', () => {
  it('builds valid ICS for study entries', () => {
    const ics = buildStudyHistoryIcs(
      [
        {
          id: 1,
          timestamp: '2026-06-01 10:00',
          createdAt: Date.UTC(2026, 5, 1, 10, 0, 0),
          type: 'study',
          durationMinutes: 25,
          categoryId: 2,
          sessionNotes: 'Good focus',
        },
        {
          id: 2,
          timestamp: '2026-06-01 11:00',
          createdAt: Date.UTC(2026, 5, 1, 11, 0, 0),
          type: 'break',
          durationMinutes: 5,
        },
      ],
      new Map([[2, 'Math']]),
    )

    expect(ics).toContain('BEGIN:VCALENDAR')
    expect(ics).toContain('SUMMARY:Study: Math')
    expect(ics).toContain('DESCRIPTION:Duration: 25 min')
    expect(ics).not.toContain('type:break')
    expect(ics).toContain('END:VCALENDAR')
  })

  it('escapes special characters in summary', () => {
    const ics = buildStudyHistoryIcs(
      [
        {
          timestamp: 't',
          createdAt: Date.UTC(2026, 0, 1, 9, 0, 0),
          type: 'study',
          durationMinutes: 10,
          sessionNotes: 'Line1\nLine2',
        },
      ],
      new Map(),
    )
    expect(ics).toContain('\\n')
  })
})
