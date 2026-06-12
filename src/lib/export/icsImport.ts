import type { HistoryEntry } from '../../db/types'
import { parseLegacyHistoryTimestamp } from '../study/studyDashboard'

function unfoldIcsLines(content: string): string[] {
  const raw = content.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n')
  const lines: string[] = []
  for (const line of raw) {
    if (line.startsWith(' ') || line.startsWith('\t')) {
      lines[lines.length - 1] += line.slice(1)
    } else {
      lines.push(line)
    }
  }
  return lines
}

function parseIcsDate(value: string): number {
  const clean = value.replace(/Z$/, '')
  if (clean.length === 8) {
    const y = Number(clean.slice(0, 4))
    const m = Number(clean.slice(4, 6)) - 1
    const d = Number(clean.slice(6, 8))
    return new Date(y, m, d).getTime()
  }
  const y = Number(clean.slice(0, 4))
  const m = Number(clean.slice(4, 6)) - 1
  const d = Number(clean.slice(6, 8))
  const h = Number(clean.slice(9, 11))
  const min = Number(clean.slice(11, 13))
  const s = Number(clean.slice(13, 15))
  return new Date(Date.UTC(y, m, d, h, min, s)).getTime()
}

export function parseStudyHistoryIcs(content: string): Omit<HistoryEntry, 'id'>[] {
  const lines = unfoldIcsLines(content)
  const entries: Omit<HistoryEntry, 'id'>[] = []
  let inEvent = false
  let dtStart: number | null = null
  let dtEnd: number | null = null
  let summary = ''

  for (const line of lines) {
    if (line === 'BEGIN:VEVENT') {
      inEvent = true
      dtStart = null
      dtEnd = null
      summary = ''
      continue
    }
    if (line === 'END:VEVENT' && inEvent) {
      if (dtStart != null) {
        const durationMinutes = dtEnd != null
          ? Math.max(1, Math.round((dtEnd - dtStart) / 60000))
          : 25
        const date = new Date(dtStart)
        const timestamp = date.toLocaleString('en-US', {
          month: 'short',
          day: 'numeric',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
          hour12: true,
        })
        entries.push({
          timestamp,
          createdAt: dtStart,
          type: 'study',
          durationMinutes,
          sessionNotes: summary.startsWith('Study:') ? undefined : summary || undefined,
        })
      }
      inEvent = false
      continue
    }
    if (!inEvent) continue
    const [key, ...rest] = line.split(':')
    const value = rest.join(':').replace(/\\n/g, '\n').replace(/\\,/g, ',')
    const prop = key?.split(';')[0]
    if (prop === 'DTSTART') dtStart = parseIcsDate(value)
    if (prop === 'DTEND') dtEnd = parseIcsDate(value)
    if (prop === 'SUMMARY') summary = value
  }

  return entries.map(e => ({
    ...e,
    createdAt: e.createdAt ?? parseLegacyHistoryTimestamp(e.timestamp),
  }))
}
