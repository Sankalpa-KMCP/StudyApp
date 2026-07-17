import type { CommandPaletteItem } from '../lib/routing/commandPaletteSearch'
import type { ActiveTab } from './app'

export interface CommandPaletteSelection {
  type: CommandPaletteItem['type']
  taskId?: number
  noteId?: number
  tab?: ActiveTab
  settingsSection?: string
  actionId?: string
  journalDate?: string
}
