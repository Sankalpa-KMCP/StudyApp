import type { ActiveTab } from '../../types/app'
import type { CategoryItem, DailyLog, QuickNoteItem, TaskItem } from '../../db/types'
import { t } from '../../i18n'
import { getNavTabs, getTabChrome } from '../../navigation/appNav'

export type CommandPaletteItemType = 'action' | 'task' | 'note' | 'tab' | 'settings' | 'journal'

export interface CommandPaletteItem {
  id: string
  type: CommandPaletteItemType
  label: string
  subtitle?: string
  taskId?: number
  noteId?: number
  tab?: ActiveTab
  settingsSection?: string
  actionId?: string
  journalDate?: string
}

function getCommandActions(): Array<{ id: string; label: string; subtitle: string }> {
  return [
    { id: 'toggle-timer', label: t('commandPaletteToggleTimer'), subtitle: t('commandPaletteToggleTimerSubtitle') },
    { id: 'toggle-zen', label: t('commandPaletteToggleZen'), subtitle: t('commandPaletteToggleZenSubtitle') },
    { id: 'export-backup', label: t('commandPaletteExportBackup'), subtitle: t('commandPaletteExportBackupSubtitle') },
    { id: 'open-hotkeys', label: t('commandPaletteOpenHotkeys'), subtitle: t('commandPaletteOpenHotkeysSubtitle') },
    { id: 'add-task', label: t('commandPaletteGoToFocus'), subtitle: t('commandPaletteGoToFocusSubtitle') },
  ]
}

function getSettingsShortcuts(): Array<{ id: string; label: string; subtitle: string; settingsSection: string }> {
  return [
    {
      id: 'settings-daily-goal',
      label: t('commandPaletteDailyGoal'),
      subtitle: t('commandPaletteDailyGoalSubtitle'),
      settingsSection: 'settings-timer-focus',
    },
    {
      id: 'settings-backup',
      label: t('commandPaletteSettingsBackup'),
      subtitle: t('commandPaletteSettingsBackupSubtitle'),
      settingsSection: 'settings-backup-vault',
    },
    {
      id: 'settings-theme',
      label: t('commandPaletteTheme'),
      subtitle: t('commandPaletteThemeSubtitle'),
      settingsSection: 'settings-aesthetics',
    },
  ]
}

function matchesQuery(query: string, ...parts: (string | undefined)[]): boolean {
  const q = query.trim().toLowerCase()
  if (!q) return true
  return parts.some(p => p?.toLowerCase().includes(q))
}

export function buildCommandPaletteItems(options: {
  tasks: TaskItem[]
  notes: QuickNoteItem[]
  categories: CategoryItem[]
  dailyLogs?: DailyLog[]
}): CommandPaletteItem[] {
  const { tasks, notes, categories, dailyLogs = [] } = options
  const categoryName = (id?: number) => categories.find(c => c.id === id)?.name

  const items: CommandPaletteItem[] = []

  for (const action of getCommandActions()) {
    items.push({
      id: `action-${action.id}`,
      type: 'action',
      label: action.label,
      subtitle: action.subtitle,
      actionId: action.id,
    })
  }

  for (const shortcut of getSettingsShortcuts()) {
    items.push({
      id: shortcut.id,
      type: 'settings',
      label: shortcut.label,
      subtitle: shortcut.subtitle,
      settingsSection: shortcut.settingsSection,
    })
  }

  for (const tab of getNavTabs()) {
    const chrome = getTabChrome()[tab.id]
    items.push({
      id: `tab-${tab.id}`,
      type: 'tab',
      label: chrome.title,
      subtitle: chrome.subtitle,
      tab: tab.id,
    })
  }

  for (const task of tasks) {
    if (!task.text?.trim()) continue
    items.push({
      id: `task-${task.id}`,
      type: 'task',
      label: task.text,
      subtitle: categoryName(task.categoryId) ?? t('commandPaletteTaskFallback'),
      taskId: task.id,
    })
  }

  for (const note of notes) {
    items.push({
      id: `note-${note.id}`,
      type: 'note',
      label: note.title || t('commandPaletteUntitledNote'),
      subtitle: note.content.slice(0, 80) || t('commandPaletteQuickNote'),
      noteId: note.id,
    })
  }

  for (const log of dailyLogs) {
    if (!log.notes?.trim() && !log.mood?.trim()) continue
    items.push({
      id: `journal-${log.dateString}`,
      type: 'journal',
      label: log.notes?.slice(0, 60) || t('commandPaletteJournalMood', { mood: log.mood ?? '' }),
      subtitle: t('commandPaletteJournalSubtitle', { date: log.dateString }),
      journalDate: log.dateString,
    })
  }

  return items
}

export function filterCommandPaletteItems(items: CommandPaletteItem[], query: string): CommandPaletteItem[] {
  const filtered = items.filter(item =>
    matchesQuery(query, item.label, item.subtitle),
  )
  if (!query.trim()) return filtered.slice(0, 12)
  return filtered.slice(0, 20)
}

export function getCommandPaletteGroupLabels(): Record<CommandPaletteItemType, string> {
  return {
    action: t('commandPaletteGroupActions'),
    settings: t('commandPaletteGroupSettings'),
    tab: t('commandPaletteGroupGoTo'),
    task: t('commandPaletteGroupTasks'),
    note: t('commandPaletteGroupNotes'),
    journal: t('commandPaletteGroupJournal'),
  }
}
