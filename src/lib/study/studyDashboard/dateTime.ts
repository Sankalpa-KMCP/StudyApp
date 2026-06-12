import { MONTH_NAMES } from '../../shared/dateConstants'
import type { HistoryEntryLike } from './types'

export function buildDateString(date: Date = new Date()): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export function formatMinutes(minutes: number): string {
  const safeMinutes = Number.isFinite(minutes) ? Math.max(0, Math.floor(minutes)) : 0
  const hours = Math.floor(safeMinutes / 60)
  const mins = safeMinutes % 60
  return `${hours}h ${mins}m`
}

export function formatHistoryTimestamp(date: Date = new Date()): string {
  return `${MONTH_NAMES[date.getMonth()]} ${date.getDate()}, ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`
}

export function parseLegacyHistoryTimestamp(timestamp: string): number {
  const parts = timestamp.split(' ')
  if (parts.length < 2) return Date.now()
  const monthIndex = (MONTH_NAMES as readonly string[]).indexOf(parts[0])
  if (monthIndex < 0) return Date.now()
  const dayPart = parts[1].replace(',', '')
  const day = Number.parseInt(dayPart, 10)
  if (!Number.isFinite(day)) return Date.now()
  let hours = 12
  let minutes = 0
  if (parts.length >= 3) {
    const timeParts = parts[2].split(':')
    hours = Number.parseInt(timeParts[0], 10) || 0
    minutes = Number.parseInt(timeParts[1], 10) || 0
  }
  const now = new Date()
  const year = now.getFullYear()
  const parsed = new Date(year, monthIndex, day, hours, minutes)
  if (parsed.getTime() > now.getTime() + 86400000) {
    parsed.setFullYear(year - 1)
  }
  return parsed.getTime()
}

export function parseHistoryCreatedAt(entry: HistoryEntryLike): number {
  if (entry.createdAt !== undefined && Number.isFinite(entry.createdAt)) {
    return entry.createdAt
  }
  return parseLegacyHistoryTimestamp(entry.timestamp)
}

export function getHistoryDate(entry: HistoryEntryLike): Date {
  return new Date(parseHistoryCreatedAt(entry))
}

export function getHistoryDayKey(entry: HistoryEntryLike): { month: number; day: number; year: number } {
  const d = getHistoryDate(entry)
  return { month: d.getMonth(), day: d.getDate(), year: d.getFullYear() }
}
