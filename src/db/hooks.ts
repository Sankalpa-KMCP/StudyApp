import { useState, useEffect } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from './db'
import type { HistoryEntry, SettingsKey, CategoryItem } from './types'

export function useTasks() {
  const tasks = useLiveQuery(() => db.tasks.orderBy('id').reverse().toArray())

  useEffect(() => {
    if (!tasks) return
    const today = todayDateString()
    const checkAndSurface = async () => {
      const dueTasks = tasks.filter(t => t.completed && t.nextReviewDate && t.nextReviewDate <= today)
      if (dueTasks.length > 0) {
        for (const task of dueTasks) {
          if (task.id !== undefined) {
            await db.tasks.update(task.id, { completed: false })
          }
        }
      }
    }
    checkAndSurface()
  }, [tasks])

  const addTask = async (text: string, categoryId?: number, estimatedCycles: number = 1) => {
    await db.tasks.add({ text, completed: false, createdAt: Date.now(), categoryId, estimatedCycles, actualCycles: 0 } as any)
  }

  const toggleTask = async (id: number) => {
    const task = await db.tasks.get(id)
    if (task) {
      await db.tasks.update(id, { completed: !task.completed })
    }
  }

  const incrementTaskCycle = async (id: number) => {
    const task = await db.tasks.get(id)
    if (task) {
      const currentActual = task.actualCycles ?? (task as any).actualPomodoros ?? 0
      await db.tasks.update(id, { actualCycles: currentActual + 1 })
    }
  }

  const mappedTasks = (tasks ?? []).map(task => ({
    ...task,
    estimatedCycles: task.estimatedCycles ?? (task as any).estimatedPomodoros ?? 1,
    actualCycles: task.actualCycles ?? (task as any).actualPomodoros ?? 0,
  }))

  return {
    tasks: mappedTasks,
    addTask,
    toggleTask,
    incrementTaskCycle,
    isLoading: tasks === undefined,
  }
}


export function useCategories() {
  const categories = useLiveQuery(() => db.categories.toArray())

  const addCategory = async (name: string, color: string) => {
    await db.categories.add({ name, color })
  }

  const deleteCategory = async (id: number) => {
    await db.categories.delete(id)
  }

  const seedDefaults = async () => {
    const count = await db.categories.count()
    if (count === 0) {
      await db.categories.bulkAdd([
        { name: 'General', color: '#64748B' },
        { name: 'Development', color: '#3B82F6' },
        { name: 'Mathematics', color: '#8B5CF6' },
      ])
    }
  }

  useEffect(() => {
    if (categories !== undefined && categories.length === 0) {
      seedDefaults()
    }
  }, [categories])

  return {
    categories: categories ?? [],
    addCategory,
    deleteCategory,
    isLoading: categories === undefined,
  }
}

export function useCategoryBreakdown() {
  const allHistory = useLiveQuery(() => db.history.toArray())
  const categories = useLiveQuery(() => db.categories.toArray())

  if (allHistory === undefined || categories === undefined) {
    return { breakdown: [], totalHours: 0, isLoading: true }
  }

  const catMap = new Map<number, CategoryItem>()
  for (const c of categories) {
    if (c.id !== undefined) catMap.set(c.id, c)
  }

  const grouped = new Map<number | undefined, number>()
  for (const entry of allHistory) {
    if (entry.type !== 'study') continue
    const key = entry.categoryId
    grouped.set(key, (grouped.get(key) ?? 0) + entry.durationMinutes)
  }

  const totalDuration = Array.from(grouped.values()).reduce((s, v) => s + v, 0)

  const breakdown = Array.from(grouped.entries())
    .map(([catId, minutes]) => {
      const cat = catId !== undefined ? catMap.get(catId) : undefined
      return {
        name: cat?.name ?? 'Uncategorized',
        color: cat?.color ?? '#64748B',
        hours: parseFloat((minutes / 60).toFixed(1)),
        percentage: totalDuration > 0 ? Math.round((minutes / totalDuration) * 100) : 0,
      }
    })
    .sort((a, b) => b.hours - a.hours)

  return {
    breakdown,
    totalHours: parseFloat((totalDuration / 60).toFixed(1)),
    isLoading: false,
  }
}

