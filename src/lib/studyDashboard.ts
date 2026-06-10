import type { CategoryItem, DailyLog, FlashcardItem, HistoryEntry, QuickNoteItem, SettingsRow, TaskItem } from '../db/types'
import { DAY_NAMES, MONTH_NAMES } from './dateConstants'

export { MONTH_NAMES } from './dateConstants'

export interface StudyBackupPayload {
  version: number
  exportedAt: string
  tasks: TaskItem[]
  history: HistoryEntry[]
  dailyLogs: DailyLog[]
  settings: SettingsRow[]
  categories: CategoryItem[]
  flashcards: FlashcardItem[]
  quickNotes: QuickNoteItem[]
}

export interface StudyLogLike {
  dateString: string
  studyMinutes: number
}

export interface HistoryEntryLike {
  type: 'study' | 'break'
  durationMinutes: number
  categoryId?: number
  timestamp: string
  createdAt?: number
}

export interface TaskCompletionLike {
  completed: boolean
}

interface StudyBackupInput {
  version?: unknown
  exportedAt?: unknown
  tasks?: unknown
  history?: unknown
  dailyLogs?: unknown
  settings?: unknown
  categories?: unknown
  flashcards?: unknown
  quickNotes?: unknown
  quick_notes?: unknown
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function toArray<T>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : []
}

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

export interface DailyFocusStatus {
  percent: number
  goalMet: boolean
  studiedLabel: string
  remainingMinutes: number
  remainingLabel: string
}

export function getDailyFocusStatus(studiedMinutes: number, goalMinutes: number): DailyFocusStatus {
  const studied = Number.isFinite(studiedMinutes) ? Math.max(0, Math.floor(studiedMinutes)) : 0
  const goal = Number.isFinite(goalMinutes) ? Math.max(0, Math.floor(goalMinutes)) : 0
  const goalMet = goal > 0 && studied >= goal
  const percent = goal > 0 ? Math.min(studied / goal, 1) : 0
  const remainingMinutes = goal > 0 ? Math.max(goal - studied, 0) : 0

  return {
    percent,
    goalMet,
    studiedLabel: formatMinutes(studied),
    remainingMinutes,
    remainingLabel: goalMet ? 'Goal met' : goal > 0 ? `${formatMinutes(remainingMinutes)} left today` : 'No goal set',
  }
}

export function getIntensity(minutes: number): 0 | 1 | 2 | 3 {
  if (!Number.isFinite(minutes) || minutes < 60) return 0
  if (minutes < 120) return 1
  if (minutes < 180) return 2
  return 3
}

export function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex.trim())
  return result
    ? {
        r: Number.parseInt(result[1], 16),
        g: Number.parseInt(result[2], 16),
        b: Number.parseInt(result[3], 16),
      }
    : null
}

export function calculateMonthLogs<T extends StudyLogLike>(
  allLogs: T[],
  month: number,
  year: number,
  studyBlockMinutes = 25,
) {
  const prefix = `${year}-${String(month + 1).padStart(2, '0')}-`
  const monthLogs = allLogs.filter(log => log.dateString.startsWith(prefix))
  const totalMonthHours = monthLogs.reduce((sum, log) => sum + (log.studyMinutes || 0) / 60, 0)
  const blockMin = studyBlockMinutes > 0 ? studyBlockMinutes : 25
  const totalMonthSessions = monthLogs.reduce((sum, log) => sum + Math.floor((log.studyMinutes || 0) / blockMin), 0)

  return {
    monthLogs,
    totalMonthHours: Number.parseFloat(totalMonthHours.toFixed(1)) || 0,
    totalMonthSessions,
  }
}

