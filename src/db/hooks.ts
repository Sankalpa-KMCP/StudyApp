import { useState, useEffect } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from './db'
import type { HistoryEntry, SettingsKey, CategoryItem, FlashcardItem, QuickNoteItem, SettingsValue, TaskItem } from './types'
import { formatHistoryTimestamp } from '../lib/studyDashboard'
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
    if (a.completed !== b.completed) {
      return a.completed ? 1 : -1
    }
    const getPriorityWeight = (priority?: 'low' | 'medium' | 'high') => {
      if (priority === 'high') return 0
      if (priority === 'low') return 2
      return 1
    }
    const weightA = getPriorityWeight(a.priority)
    const weightB = getPriorityWeight(b.priority)
    if (weightA !== weightB) {
      return weightA - weightB
    }
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
    const allCategories = await db.categories.toArray()
    if (allCategories.length <= 1) {
      throw new Error('Cannot delete the last category')
    }
    const general = allCategories.find(c => c.name === 'General' && c.id !== id)
    const fallbackId = general?.id ?? allCategories.find(c => c.id !== id)?.id

    await db.transaction('rw', [db.tasks, db.history, db.flashcards, db.quick_notes, db.categories], async () => {
      if (fallbackId !== undefined) {
        await db.tasks.where('categoryId').equals(id).modify({ categoryId: fallbackId })
        await db.history.where('categoryId').equals(id).modify({ categoryId: fallbackId })
        await db.flashcards.where('categoryId').equals(id).modify({ categoryId: fallbackId })
        await db.quick_notes.where('categoryId').equals(id).modify({ categoryId: fallbackId })
      } else {
        await db.tasks.where('categoryId').equals(id).modify({ categoryId: undefined })
        await db.history.where('categoryId').equals(id).modify({ categoryId: undefined })
        await db.flashcards.where('categoryId').equals(id).modify({ categoryId: undefined })
        await db.quick_notes.where('categoryId').equals(id).modify({ categoryId: undefined })
      }
      await db.categories.delete(id)
    })
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

export function useHistory() {
  const history = useLiveQuery(() => db.history.orderBy('id').reverse().toArray())

  const addEntry = async (entry: Omit<HistoryEntry, 'id' | 'createdAt'> & { createdAt?: number }) => {
    const now = Date.now()
    await db.history.add({
      ...entry,
      createdAt: entry.createdAt ?? now,
      timestamp: entry.timestamp || formatHistoryTimestamp(new Date(entry.createdAt ?? now)),
    })
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
  const shortBreakDurationMinutes = (rows?.find(r => r.key === 'shortBreakDurationMinutes')?.value as number) ?? 5
  const studyBlockDurationMinutes = (rows?.find(r => r.key === 'studyBlockDurationMinutes')?.value as number) ?? 25
  const theme = (rows?.find(r => r.key === 'theme')?.value as string) ?? 'midnight-slate'
  const cardOpacity = (rows?.find(r => r.key === 'cardOpacity')?.value as number) ?? 0.70
  const backdropBlur = (rows?.find(r => r.key === 'backdropBlur')?.value as number) ?? 8
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
    shortBreakDurationMinutes,
    studyBlockDurationMinutes,
    theme,
    cardOpacity,
    backdropBlur,
    tactile_feedback,
    developer_font,
    enforce_lockout,
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

export function useTodayLog() {
  const [dateString, setDateString] = useState(todayDateString)

  useEffect(() => {
    const interval = setInterval(() => {
      const current = todayDateString()
      if (current !== dateString) {
        setDateString(current)
      }
    }, 10000)
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

export async function updateDailyReflection(dateString: string, notes: string, mood: string) {
  const existing = await db.daily_logs.get(dateString)
  if (existing) {
    await db.daily_logs.update(dateString, { notes, mood })
  } else {
    await db.daily_logs.add({ dateString, studyMinutes: 0, breakMinutes: 0, notes, mood })
  }
}

export function useAllDailyLogs() {
  const allLogs = useLiveQuery(() => db.daily_logs.toArray())
  return { allLogs: allLogs ?? [], isLoading: allLogs === undefined }
}

export function useMonthLogsQuery(month: number, year: number, studyBlockMinutes = 25) {
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

  const data = logs
    ? calculateMonthLogsPure(logs, month, year, studyBlockMinutes)
    : { monthLogs: [], totalMonthHours: 0, totalMonthSessions: 0 }

  return {
    monthLogs: data.monthLogs,
    totalMonthHours: data.totalMonthHours,
    totalMonthSessions: data.totalMonthSessions,
    isLoading: logs === undefined,
  }
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

export function calculateMonthLogs<T extends { dateString: string; studyMinutes: number }>(allLogs: T[], month: number, year: number, studyBlockMinutes = 25) {
  return calculateMonthLogsPure(allLogs, month, year, studyBlockMinutes)
}

export function calculateCalendarHeatmapData(allHistory: HistoryEntry[], month: number, year: number, filterCategoryId: number | 'all') {
  return calculateCalendarHeatmapDataPure(allHistory, month, year, filterCategoryId)
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