export function useHistory() {
  const history = useLiveQuery(() => db.history.orderBy('id').reverse().toArray())

  const addEntry = async (entry: Omit<HistoryEntry, 'id'>) => {
    await db.history.add(entry)
  }

  const clearHistory = async () => {
    await db.history.clear()
  }

  return {
    history: history ?? [],
    addEntry,
    clearHistory,
    isLoading: history === undefined,
  }
}

export function useSettings() {
  const rows = useLiveQuery(() => db.settings.toArray())

  const dailyGoalMinutes = (rows?.find(r => r.key === 'dailyGoalMinutes')?.value as number) ?? 480
  const soundEnabled = (rows?.find(r => r.key === 'soundEnabled')?.value as boolean) ?? true
  const targetSessionsPerCycle = (rows?.find(r => r.key === 'targetSessionsPerCycle')?.value as number) ?? 4
  const longBreakDurationMinutes = (rows?.find(r => r.key === 'longBreakDurationMinutes')?.value as number) ?? 15
  const ambientTrack = (rows?.find(r => r.key === 'ambientTrack')?.value as string) ?? 'none'
  const ambientVolume = (rows?.find(r => r.key === 'ambientVolume')?.value as number) ?? 0.5

  const ambientVolume_rain = (rows?.find(r => r.key === 'ambientVolume_rain')?.value as number) ?? 0.5
  const ambientVolume_cafe = (rows?.find(r => r.key === 'ambientVolume_cafe')?.value as number) ?? 0.5
  const ambientVolume_whiteNoise = (rows?.find(r => r.key === 'ambientVolume_whiteNoise')?.value as number) ?? 0.5

  const theme = (rows?.find(r => r.key === 'theme')?.value as string) ?? 'midnight-slate'
  const cardOpacity = (rows?.find(r => r.key === 'cardOpacity')?.value as number) ?? 0.70
  const backdropBlur = (rows?.find(r => r.key === 'backdropBlur')?.value as number) ?? 8
  const audio_presets = (rows?.find(r => r.key === 'audio_presets')?.value as any[]) ?? []
  const shortBreakDurationMinutes = (rows?.find(r => r.key === 'shortBreakDurationMinutes')?.value as number) ?? 5
  const ambient_alphaWaves = (rows?.find(r => r.key === 'ambient_alphaWaves')?.value as boolean) ?? false
  const tactile_feedback = (rows?.find(r => r.key === 'tactile_feedback')?.value as boolean) ?? false
  const developer_font = (rows?.find(r => r.key === 'developer_font')?.value as string) ?? 'JetBrains Mono'
  const enforce_lockout = (rows?.find(r => r.key === 'enforce_lockout')?.value as boolean) ?? false

  const updateSetting = async (key: SettingsKey, value: any) => {
    await db.settings.put({ key, value })
  }

  return {
    dailyGoalMinutes,
    soundEnabled,
    targetSessionsPerCycle,
    longBreakDurationMinutes,
    ambientTrack,
    ambientVolume,
    ambientVolume_rain,
    ambientVolume_cafe,
    ambientVolume_whiteNoise,
    theme,
    cardOpacity,
    backdropBlur,
    audio_presets,
    shortBreakDurationMinutes,
    ambient_alphaWaves,
    tactile_feedback,
    developer_font,
    enforce_lockout,
    updateSetting,
    isLoading: rows === undefined,
  }
}

