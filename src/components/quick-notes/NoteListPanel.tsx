import { Edit3, Plus, Search, Trash2, X } from 'lucide-react'
import type { CategoryItem, QuickNoteItem } from '../../db/types'
import type { useNoteFilters } from './useNoteFilters'
import { EmptyState } from '../shared/EmptyState'
import { VirtualList } from '../shared/VirtualList'

type NoteFiltersApi = ReturnType<typeof useNoteFilters>

const VIRTUALIZE_THRESHOLD = 25
const NOTE_ROW_ESTIMATE = 120

interface NoteListPanelProps {
  categories: CategoryItem[]
  filteredNotes: QuickNoteItem[]
  categoriesMap: Map<number, CategoryItem>
  filters: NoteFiltersApi
  onStartEditing: (note: QuickNoteItem) => void
  onDelete: (id: number, e: React.MouseEvent) => void
  onCreateNote: () => void
}

function NoteRow({
  note,
  categoriesMap,
  onStartEditing,
  onDelete,
}: {
  note: QuickNoteItem
  categoriesMap: Map<number, CategoryItem>
  onStartEditing: (note: QuickNoteItem) => void
  onDelete: (id: number, e: React.MouseEvent) => void
}) {
  const cat = note.categoryId !== undefined ? categoriesMap.get(note.categoryId) : undefined
  const updatedTimeStr = new Date(note.updatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })

  return (
    <div
      role="button"
      tabIndex={0}
      aria-label={`Edit note ${note.title || 'untitled'}`}
      onClick={() => onStartEditing(note)}
      onKeyDown={e => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          onStartEditing(note)
        }
      }}
      className="group relative p-3.5 rounded-xl border border-card surface-subtle hover:surface-subtle hover:border-card hover:shadow-md transition-all duration-300 cursor-pointer flex flex-col gap-2.5 overflow-hidden mb-2.5"
    >
      <div className="absolute left-0 inset-y-0 w-1" style={{ backgroundColor: note.color || '#06b6d4' }} />
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-1 min-w-0">
          {cat && (
            <span
              className="inline-block text-micro font-bold px-1.5 py-0.5 rounded border font-mono select-none"
              style={{ backgroundColor: `${cat.color}10`, borderColor: `${cat.color}25`, color: cat.color }}
            >
              {cat.name}
            </span>
          )}
          <h4 className="text-xs font-bold text-primary leading-normal truncate pr-2 select-none">
            {note.title || 'Untitled note'}
          </h4>
        </div>
        <button
          onClick={e => note.id !== undefined && onDelete(note.id, e)}
          className="text-muted hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded hover:surface-subtle cursor-pointer shrink-0"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>
      <p className="text-caption text-slate-450 leading-relaxed truncate select-none italic">
        {note.content ? note.content : 'No additional scratch details.'}
      </p>
      <div className="flex justify-between items-center text-micro font-mono text-muted select-none">
        <span>Updated: {new Date(note.updatedAt).toLocaleDateString()}</span>
        <span>{updatedTimeStr}</span>
      </div>
    </div>
  )
}

