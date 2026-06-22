import { useEffect, useMemo, useRef, useState } from 'react'
import { Search } from 'lucide-react'
import { ModalShell } from './shared/ModalShell'
import {
  buildCommandPaletteItems,
  filterCommandPaletteItems,
  getCommandPaletteGroupLabels,
  type CommandPaletteItem,
  type CommandPaletteItemType,
} from '../lib/routing/commandPaletteSearch'
import { useTranslation } from '../i18n/useTranslation'
import type { CategoryItem, DailyLog, QuickNoteItem, TaskItem } from '../db/types'
import type { CommandPaletteSelection } from '../types/commandPalette'

interface CommandPaletteProps {
  isOpen: boolean
  onClose: () => void
  onSelect: (selection: CommandPaletteSelection) => void
  tasks: TaskItem[]
  notes: QuickNoteItem[]
  categories: CategoryItem[]
  dailyLogs?: DailyLog[]
}

const GROUP_ORDER: CommandPaletteItemType[] = ['action', 'settings', 'tab', 'task', 'note', 'journal']

export function CommandPalette({
  isOpen,
  onClose,
  onSelect,
  tasks,
  notes,
  categories,
  dailyLogs = [],
}: CommandPaletteProps) {
  const { t } = useTranslation()
  const [query, setQuery] = useState('')
  const [activeIndex, setActiveIndex] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)

  const allItems = useMemo(
    () => (isOpen
      ? buildCommandPaletteItems({ tasks, notes, categories, dailyLogs })
      : []),
    [isOpen, tasks, notes, categories, dailyLogs],
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
    const groupLabels = getCommandPaletteGroupLabels()
    const map = new Map<CommandPaletteItemType, CommandPaletteItem[]>()
    for (const item of results) {
      const list = map.get(item.type) ?? []
      list.push(item)
      map.set(item.type, list)
    }
    return GROUP_ORDER.filter(t => map.has(t)).map(type => ({
      type,
      label: groupLabels[type],
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
      ariaLabel={t('commandPaletteAria')}
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
          placeholder={t('commandPaletteSearchPlaceholder')}
          aria-label={t('commandPaletteSearchAria')}
          className="flex-1 bg-transparent text-sm text-primary outline-none placeholder:text-muted"
          autoComplete="off"
        />
        <kbd className="hidden sm:inline rounded border border-card surface-subtle px-1.5 py-0.5 text-micro font-mono text-muted">Esc</kbd>
      </div>
      <div className="max-h-80 overflow-y-auto p-2" role="listbox" aria-label={t('commandPaletteResultsAria')}>
        {flatResults.length === 0 ? (
          <p className="px-3 py-6 text-center text-sm text-muted">{t('commandPaletteNoMatches')}</p>
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
