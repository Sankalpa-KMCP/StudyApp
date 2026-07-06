import { db } from '../db'
import type {
  CategoryItem,
  DailyLog,
  HistoryEntry,
  QuickNoteItem,
  SettingsRow,
  TaskItem,
} from '../types'

export interface ExportedTables {
  tasks: TaskItem[]
  history: HistoryEntry[]
  dailyLogs: DailyLog[]
  settings: SettingsRow[]
  categories: CategoryItem[]
  quickNotes: QuickNoteItem[]
}

export async function exportAllTables(): Promise<ExportedTables> {
  const [tasks, history, dailyLogs, settings, categories, quickNotes] = await Promise.all([
    db.tasks.toArray(),
    db.history.toArray(),
    db.daily_logs.toArray(),
    db.settings.toArray(),
    db.categories.toArray(),
    db.quick_notes.toArray(),
  ])
  return { tasks, history, dailyLogs, settings, categories, quickNotes }
}

export async function replaceAllTables(data: ExportedTables): Promise<void> {
  await db.transaction('rw', [db.tasks, db.history, db.daily_logs, db.settings, db.categories, db.quick_notes, db.snapshots], async () => {
    await Promise.all([
      db.tasks.clear(),
      db.history.clear(),
      db.daily_logs.clear(),
      db.settings.clear(),
      db.categories.clear(),
      db.quick_notes.clear(),
      db.snapshots.clear(),
    ])

    if (data.tasks.length > 0) await db.tasks.bulkAdd(data.tasks)
    if (data.history.length > 0) await db.history.bulkAdd(data.history)
    if (data.dailyLogs.length > 0) await db.daily_logs.bulkAdd(data.dailyLogs)
    if (data.settings.length > 0) await db.settings.bulkAdd(data.settings)
    if (data.categories.length > 0) await db.categories.bulkAdd(data.categories)
    if (data.quickNotes.length > 0) await db.quick_notes.bulkAdd(data.quickNotes)
  })
}

const DEFAULT_SETTINGS: SettingsRow[] = [
  { key: 'dailyGoalMinutes', value: 120 },
  { key: 'soundEnabled', value: true },
  { key: 'targetSessionsPerCycle', value: 4 },
  { key: 'longBreakDurationMinutes', value: 15 },
  { key: 'shortBreakDurationMinutes', value: 5 },
  { key: 'studyBlockDurationMinutes', value: 25 },
  { key: 'theme', value: 'midnight-slate' },
  { key: 'cardOpacity', value: 0.70 },
  { key: 'backdropBlur', value: 8 },
  { key: 'initialEasinessFactor', value: 2.5 },
  { key: 'autoArchiveAncientTasks', value: false },
  { key: 'tactile_feedback', value: false },
  { key: 'developer_font', value: 'JetBrains Mono' },
  { key: 'enforce_lockout', value: false },
]

const DEFAULT_CATEGORIES: Omit<CategoryItem, 'id'>[] = [
  { name: 'General', color: '#64748B' },
  { name: 'Development', color: '#3B82F6' },
  { name: 'Mathematics', color: '#8B5CF6' },
]

export async function clearAllTables(): Promise<void> {
  await Promise.all([
    db.tasks.clear(),
    db.history.clear(),
    db.daily_logs.clear(),
    db.settings.clear(),
    db.categories.clear(),
    db.quick_notes.clear(),
    db.snapshots.clear(),
  ])
}

export async function resetDatabase(): Promise<void> {
  await clearAllTables()
  await db.settings.bulkAdd(DEFAULT_SETTINGS)
  await db.categories.bulkAdd(DEFAULT_CATEGORIES)
}

export interface SelectiveResetOptions {
  tasks: boolean
  history: boolean
  categories: boolean
  notes: boolean
}

export async function resetSelective(options: SelectiveResetOptions): Promise<void> {
  await db.transaction('rw', [db.tasks, db.history, db.daily_logs, db.categories, db.quick_notes], async () => {
    if (options.tasks) await db.tasks.clear()
    if (options.history) {
      await db.history.clear()
      await db.daily_logs.clear()
    }
    if (options.categories) await db.categories.clear()
    if (options.notes) await db.quick_notes.clear()
  })
}

export function getSchemaVersion(): number {
  return db.verno
}

export async function deleteAndReopen(): Promise<void> {
  await db.delete()
  await db.open()
}

function historyKey(h: HistoryEntry): string {
  return `${h.createdAt}-${h.type}-${h.durationMinutes}`
}

export async function mergeBackupData(data: ExportedTables): Promise<void> {
  await db.transaction('rw', [db.tasks, db.history, db.daily_logs, db.settings, db.categories, db.quick_notes], async () => {
    const existingCategories = await db.categories.toArray()
    const categoryIdMap = new Map<number, number>()

    for (const cat of data.categories) {
      const match = existingCategories.find(c => c.name === cat.name && c.color === cat.color)
      if (match?.id !== undefined && cat.id !== undefined) {
        categoryIdMap.set(cat.id, match.id)
        await db.categories.update(match.id, { ...match, ...cat, id: match.id })
      } else if (cat.id !== undefined) {
        const newId = await db.categories.put({ ...cat })
        categoryIdMap.set(cat.id, newId as number)
      } else {
        await db.categories.add(cat)
      }
    }

    const remapCategory = (id?: number) => (id !== undefined ? categoryIdMap.get(id) ?? id : undefined)

    if (data.tasks.length > 0) {
      await db.tasks.bulkPut(
        data.tasks.map(t => ({
          ...t,
          categoryId: remapCategory(t.categoryId),
        })),
      )
    }

    if (data.quickNotes.length > 0) {
      await db.quick_notes.bulkPut(
        data.quickNotes.map(n => ({
          ...n,
          categoryId: remapCategory(n.categoryId),
        })),
      )
    }

    const existingHistory = await db.history.toArray()
    const existingKeys = new Set(existingHistory.map(historyKey))
    const newHistory = data.history
      .map(h => ({ ...h, categoryId: remapCategory(h.categoryId) }))
      .filter(h => !existingKeys.has(historyKey(h)))
    if (newHistory.length > 0) await db.history.bulkAdd(newHistory)

    for (const log of data.dailyLogs) {
      const existing = await db.daily_logs.get(log.dateString)
      if (existing) {
        await db.daily_logs.put({
          ...existing,
          studyMinutes: existing.studyMinutes + log.studyMinutes,
          breakMinutes: existing.breakMinutes + log.breakMinutes,
          notes: log.notes || existing.notes,
          mood: log.mood || existing.mood,
        })
      } else {
        await db.daily_logs.put(log)
      }
    }

    const localSettings = await db.settings.toArray()
    const localByKey = new Map(localSettings.map(s => [s.key, s]))
    for (const row of data.settings) {
      if ((row.key as string) === 'flashcardsEnabled') continue
      if (!localByKey.has(row.key)) {
        await db.settings.put(row)
      }
    }
  })
}
