import type { ExportedTables } from '../../db/repositories/database'
import type { HistoryEntry } from '../../db/types'
import type { ParsedStudyBackupPayload, StudyBackupPayload } from '../study/studyDashboard'

export interface MergePreviewSummary {
  tasksAdded: number
  tasksUpdated: number
  historyToAppend: number
  settingsFromRemote: number
  dailyLogDeltas: number
  categoriesRemapped: number
}

function historyKey(h: HistoryEntry): string {
  return `${h.createdAt}-${h.type}-${h.durationMinutes}`
}

export function computeMergePreview(
  localTables: ExportedTables,
  remotePayload: ParsedStudyBackupPayload | StudyBackupPayload,
): MergePreviewSummary {
  const localTaskIds = new Set(
    localTables.tasks
      .map(t => t.id)
      .filter((id): id is number => id !== undefined),
  )

  let tasksAdded = 0
  let tasksUpdated = 0
  for (const task of remotePayload.tasks) {
    if (task.id === undefined || !localTaskIds.has(task.id)) {
      tasksAdded += 1
    } else {
      tasksUpdated += 1
    }
  }

  let categoriesRemapped = 0
  for (const cat of remotePayload.categories) {
    const match = localTables.categories.find(c => c.name === cat.name && c.color === cat.color)
    if (match?.id !== undefined && cat.id !== undefined) {
      categoriesRemapped += 1
    }
  }

  const existingHistoryKeys = new Set(localTables.history.map(historyKey))
  const historyToAppend = remotePayload.history.filter(h => !existingHistoryKeys.has(historyKey(h))).length

  const localSettingsKeys = new Set(
    localTables.settings
      .filter(s => (s.key as string) !== 'flashcardsEnabled')
      .map(s => s.key),
  )
  const settingsFromRemote = remotePayload.settings.filter(
    s => (s.key as string) !== 'flashcardsEnabled' && !localSettingsKeys.has(s.key),
  ).length

  const localLogDates = new Set(localTables.dailyLogs.map(l => l.dateString))
  const dailyLogDeltas = remotePayload.dailyLogs.filter(l => localLogDates.has(l.dateString)).length

  return {
    tasksAdded,
    tasksUpdated,
    historyToAppend,
    settingsFromRemote,
    dailyLogDeltas,
    categoriesRemapped,
  }
}
