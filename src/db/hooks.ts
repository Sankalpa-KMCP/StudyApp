import { useState, useEffect } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from './db'
import type { AudioPreset, HistoryEntry, SettingsKey, CategoryItem, FlashcardItem, QuickNoteItem, SettingsValue, TaskItem } from './types'
import {
  calculateCalendarHeatmapData as calculateCalendarHeatmapDataPure,
  calculateCategoryBreakdown as calculateCategoryBreakdownPure,
  calculateMonthLogs as calculateMonthLogsPure,
  calculateProductivityInsights as calculateProductivityInsightsPure,
  calculateSM2 as calculateSM2Pure,
  calculateStreak as calculateStreakPure,
  calculateXpLevel as calculateXpLevelPure,
} from '../lib/studyDashboard'

export function useTasks() {
  const tasks = useLiveQuery<TaskItem[]>(() => db.tasks.orderBy('id').reverse().toArray())

  const addTask = async (text: string, categoryId?: number, estimatedCycles: number = 1, priority?: 'low' | 'medium' | 'high', isStudySubject?: boolean) => {
    await db.tasks.add({ text, completed: false, createdAt: Date.now(), categoryId, estimatedCycles, actualCycles: 0, priority, isStudySubject })
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
      const legacyTask = task as TaskItem & { actualPomodoros?: number }
      const currentActual = task.actualCycles ?? legacyTask.actualPomodoros ?? 0
      await db.tasks.update(id, { actualCycles: currentActual + 1 })
    }
  }

  const mappedTasks = (tasks ?? [])
    .filter(task => !task.archived)
    .map(task => ({
      ...task,
      estimatedCycles: task.estimatedCycles ?? (task as TaskItem & { estimatedPomodoros?: number }).estimatedPomodoros ?? 1,
      actualCycles: task.actualCycles ?? (task as TaskItem & { actualPomodoros?: number }).actualPomodoros ?? 0,
    }))

  const sortedTasks = [...mappedTasks].sort((a, b) => {
    // 1. Uncompleted tasks first
    if (a.completed !== b.completed) {
      return a.completed ? 1 : -1
    }
    // 2. Priority weight (high -> medium -> low)
    const getPriorityWeight = (priority?: 'low' | 'medium' | 'high') => {
      if (priority === 'high') return 0
      if (priority === 'low') return 2
      return 1 // 'medium' or default
    }
    const weightA = getPriorityWeight(a.priority)
    const weightB = getPriorityWeight(b.priority)
    if (weightA !== weightB) {
      return weightA - weightB
    }
    // 3. Creation date descending (newest first)
    return (b.createdAt || 0) - (a.createdAt || 0)
  })

  return {
    tasks: sortedTasks,
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

  const breakdownData = calculateCategoryBreakdownPure(allHistory, categories)

  return {
    breakdown: breakdownData.breakdown,
    totalHours: breakdownData.totalHours,
    isLoading: false,
  }
}

export function useHistory() {
  const history = useLiveQuery(() => db.history.orderBy('id').reverse().toArray())

  /**
   * Writes a finished focus cycle or break session entry to local IndexedDB.
   * Supports custom telemetry ratings and optional sessionNotes string.
   */
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
  const audio_presets = (rows?.find(r => r.key === 'audio_presets')?.value as AudioPreset[]) ?? []
  const shortBreakDurationMinutes = (rows?.find(r => r.key === 'shortBreakDurationMinutes')?.value as number) ?? 5
  const rawAlpha = rows?.find(r => r.key === 'ambient_alphaWaves')?.value
  const ambient_alphaWaves = typeof rawAlpha === 'boolean' ? (rawAlpha ? 0.35 : 0) : ((rawAlpha as number) ?? 0)
  const noiseType = (rows?.find(r => r.key === 'noiseType')?.value as 'white' | 'pink' | 'brown') ?? 'white'
  const binauralTarget = (rows?.find(r => r.key === 'binauralTarget')?.value as 'alpha' | 'theta' | 'beta') ?? 'alpha'
  const tactile_feedback = (rows?.find(r => r.key === 'tactile_feedback')?.value as boolean) ?? false
  const developer_font = (rows?.find(r => r.key === 'developer_font')?.value as string) ?? 'JetBrains Mono'
  const enforce_lockout = (rows?.find(r => r.key === 'enforce_lockout')?.value as boolean) ?? false
  const initialEasinessFactor = (rows?.find(r => r.key === 'initialEasinessFactor')?.value as number) ?? 2.5
  const autoArchiveAncientTasks = (rows?.find(r => r.key === 'autoArchiveAncientTasks')?.value as boolean) ?? false

  const updateSetting = async (key: SettingsKey, value: SettingsValue) => {
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
    noiseType,
    binauralTarget,
    initialEasinessFactor,
    autoArchiveAncientTasks,
    updateSetting,
    isLoading: rows === undefined,
  }
}

