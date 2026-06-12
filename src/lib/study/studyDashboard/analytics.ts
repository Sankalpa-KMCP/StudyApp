import type { CategoryItem, HistoryEntry } from '../../../db/types'
import { DAY_NAMES } from '../../shared/dateConstants'
import { buildDateString, getHistoryDayKey } from './dateTime'
import type { HistoryEntryLike, StudyLogLike, TaskCompletionLike } from './types'

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

export function calculateTaskStudyMinutes(
  allHistory: HistoryEntry[],
  tasks: { id?: number; text: string }[],
) {
  const taskMap = new Map(tasks.filter(t => t.id !== undefined).map(t => [t.id!, t.text]))
  const grouped = new Map<number, number>()
  for (const entry of allHistory) {
    if (entry.type !== 'study' || entry.taskId === undefined) continue
    grouped.set(entry.taskId, (grouped.get(entry.taskId) ?? 0) + entry.durationMinutes)
  }
  return Array.from(grouped.entries())
    .map(([taskId, minutes]) => ({
      taskId,
      name: taskMap.get(taskId) ?? `Task #${taskId}`,
      hours: Number.parseFloat((minutes / 60).toFixed(1)) || 0,
      minutes,
    }))
    .sort((a, b) => b.minutes - a.minutes)
}

export function calculateCategoryGoalTrend(
  allLogs: StudyLogLike[],
  categories: CategoryItem[],
  days = 7,
  now = new Date(),
) {
  const start = now.getTime() - days * 86400000
  return categories
    .filter(c => c.id !== undefined && (c.dailyGoalMinutes ?? 0) > 0)
    .map(category => {
      const goal = category.dailyGoalMinutes ?? 0
      const relevant = allLogs.filter(l => {
        const t = new Date(l.dateString).getTime()
        return t >= start && l.studyMinutes > 0
      })
      const hitDays = relevant.filter(l => l.studyMinutes >= goal).length
      return {
        name: category.name,
        color: category.color,
        goalMinutes: goal,
        hitDays,
        totalDays: days,
        hitRate: Math.round((hitDays / days) * 100),
      }
    })
    .sort((a, b) => b.hitRate - a.hitRate)
}
