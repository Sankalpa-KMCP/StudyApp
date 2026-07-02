import { useEffect, useMemo, useRef, useState } from 'react'
import { Search } from 'lucide-react'
import { ModalShell } from './shared/ModalShell'
import {
  buildCommandPaletteItems,
  filterCommandPaletteItems,
  COMMAND_PALETTE_GROUP_LABELS,
  type CommandPaletteItem,
  type CommandPaletteItemType,
} from '../lib/routing/commandPaletteSearch'
import type { CategoryItem, DailyLog, FlashcardItem, QuickNoteItem, TaskItem } from '../db/types'
import type { ActiveTab } from '../types/app'

export interface CommandPaletteSelection {
  type: CommandPaletteItem['type']
  taskId?: number
  noteId?: number
  flashcardId?: number
  tab?: ActiveTab
  settingsSection?: string
  actionId?: string
  journalDate?: string
}

interface CommandPaletteProps {
  isOpen: boolean
  onClose: () => void
  onSelect: (selection: CommandPaletteSelection) => void
  tasks: TaskItem[]
  notes: QuickNoteItem[]
  flashcards: FlashcardItem[]
  categories: CategoryItem[]
  flashcardsEnabled: boolean
  dailyLogs?: DailyLog[]
}

const GROUP_ORDER: CommandPaletteItemType[] = ['action', 'settings', 'tab', 'task', 'note', 'journal', 'flashcard']

export function CommandPalette({
  isOpen,
  onClose,
  onSelect,
  tasks,
  notes,
  flashcards,
  categories,
  flashcardsEnabled,
  dailyLogs = [],
}: CommandPaletteProps) {
  const [query, setQuery] = useState('')
  const [activeIndex, setActiveIndex] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)

  const allItems = useMemo(
    () => (isOpen
      ? buildCommandPaletteItems({ tasks, notes, flashcards, categories, dailyLogs, flashcardsEnabled })
      : []),
    [isOpen, tasks, notes, flashcards, categories, dailyLogs, flashcardsEnabled],
  )

  const results = useMemo(() => filterCommandPaletteItems(allItems, query), [allItems, query])

  useEffect(() => {
    if (!isOpen) return
    const t = window.setTimeout(() => inputRef.current?.focus(), 0)
    return () => window.clearTimeout(t)
  }, [isOpen])

  const handleClose = () => {
    setQuery('')
    setActiveIndex(0)
    onClose()
  }

  const grouped = useMemo(() => {
    const map = new Map<CommandPaletteItemType, CommandPaletteItem[]>()
    for (const item of results) {
      const list = map.get(item.type) ?? []
      list.push(item)
      map.set(item.type, list)
    }
    return GROUP_ORDER.filter(t => map.has(t)).map(type => ({
      type,
      label: COMMAND_PALETTE_GROUP_LABELS[type],
      items: map.get(type) ?? [],
    }))
  }, [results])

  const flatResults = useMemo(() => grouped.flatMap(g => g.items), [grouped])
  const safeActiveIndex = Math.min(activeIndex, Math.max(flatResults.length - 1, 0))

  const handleSelect = (item: CommandPaletteItem) => {
    onSelect({
      type: item.type,
      taskId: item.taskId,
      noteId: item.noteId,
      flashcardId: item.flashcardId,
      tab: item.tab,
      settingsSection: item.settingsSection,
      actionId: item.actionId,
      journalDate: item.journalDate,
    })
    handleClose()
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActiveIndex(i => Math.min(i + 1, Math.max(flatResults.length - 1, 0)))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActiveIndex(i => Math.max(i - 1, 0))
    } else if (e.key === 'Enter' && flatResults[safeActiveIndex]) {
      e.preventDefault()
      handleSelect(flatResults[safeActiveIndex])
    }
  }

  let rowIndex = -1

  return (
    <ModalShell
      open={isOpen}
      onClose={handleClose}
      ariaLabel="Command palette"
      panelClassName="max-w-lg w-full surface-overlay border border-card p-0 shadow-2xl overflow-hidden"
      zIndexClass="z-[60]"
    >
      <div className="flex items-center gap-3 border-b border-card px-4 py-3">
        <Search className="h-4 w-4 text-muted shrink-0" aria-hidden />
        <input
          ref={inputRef}
          type="search"
          value={query}
          onChange={e => {
            setQuery(e.target.value)
            setActiveIndex(0)
          }}
          onKeyDown={handleKeyDown}
          placeholder="Search settings, tasks, notes, tabs…"
          aria-label="Search commands"
          className="flex-1 bg-transparent text-sm text-primary outline-none placeholder:text-muted"
          autoComplete="off"
        />
        <kbd className="hidden sm:inline rounded border border-card surface-subtle px-1.5 py-0.5 text-micro font-mono text-muted">Esc</kbd>
      </div>
      <div className="max-h-80 overflow-y-auto p-2" role="listbox" aria-label="Search results">
        {flatResults.length === 0 ? (
          <p className="px-3 py-6 text-center text-sm text-muted">No matches</p>
        ) : (
          grouped.map(group => (
            <div key={group.type} className="mb-2 last:mb-0">
              <p className="px-3 py-1 text-micro font-bold uppercase tracking-wider text-muted">{group.label}</p>
              {group.items.map(item => {
                rowIndex += 1
                const idx = rowIndex
                const isActive = idx === safeActiveIndex
                return (
                  <button
                    key={item.id}
                    type="button"
                    role="option"
                    aria-selected={isActive}
                    className={`flex w-full flex-col items-start rounded-xl px-3 py-2.5 text-left transition-colors ${
                      isActive ? 'bg-accent-blue/20 text-primary' : 'text-secondary hover:surface-subtle'
                    }`}
                    onMouseEnter={() => setActiveIndex(idx)}
                    onClick={() => handleSelect(item)}
                  >
                    <span className="text-sm font-medium truncate w-full">{item.label}</span>
                    {item.subtitle && (
                      <span className="text-xs text-muted truncate w-full mt-0.5">{item.subtitle}</span>
                    )}
                  </button>
                )
              })}
            </div>
          ))
        )}
      </div>
    </ModalShell>
  )
}
