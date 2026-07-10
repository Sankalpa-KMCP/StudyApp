import type { ActiveTab } from '../../types/app'
import type { CategoryItem, DailyLog, QuickNoteItem, TaskItem } from '../../db/types'
import { NAV_TABS, TAB_CHROME } from '../../navigation/appNav'

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

export const COMMAND_ACTIONS: Array<{ id: string; label: string; subtitle: string }> = [
  { id: 'toggle-timer', label: 'Toggle timer', subtitle: 'Start or pause the focus timer' },
  { id: 'toggle-zen', label: 'Toggle focus mode', subtitle: 'Enter or exit zen overlay' },
  { id: 'export-backup', label: 'Export backup', subtitle: 'Download .studybackup vault' },
  { id: 'open-hotkeys', label: 'Keyboard shortcuts', subtitle: 'Show hotkey reference' },
  { id: 'add-task', label: 'Go to Focus', subtitle: 'Add or select a focus target' },
]

const SETTINGS_SHORTCUTS: Array<{ id: string; label: string; subtitle: string; settingsSection: string }> = [
  { id: 'settings-daily-goal', label: 'Daily goal', subtitle: 'Settings → Timer & Focus', settingsSection: 'settings-timer-focus' },
  { id: 'settings-backup', label: 'Export backup', subtitle: 'Settings → Backup Vault', settingsSection: 'settings-backup-vault' },
  { id: 'settings-theme', label: 'Theme', subtitle: 'Settings → Appearance', settingsSection: 'settings-aesthetics' },
]

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

  for (const action of COMMAND_ACTIONS) {
    items.push({
      id: `action-${action.id}`,
      type: 'action',
      label: action.label,
      subtitle: action.subtitle,
      actionId: action.id,
    })
  }

  for (const shortcut of SETTINGS_SHORTCUTS) {
    items.push({
      id: shortcut.id,
      type: 'settings',
      label: shortcut.label,
      subtitle: shortcut.subtitle,
      settingsSection: shortcut.settingsSection,
    })
  }

  for (const tab of NAV_TABS) {
    const chrome = TAB_CHROME[tab.id]
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
      subtitle: categoryName(task.categoryId) ?? 'Task',
      taskId: task.id,
    })
  }

  for (const note of notes) {
    items.push({
      id: `note-${note.id}`,
      type: 'note',
      label: note.title || 'Untitled note',
      subtitle: note.content.slice(0, 80) || 'Quick note',
      noteId: note.id,
    })
  }

  for (const log of dailyLogs) {
    if (!log.notes?.trim() && !log.mood?.trim()) continue
    items.push({
      id: `journal-${log.dateString}`,
      type: 'journal',
      label: log.notes?.slice(0, 60) || `Mood: ${log.mood}`,
      subtitle: `Journal · ${log.dateString}`,
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

export const COMMAND_PALETTE_GROUP_LABELS: Record<CommandPaletteItemType, string> = {
  action: 'Actions',
  settings: 'Settings',
  tab: 'Go to',
  task: 'Tasks',
  note: 'Notes',
  journal: 'Journal',
}
