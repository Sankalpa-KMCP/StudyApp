import type { ActiveTab } from '../types/app'
import type { CategoryItem, FlashcardItem, QuickNoteItem, TaskItem } from '../db/types'
import { getVisibleNavTabs } from '../navigation/appNav'
import { TAB_CHROME } from '../navigation/appNav'

export type CommandPaletteItemType = 'task' | 'note' | 'flashcard' | 'tab' | 'settings'

export interface CommandPaletteItem {
  id: string
  type: CommandPaletteItemType
  label: string
  subtitle?: string
  taskId?: number
  noteId?: number
  flashcardId?: number
  tab?: ActiveTab
  settingsSection?: string
}

const SETTINGS_SHORTCUTS: Array<{ id: string; label: string; subtitle: string; settingsSection: string }> = [
  { id: 'settings-daily-goal', label: 'Daily goal', subtitle: 'Settings → Timer & Focus', settingsSection: 'settings-timer-focus' },
  { id: 'settings-flashcards', label: 'Enable flashcards', subtitle: 'Settings → Study', settingsSection: 'settings-flashcards' },
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
  flashcards: FlashcardItem[]
  categories: CategoryItem[]
  flashcardsEnabled: boolean
}): CommandPaletteItem[] {
  const { tasks, notes, flashcards, categories, flashcardsEnabled } = options
  const categoryName = (id?: number) => categories.find(c => c.id === id)?.name

  const items: CommandPaletteItem[] = []

  for (const shortcut of SETTINGS_SHORTCUTS) {
    items.push({
      id: shortcut.id,
      type: 'settings',
      label: shortcut.label,
      subtitle: shortcut.subtitle,
      settingsSection: shortcut.settingsSection,
    })
  }

  for (const tab of getVisibleNavTabs(flashcardsEnabled)) {
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

  if (flashcardsEnabled) {
    for (const card of flashcards) {
      items.push({
        id: `flashcard-${card.id}`,
        type: 'flashcard',
        label: card.question,
        subtitle: card.answer.slice(0, 80) || 'Flashcard',
        flashcardId: card.id,
      })
    }
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
  settings: 'Settings',
  tab: 'Go to',
  task: 'Tasks',
  note: 'Notes',
  flashcard: 'Flashcards',
}