export function calculateCategoryBreakdown(allHistory: HistoryEntryLike[], categories: CategoryItem[]) {
  const categoryMap = new Map<number, CategoryItem>()
  for (const category of categories) {
    if (category.id !== undefined) categoryMap.set(category.id, category)
  }

  const grouped = new Map<number | undefined, number>()
  for (const entry of allHistory) {
    if (entry.type !== 'study') continue
    grouped.set(entry.categoryId, (grouped.get(entry.categoryId) ?? 0) + entry.durationMinutes)
  }

  const totalDuration = Array.from(grouped.values()).reduce((sum, value) => sum + value, 0)
  const breakdown = Array.from(grouped.entries())
    .map(([categoryId, minutes]) => {
      const category = categoryId !== undefined ? categoryMap.get(categoryId) : undefined
      return {
        name: category?.name ?? 'Uncategorized',
        color: category?.color ?? '#64748B',
        hours: Number.parseFloat((minutes / 60).toFixed(1)) || 0,
        percentage: totalDuration > 0 ? Math.round((minutes / totalDuration) * 100) : 0,
      }
    })
    .sort((a, b) => b.hours - a.hours)

  return {
    breakdown,
    totalHours: Number.parseFloat((totalDuration / 60).toFixed(1)) || 0,
  }
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

export function calculateCalendarHeatmapData(allHistory: HistoryEntryLike[], month: number, year: number, filterCategoryId: number | 'all') {
  if (filterCategoryId === 'all') return null

  const dayMinutes = new Map<number, number>()
  for (const entry of allHistory) {
    if (entry.type !== 'study' || entry.categoryId !== filterCategoryId) continue
    const { month: entryMonth, day: dayNumber, year: entryYear } = getHistoryDayKey(entry)
    if (entryMonth !== month || entryYear !== year) continue
    dayMinutes.set(dayNumber, (dayMinutes.get(dayNumber) ?? 0) + entry.durationMinutes)
  }

  return dayMinutes
}

export function calculateStreak(allLogs: StudyLogLike[], now: Date = new Date()) {
  const activeDateSet = new Set(allLogs.filter(log => log.studyMinutes > 0).map(log => log.dateString))
  if (activeDateSet.size === 0) return 0

  const today = buildDateString(now)
  const yesterday = buildDateString(new Date(now.getTime() - 86400000))

  let cursorDate: Date
  if (activeDateSet.has(today)) {
    cursorDate = new Date(now)
  } else if (activeDateSet.has(yesterday)) {
    cursorDate = new Date(now.getTime() - 86400000)
  } else {
    return 0
  }

  let streak = 1
  const safetyLimit = allLogs.length + 10
  let remainingChecks = safetyLimit
  while (remainingChecks-- > 0) {
    cursorDate.setDate(cursorDate.getDate() - 1)
    if (activeDateSet.has(buildDateString(cursorDate))) {
      streak++
    } else {
      break
    }
  }

  return streak
}

export function calculateXpLevel(allLogs: StudyLogLike[]) {
  const lifetimeStudyMinutes = allLogs.reduce((sum, log) => sum + (log.studyMinutes || 0), 0)
  const totalXP = lifetimeStudyMinutes * 10
  const level = Math.floor(totalXP / 1000) + 1
  const currentLevelXP = totalXP % 1000
  const xpProgressPercent = (currentLevelXP / 1000) * 100

  return { level, currentLevelXP, xpProgressPercent, lifetimeStudyMinutes, totalXP }
}

export function calculateProductivityInsights(
  allHistory: HistoryEntry[],
  allTasks: TaskCompletionLike[],
  allLogs: StudyLogLike[],
  categories: CategoryItem[],
) {
  const studyEntries = allHistory.filter(entry => entry.type === 'study')

  const categoryMap = new Map<number, string>()
  for (const category of categories) {
    if (category.id !== undefined) categoryMap.set(category.id, category.name)
  }

  const categoryMinutes = new Map<number | undefined, number>()
  for (const entry of studyEntries) {
    categoryMinutes.set(entry.categoryId, (categoryMinutes.get(entry.categoryId) ?? 0) + entry.durationMinutes)
  }

  let topSubject = 'None yet'
  let maxMinutes = 0
  for (const [categoryId, minutes] of categoryMinutes) {
    if (minutes > maxMinutes) {
      maxMinutes = minutes
      topSubject = categoryId !== undefined ? (categoryMap.get(categoryId) ?? 'Uncategorized') : 'Uncategorized'
    }
  }

  const avgMin = studyEntries.length > 0
    ? Math.round(studyEntries.reduce((sum, entry) => sum + entry.durationMinutes, 0) / studyEntries.length)
    : 0

  const totalTasks = allTasks.length
  const completedTasks = allTasks.filter(task => task.completed).length
  const completionRate = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0

  const dayTotals = [0, 0, 0, 0, 0, 0, 0]
  for (const log of allLogs) {
    if (log.studyMinutes <= 0) continue
    const [year, month, day] = log.dateString.split('-').map(Number)
    if (!year || !month || !day) continue
    const dayIndex = new Date(year, month - 1, day).getDay()
    if (Number.isNaN(dayIndex)) continue
    dayTotals[dayIndex] += log.studyMinutes
  }

  const maxDayMinutes = Math.max(...dayTotals)
  const peakDayIndex = maxDayMinutes > 0 ? dayTotals.indexOf(maxDayMinutes) : -1
  const peakDay = peakDayIndex >= 0 ? DAY_NAMES[peakDayIndex] : 'No data'

  return { topSubject, avgMin, completionRate, peakDay }
}

export function calculateSM2(q: number, prevRep = 0, prevEF = 2.5, prevInterval = 0) {
  const quality = Number.isFinite(q) ? Math.max(0, Math.min(5, q)) : 0
  let repetitionCount = prevRep
  let intervalDays: number

  if (quality >= 3) {
    if (repetitionCount === 0) {
      intervalDays = 1
    } else if (repetitionCount === 1) {
      intervalDays = 6
    } else {
      intervalDays = Math.round(prevInterval * prevEF)
    }
    repetitionCount++
  } else {
    repetitionCount = 0
    intervalDays = 1
  }

  let easinessFactor = prevEF + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02))
  if (easinessFactor < 1.3) easinessFactor = 1.3

  return { repetitionCount, easinessFactor, intervalDays }
}

