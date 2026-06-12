import type { HistoryEntry } from '../../db/types'

function pad(n: number): string {
  return String(n).padStart(2, '0')
}

function toIcsUtc(date: Date): string {
  return `${date.getUTCFullYear()}${pad(date.getUTCMonth() + 1)}${pad(date.getUTCDate())}T${pad(date.getUTCHours())}${pad(date.getUTCMinutes())}${pad(date.getUTCSeconds())}Z`
}

function escapeIcsText(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\n/g, '\\n')
}

export function buildStudyHistoryIcs(
  entries: HistoryEntry[],
  categoryNames: Map<number, string>,
): string {
  const studyEntries = entries.filter(e => e.type === 'study')
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Study Dashboard//Study Sessions//EN',
    'CALSCALE:GREGORIAN',
  ]

  for (const entry of studyEntries) {
    const start = new Date(entry.createdAt)
    const end = new Date(entry.createdAt + entry.durationMinutes * 60 * 1000)
    const category = entry.categoryId !== undefined ? categoryNames.get(entry.categoryId) : undefined
    const summary = category ? `Study: ${category}` : 'Study session'
    const descriptionParts = [`Duration: ${entry.durationMinutes} min`]
    if (entry.sessionNotes) descriptionParts.push(entry.sessionNotes)
    if (entry.attentionRating) descriptionParts.push(`Attention: ${entry.attentionRating}/5`)
    if (entry.stabilityRating) descriptionParts.push(`Stability: ${entry.stabilityRating}/5`)

    lines.push(
      'BEGIN:VEVENT',
      `UID:study-${entry.id ?? entry.createdAt}@study-dashboard`,
      `DTSTAMP:${toIcsUtc(new Date())}`,
      `DTSTART:${toIcsUtc(start)}`,
      `DTEND:${toIcsUtc(end)}`,
      `SUMMARY:${escapeIcsText(summary)}`,
      `DESCRIPTION:${escapeIcsText(descriptionParts.join('\\n'))}`,
      'END:VEVENT',
    )
  }

  lines.push('END:VCALENDAR')
  return lines.join('\r\n')
}

export function downloadIcs(content: string, filenamePrefix = 'study-sessions'): void {
  const blob = new Blob([content], { type: 'text/calendar;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${filenamePrefix}-${new Date().toISOString().slice(0, 10)}.ics`
  a.click()
  URL.revokeObjectURL(url)
}