function todayDateString(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function yesterdayDateString(): string {
  const d = new Date()
  d.setDate(d.getDate() - 1)
  return todayDateString()
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

  const today = todayDateString()
  const yesterday = yesterdayDateString()

  let cursorDate: Date
  if (activeDateSet.has(today)) {
    cursorDate = new Date()
  } else if (activeDateSet.has(yesterday)) {
    cursorDate = new Date()
    cursorDate.setDate(cursorDate.getDate() - 1)
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
  const insights = calculateProductivityInsightsPure(allHistory, allTasks, allLogs, categories)
  return { ...insights, isLoading: false }
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
  if (allHistory === undefined || filterCategoryId === 'all') {
    return { dayMinutesMap: null as Map<number, number> | null, isLoading: allHistory === undefined }
  }

  return { dayMinutesMap: calculateCalendarHeatmapDataPure(allHistory, month, filterCategoryId), isLoading: false }
}

export function calculateStreak(allLogs: { dateString: string; studyMinutes: number }[]) {
  return calculateStreakPure(allLogs)
}

export function calculateXpLevel(allLogs: { dateString: string; studyMinutes: number }[]) {
  return calculateXpLevelPure(allLogs)
}

export function calculateProductivityInsights(allHistory: HistoryEntry[], allTasks: { completed: boolean }[], allLogs: { dateString: string; studyMinutes: number }[], categories: CategoryItem[]) {
  return calculateProductivityInsightsPure(allHistory, allTasks, allLogs, categories)
}

export function calculateCategoryBreakdown(allHistory: HistoryEntry[], categories: CategoryItem[]) {
  return calculateCategoryBreakdownPure(allHistory, categories)
}

export function calculateMonthLogs<T extends { dateString: string; studyMinutes: number }>(allLogs: T[], month: number, year: number) {
  return calculateMonthLogsPure(allLogs, month, year)
}

export function calculateCalendarHeatmapData(allHistory: HistoryEntry[], month: number, filterCategoryId: number | 'all') {
  return calculateCalendarHeatmapDataPure(allHistory, month, filterCategoryId)
}

export function calculateSM2(q: number, prevRep: number = 0, prevEF: number = 2.5, prevInterval: number = 0) {
  return calculateSM2Pure(q, prevRep, prevEF, prevInterval)
}

export function useFlashcards() {
  const flashcards = useLiveQuery<FlashcardItem[]>(() => db.flashcards.toArray())

  const addFlashcard = async (question: string, answer: string, categoryId?: number) => {
    const settings = await db.settings.toArray()
    const initialEF = (settings.find(r => r.key === 'initialEasinessFactor')?.value as number) ?? 2.5
    await db.flashcards.add({
      question,
      answer,
      categoryId,
      createdAt: Date.now(),
      repetitionCount: 0,
      easinessFactor: initialEF,
      intervalDays: 0,
    })
  }

  const deleteFlashcard = async (id: number) => {
    await db.flashcards.delete(id)
  }

  const submitFlashcardGrade = async (id: number, q: number) => {
    const card: FlashcardItem | undefined = await db.flashcards.get(id)
    if (!card) return
    const settings = await db.settings.toArray()
    const initialEF = (settings.find(r => r.key === 'initialEasinessFactor')?.value as number) ?? 2.5
    const { repetitionCount, easinessFactor, intervalDays } = calculateSM2(
      q,
      card.repetitionCount ?? 0,
      card.easinessFactor ?? initialEF,
      card.intervalDays ?? 0
    )

    const nextDate = new Date()
    nextDate.setDate(nextDate.getDate() + intervalDays)
    const nextReviewDate = `${nextDate.getFullYear()}-${String(nextDate.getMonth() + 1).padStart(2, '0')}-${String(nextDate.getDate()).padStart(2, '0')}`

    await db.flashcards.update(id, {
      repetitionCount,
      easinessFactor,
      intervalDays,
      nextReviewDate,
      latestGrade: q
    })
  }

  return {
    flashcards: flashcards ?? [],
    addFlashcard,
    deleteFlashcard,
    submitFlashcardGrade,
    isLoading: flashcards === undefined
  }
}

export function useQuickNotes() {
  const notes = useLiveQuery<QuickNoteItem[]>(() => db.quick_notes.orderBy('updatedAt').reverse().toArray())

  const addNote = async (title: string, content: string, categoryId?: number) => {
    await db.quick_notes.add({
      title,
      content,
      categoryId,
      color: '#06b6d4',
      updatedAt: Date.now()
    })
  }

  const updateNote = async (id: number, title: string, content: string, categoryId?: number, color?: string) => {
    await db.quick_notes.update(id, {
      title,
      content,
      categoryId,
      color,
      updatedAt: Date.now()
    })
  }

  const deleteNote = async (id: number) => {
    await db.quick_notes.delete(id)
  }

  return {
    notes: notes ?? [],
    addNote,
    updateNote,
    deleteNote,
    isLoading: notes === undefined
  }
}