export interface ParsedStudyBackupPayload extends StudyBackupPayload {
  rawVersion: unknown
}

export function parseStudyBackupPayload(raw: string): ParsedStudyBackupPayload | null {
  try {
    const parsed: unknown = JSON.parse(raw)
    if (!isRecord(parsed)) return null

    const payload = parsed as StudyBackupInput
    const quickNotes = toArray<QuickNoteItem>(payload.quickNotes ?? payload.quick_notes)

    return {
      rawVersion: payload.version,
      version: Number.isFinite(Number(payload.version)) ? Number(payload.version) : 1,
      exportedAt: typeof payload.exportedAt === 'string' ? payload.exportedAt : new Date().toISOString(),
      tasks: toArray<TaskItem>(payload.tasks),
      history: toArray<HistoryEntry>(payload.history).map(h => ({
        ...h,
        createdAt: h.createdAt ?? parseLegacyHistoryTimestamp(h.timestamp),
      })),
      dailyLogs: toArray<DailyLog>(payload.dailyLogs),
      settings: toArray<SettingsRow>(payload.settings),
      categories: toArray<CategoryItem>(payload.categories),
      flashcards: toArray<FlashcardItem>(payload.flashcards),
      quickNotes,
    }
  } catch {
    return null
  }
}

export function validateBackupPayload(parsed: unknown): boolean {
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    return false
  }

  const p = parsed as Record<string, unknown>

  // Validate version
  if ('version' in p && typeof p.version !== 'number') {
    return false
  }

  // Validate tasks array
  if ('tasks' in p) {
    if (!Array.isArray(p.tasks)) return false
    for (const t of p.tasks) {
      if (typeof t !== 'object' || t === null) return false
      if (typeof t.text !== 'string' || typeof t.completed !== 'boolean') return false
    }
  }

  // Validate history array
  if ('history' in p) {
    if (!Array.isArray(p.history)) return false
    for (const h of p.history) {
      if (typeof h !== 'object' || h === null) return false
      if (typeof h.timestamp !== 'string' || !['study', 'break'].includes(h.type) || typeof h.durationMinutes !== 'number') return false
      if ('createdAt' in h && h.createdAt !== undefined && typeof h.createdAt !== 'number') return false
    }
  }

  // Validate dailyLogs array
  if ('dailyLogs' in p) {
    if (!Array.isArray(p.dailyLogs)) return false
    for (const l of p.dailyLogs) {
      if (typeof l !== 'object' || l === null) return false
      if (typeof l.dateString !== 'string' || typeof l.studyMinutes !== 'number' || typeof l.breakMinutes !== 'number') return false
    }
  }

  // Validate settings array
  if ('settings' in p) {
    if (!Array.isArray(p.settings)) return false
    for (const s of p.settings) {
      if (typeof s !== 'object' || s === null) return false
      if (typeof s.key !== 'string' || !('value' in s)) return false
    }
  }

  // Validate categories array
  if ('categories' in p) {
    if (!Array.isArray(p.categories)) return false
    for (const c of p.categories) {
      if (typeof c !== 'object' || c === null) return false
      if (typeof c.name !== 'string' || typeof c.color !== 'string') return false
    }
  }

  // Validate flashcards array
  if ('flashcards' in p) {
    if (!Array.isArray(p.flashcards)) return false
    for (const f of p.flashcards) {
      if (typeof f !== 'object' || f === null) return false
      if (typeof f.question !== 'string' || typeof f.answer !== 'string') return false
    }
  }

  // Validate quickNotes array
  if ('quickNotes' in p || 'quick_notes' in p) {
    const notes = p.quickNotes ?? p.quick_notes
    if (!Array.isArray(notes)) return false
    for (const n of notes) {
      if (typeof n !== 'object' || n === null) return false
      if (typeof n.title !== 'string' || typeof n.content !== 'string') return false
    }
  }

  return true
}