function todayDateString(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export function useTodayLog() {
  const [dateString, setDateString] = useState(todayDateString)

  useEffect(() => {
    const interval = setInterval(() => {
      const current = todayDateString()
      if (current !== dateString) {
        setDateString(current)
      }
    }, 10000) // check date change every 10 seconds
    return () => clearInterval(interval)
  }, [dateString])

  const log = useLiveQuery(() => db.daily_logs.get(dateString).then(r => r ?? null), [dateString])

  const incrementStudy = async () => {
    const current = todayDateString()
    const existing = await db.daily_logs.get(current)
    if (existing) {
      await db.daily_logs.update(current, { studyMinutes: existing.studyMinutes + 1 })
    } else {
      await db.daily_logs.add({ dateString: current, studyMinutes: 1, breakMinutes: 0 })
    }
  }

  const incrementBreak = async () => {
    const current = todayDateString()
    const existing = await db.daily_logs.get(current)
    if (existing) {
      await db.daily_logs.update(current, { breakMinutes: existing.breakMinutes + 1 })
    } else {
      await db.daily_logs.add({ dateString: current, studyMinutes: 0, breakMinutes: 1 })
    }
  }

  return {
    studyMinutes: log?.studyMinutes ?? 0,
    breakMinutes: log?.breakMinutes ?? 0,
    incrementStudy,
    incrementBreak,
    isLoading: log === undefined,
  }
}

function getLocalDateString(date: Date = new Date()): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export async function updateDailyReflection(dateString: string, notes: string, mood: string) {
  const existing = await db.daily_logs.get(dateString)
  if (existing) {
    await db.daily_logs.update(dateString, { notes, mood })
  } else {
    await db.daily_logs.add({ dateString, studyMinutes: 0, breakMinutes: 0, notes, mood })
  }
}

export function useStreak() {
  const allLogs = useLiveQuery(() => db.daily_logs.toArray())

  if (allLogs === undefined) return { currentStreak: 0, isLoading: true }

  const activeDateSet = new Set(
    allLogs.filter(l => l.studyMinutes > 0).map(l => l.dateString),
  )
  if (activeDateSet.size === 0) return { currentStreak: 0, isLoading: false }

  const today = getLocalDateString()
  const yesterday = getLocalDateString(new Date(Date.now() - 86400000))

  let cursorDate: Date
  if (activeDateSet.has(today)) {
    cursorDate = new Date()
  } else if (activeDateSet.has(yesterday)) {
    cursorDate = new Date(Date.now() - 86400000)
  } else {
    return { currentStreak: 0, isLoading: false }
  }

  let streak = 1
  while (true) {
    cursorDate.setDate(cursorDate.getDate() - 1)
    const prev = getLocalDateString(cursorDate)
    if (activeDateSet.has(prev)) {
      streak++
    } else {
      break
    }
  }

  return { currentStreak: streak, isLoading: false }
}

export function useXpLevel() {
  const allLogs = useLiveQuery(() => db.daily_logs.toArray())

  if (allLogs === undefined) {
    return { level: 1, currentLevelXP: 0, xpProgressPercent: 0, lifetimeStudyMinutes: 0, totalXP: 0, isLoading: true }
  }

  const lifetimeStudyMinutes = allLogs.reduce((s, l) => s + l.studyMinutes, 0)
  const totalXP = lifetimeStudyMinutes * 10
  const level = Math.floor(totalXP / 1000) + 1
  const currentLevelXP = totalXP % 1000
  const xpProgressPercent = (currentLevelXP / 1000) * 100

  return { level, currentLevelXP, xpProgressPercent, lifetimeStudyMinutes, totalXP, isLoading: false }
}

export function useProductivityInsights() {
  const allHistory = useLiveQuery(() => db.history.toArray())
  const allTasks = useLiveQuery(() => db.tasks.toArray())
  const allLogs = useLiveQuery(() => db.daily_logs.toArray())
  const categories = useLiveQuery(() => db.categories.toArray())

  if (allHistory === undefined || allTasks === undefined || allLogs === undefined || categories === undefined) {
    return { topSubject: 'None yet', avgMin: 0, completionRate: 0, peakDay: 'No data', isLoading: true }
  }

  const studyEntries = allHistory.filter(e => e.type === 'study')

  const catMap = new Map<number, string>()
  for (const c of categories) {
    if (c.id !== undefined) catMap.set(c.id, c.name)
  }

  const catMinutes = new Map<number | undefined, number>()
  for (const e of studyEntries) {
    const key = e.categoryId
    catMinutes.set(key, (catMinutes.get(key) ?? 0) + e.durationMinutes)
  }

  let topSubject = 'None yet'
  let maxMin = 0
  for (const [catId, minutes] of catMinutes) {
    if (minutes > maxMin) {
      maxMin = minutes
      topSubject = catId !== undefined ? (catMap.get(catId) ?? 'Uncategorized') : 'Uncategorized'
    }
  }

  const avgMin = studyEntries.length > 0
    ? Math.round(studyEntries.reduce((s, e) => s + e.durationMinutes, 0) / studyEntries.length)
    : 0

  const totalTasks = allTasks.length
  const completedTasks = allTasks.filter(t => t.completed).length
  const completionRate = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0

  const dayTotals = [0, 0, 0, 0, 0, 0, 0]
  const dayNamesLocal = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
  for (const log of allLogs) {
    if (log.studyMinutes <= 0) continue
    const [year, month, day] = log.dateString.split('-').map(Number)
    const dayIdx = new Date(year, month - 1, day).getDay()
    dayTotals[dayIdx] += log.studyMinutes
  }

  const maxDayMinutes = Math.max(...dayTotals)
  const peakDayIdx = maxDayMinutes > 0 ? dayTotals.indexOf(maxDayMinutes) : -1
  const peakDay = peakDayIdx >= 0 ? dayNamesLocal[peakDayIdx] : 'No data'

  return { topSubject, avgMin, completionRate, peakDay, isLoading: false }
}

export function useMonthLogs(month: number, year: number) {
  const logs = useLiveQuery(
    () => db.daily_logs
      .where('dateString')
      .between(
        `${year}-${String(month + 1).padStart(2, '0')}-`,
        `${year}-${String(month + 1).padStart(2, '0')}-\uffff`,
      )
      .toArray(),
    [month, year],
  )

  const totalMonthHours = (logs ?? []).reduce((sum, l) => sum + l.studyMinutes / 60, 0)
  const totalMonthSessions = logs?.reduce((sum, l) => sum + Math.floor(l.studyMinutes / 25), 0) ?? 0

  return {
    monthLogs: logs ?? [],
    totalMonthHours,
    totalMonthSessions,
    isLoading: logs === undefined,
  }
}

export function useCalendarHeatmapData(month: number, _year: number, filterCategoryId: number | 'all') {
  const allHistory = useLiveQuery(() => db.history.toArray())
  const monthNamesLocal = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']

  if (allHistory === undefined || filterCategoryId === 'all') {
    return { dayMinutesMap: null as Map<number, number> | null, isLoading: allHistory === undefined }
  }

  const dayMinutes = new Map<number, number>()
  for (const entry of allHistory) {
    if (entry.type !== 'study' || entry.categoryId !== filterCategoryId) continue
    const parts = entry.timestamp.split(' ')
    if (parts.length < 2) continue
    const entryMonth = monthNamesLocal.indexOf(parts[0])
    if (entryMonth !== month) continue
    const dayNum = parseInt(parts[1])
    if (isNaN(dayNum)) continue
    dayMinutes.set(dayNum, (dayMinutes.get(dayNum) ?? 0) + entry.durationMinutes)
  }

  return { dayMinutesMap: dayMinutes, isLoading: false }
}

export function calculateStreak(allLogs: any[]) {
  const activeDateSet = new Set(
    allLogs.filter(l => l.studyMinutes > 0).map(l => l.dateString),
  )
  if (activeDateSet.size === 0) return 0

  const today = getLocalDateString()
  const yesterday = getLocalDateString(new Date(Date.now() - 86400000))

  let cursorDate: Date
  if (activeDateSet.has(today)) {
    cursorDate = new Date()
  } else if (activeDateSet.has(yesterday)) {
    cursorDate = new Date(Date.now() - 86400000)
  } else {
    return 0
  }

  let streak = 1
  let safetyLimit = allLogs.length + 10
  while (safetyLimit-- > 0) {
    cursorDate.setDate(cursorDate.getDate() - 1)
    const prev = getLocalDateString(cursorDate)
    if (activeDateSet.has(prev)) {
      streak++
    } else {
      break
    }
  }

  return streak
}

export function calculateXpLevel(allLogs: any[]) {
  const lifetimeStudyMinutes = allLogs.reduce((s, l) => s + (l.studyMinutes || 0), 0)
  const totalXP = lifetimeStudyMinutes * 10
  const level = Math.floor(totalXP / 1000) + 1
  const currentLevelXP = totalXP % 1000
  const xpProgressPercent = (currentLevelXP / 1000) * 100

  return { level, currentLevelXP, xpProgressPercent, lifetimeStudyMinutes, totalXP }
}

export function calculateProductivityInsights(allHistory: any[], allTasks: any[], allLogs: any[], categories: any[]) {
  const studyEntries = allHistory.filter(e => e.type === 'study')

  const catMap = new Map<number, string>()
  for (const c of categories) {
    if (c.id !== undefined) catMap.set(c.id, c.name)
  }

  const catMinutes = new Map<number | undefined, number>()
  for (const e of studyEntries) {
    const key = e.categoryId
    catMinutes.set(key, (catMinutes.get(key) ?? 0) + e.durationMinutes)
  }

  let topSubject = 'None yet'
  let maxMin = 0
  for (const [catId, minutes] of catMinutes) {
    if (minutes > maxMin) {
      maxMin = minutes
      topSubject = catId !== undefined ? (catMap.get(catId) ?? 'Uncategorized') : 'Uncategorized'
    }
  }

  const avgMin = studyEntries.length > 0
    ? Math.round(studyEntries.reduce((s, e) => s + e.durationMinutes, 0) / studyEntries.length)
    : 0

  const totalTasks = allTasks.length
  const completedTasks = allTasks.filter(t => t.completed).length
  const completionRate = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0

  const dayTotals = [0, 0, 0, 0, 0, 0, 0]
  const dayNamesLocal = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
  for (const log of allLogs) {
    if (log.studyMinutes <= 0) continue
    const [year, month, day] = log.dateString.split('-').map(Number)
    if (!year || !month || !day) continue
    const dayIdx = new Date(year, month - 1, day).getDay()
    if (isNaN(dayIdx)) continue
    dayTotals[dayIdx] += log.studyMinutes
  }

  const maxDayMinutes = Math.max(...dayTotals)
  const peakDayIdx = maxDayMinutes > 0 ? dayTotals.indexOf(maxDayMinutes) : -1
  const peakDay = peakDayIdx >= 0 ? dayNamesLocal[peakDayIdx] : 'No data'

  return { topSubject, avgMin, completionRate, peakDay }
}

export function calculateCategoryBreakdown(allHistory: any[], categories: any[]) {
  const catMap = new Map<number, CategoryItem>()
  for (const c of categories) {
    if (c.id !== undefined) catMap.set(c.id, c)
  }

  const grouped = new Map<number | undefined, number>()
  for (const entry of allHistory) {
    if (entry.type !== 'study') continue
    const key = entry.categoryId
    grouped.set(key, (grouped.get(key) ?? 0) + entry.durationMinutes)
  }

  const totalDuration = Array.from(grouped.values()).reduce((s, v) => s + v, 0)

  const breakdown = Array.from(grouped.entries())
    .map(([catId, minutes]) => {
      const cat = catId !== undefined ? catMap.get(catId) : undefined
      return {
        name: cat?.name ?? 'Uncategorized',
        color: cat?.color ?? '#64748B',
        hours: parseFloat((minutes / 60).toFixed(1)) || 0,
        percentage: totalDuration > 0 ? Math.round((minutes / totalDuration) * 100) : 0,
      }
    })
    .sort((a, b) => b.hours - a.hours)

  return {
    breakdown,
    totalHours: parseFloat((totalDuration / 60).toFixed(1)) || 0,
  }
}

export function calculateMonthLogs(allLogs: any[], month: number, year: number) {
  const prefix = `${year}-${String(month + 1).padStart(2, '0')}-`
  const logs = allLogs.filter(l => l.dateString.startsWith(prefix))

  const totalMonthHours = logs.reduce((sum, l) => sum + (l.studyMinutes || 0) / 60, 0)
  const totalMonthSessions = logs.reduce((sum, l) => sum + Math.floor((l.studyMinutes || 0) / 25), 0)

  return {
    monthLogs: logs,
    totalMonthHours: parseFloat(totalMonthHours.toFixed(1)) || 0,
    totalMonthSessions,
  }
}

export function calculateCalendarHeatmapData(allHistory: any[], month: number, filterCategoryId: number | 'all') {
  if (filterCategoryId === 'all') {
    return null
  }
  const monthNamesLocal = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
  const dayMinutes = new Map<number, number>()
  for (const entry of allHistory) {
    if (entry.type !== 'study' || entry.categoryId !== filterCategoryId) continue
    const parts = entry.timestamp.split(' ')
    if (parts.length < 2) continue
    const entryMonth = monthNamesLocal.indexOf(parts[0])
    if (entryMonth !== month) continue
    const dayNum = parseInt(parts[1])
    if (isNaN(dayNum)) continue
    dayMinutes.set(dayNum, (dayMinutes.get(dayNum) ?? 0) + entry.durationMinutes)
  }

  return dayMinutes
}

export function calculateSM2(q: number, prevRep: number = 0, prevEF: number = 2.5, prevInterval: number = 0) {
  let repetitionCount = prevRep
  let easinessFactor = prevEF
  let intervalDays = prevInterval

  if (q >= 3) {
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

  easinessFactor = prevEF + (0.1 - (5 - q) * (0.08 + (5 - q) * 0.02))
  if (easinessFactor < 1.3) {
    easinessFactor = 1.3
  }

  return {
    repetitionCount,
    easinessFactor,
    intervalDays,
  }
}