export function NoteListPanel({
  categories,
  filteredNotes,
  categoriesMap,
  filters,
  onStartEditing,
  onDelete,
  onCreateNote,
}: NoteListPanelProps) {
  const {
    searchQuery,
    setSearchQuery,
    searchFocused,
    setSearchFocused,
    activeCategoryId,
    setActiveCategoryId,
  } = filters

  const shouldVirtualize = filteredNotes.length > VIRTUALIZE_THRESHOLD

  return (
    <div className="flex-1 flex flex-col min-h-0">
      <div className="p-3 border-b border-card flex flex-col gap-2 surface-subtle select-none">
        <div className="relative flex items-center surface-subtle border border-card rounded-xl px-2.5 py-1.5 focus-within:border-card transition-all">
          <Search className="h-3.5 w-3.5 text-muted mr-2" />
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            onFocus={() => setSearchFocused(true)}
            onBlur={() => setTimeout(() => setSearchFocused(false), 200)}
            placeholder="Search notes or use #tag..."
            aria-label="Search notes"
            className="bg-transparent text-xs text-primary outline-none w-full placeholder:text-muted"
          />
          {searchQuery && (
            <button onClick={() => setSearchQuery('')} className="text-muted hover:text-primary cursor-pointer p-0.5">
              <X className="h-3 w-3" />
            </button>
          )}
        </div>

        {searchFocused && categories.length > 0 && (
          <div className="flex flex-wrap gap-1 surface-subtle border border-card p-2 rounded-xl animate-fade-in">
            <span className="text-micro font-mono text-slate-450 w-full mb-0.5">Quick tag search tags:</span>
            {categories.map(c => {
              const tagText = `#${c.name.replace(/\s+/g, '')}`
              const isActive = searchQuery.includes(tagText)
              return (
                <button
                  key={c.id}
                  type="button"
                  onMouseDown={e => e.preventDefault()}
                  onClick={() => {
                    if (isActive) {
                      setSearchQuery(prev => prev.replace(tagText, '').replace(/\s+/g, ' ').trim())
                    } else {
                      setSearchQuery(prev => `${prev} ${tagText}`.replace(/\s+/g, ' ').trim())
                    }
                  }}
                  className={`text-micro font-mono px-2 py-0.5 rounded-lg border transition-all cursor-pointer ${
                    isActive
                      ? 'text-primary border-card'
                      : 'surface-subtle border-card text-muted hover:text-primary hover:surface-track'
                  }`}
                  style={{ borderLeftColor: c.color, borderLeftWidth: '3px' }}
                >
                  {tagText}
                </button>
              )
            })}
          </div>
        )}

        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
          <button
            onClick={() => setActiveCategoryId('all')}
            className={`px-2.5 py-1 rounded-lg text-micro font-bold border shrink-0 transition-all cursor-pointer ${
              activeCategoryId === 'all'
                ? 'surface-track text-primary border-card'
                : 'surface-subtle text-muted border-card hover:text-primary'
            }`}
          >
            All
          </button>
          {categories.map(c => (
            <button
              key={c.id}
              onClick={() => c.id !== undefined && setActiveCategoryId(c.id)}
              className={`px-2.5 py-1 rounded-lg text-micro font-bold border shrink-0 transition-all flex items-center gap-1.5 cursor-pointer ${
                activeCategoryId === c.id
                  ? 'text-primary border-card'
                  : 'surface-subtle text-muted border-card hover:text-primary'
              }`}
              style={activeCategoryId === c.id ? { backgroundColor: `${c.color}15`, borderColor: c.color } : {}}
            >
              <span className="h-1 w-1 rounded-full animate-pulse-soft" style={{ backgroundColor: c.color }} />
              {c.name}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 min-h-0 p-3">
        {filteredNotes.length === 0 ? (
          <EmptyState
            icon={<Edit3 className="h-8 w-8" />}
            title="Empty notes workspace"
            description="No notes match the current filters. Create a scratch note for study structures, ideas, or quick references."
            action={
              <button
                type="button"
                onClick={onCreateNote}
                className="px-4 py-2 rounded-xl text-xs font-bold surface-track border border-card text-primary hover:surface-track transition-all cursor-pointer"
              >
                Create note
              </button>
            }
          />
        ) : (
          <VirtualList
            items={filteredNotes}
            estimateSize={NOTE_ROW_ESTIMATE}
            enabled={shouldVirtualize}
            className="h-full pr-1"
            getKey={note => note.id ?? note.updatedAt}
            renderItem={note => (
              <NoteRow
                note={note}
                categoriesMap={categoriesMap}
                onStartEditing={onStartEditing}
                onDelete={onDelete}
              />
            )}
          />
        )}
      </div>

      <div className="p-3 border-t border-card surface-subtle flex select-none">
        <button
          onClick={onCreateNote}
          className="w-full py-2 rounded-xl text-xs font-bold surface-track border border-card text-primary hover:surface-track transition-all cursor-pointer flex items-center justify-center gap-2 shadow-[inset_0_1px_1px_rgba(255,255,255,0.05)] active:scale-95"
        >
          <Plus className="h-4 w-4" />
          <span>Create Note</span>
        </button>
      </div>
    </div>
  )
}
