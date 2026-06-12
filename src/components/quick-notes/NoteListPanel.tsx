import { Edit3, Plus, Search, Trash2, X } from 'lucide-react'
import type { CategoryItem, QuickNoteItem } from '../../db/types'
import type { useNoteFilters } from './useNoteFilters'

type NoteFiltersApi = ReturnType<typeof useNoteFilters>

interface NoteListPanelProps {
  categories: CategoryItem[]
  filteredNotes: QuickNoteItem[]
  categoriesMap: Map<number, CategoryItem>
  filters: NoteFiltersApi
  onStartEditing: (note: QuickNoteItem) => void
  onDelete: (id: number, e: React.MouseEvent) => void
  onCreateNote: () => void
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

  return (
    <div className="flex-1 flex flex-col min-h-0">
      <div className="p-3 border-b border-white/5 flex flex-col gap-2 bg-black/10 select-none">
        <div className="relative flex items-center bg-white/[0.02] border border-white/5 rounded-xl px-2.5 py-1.5 focus-within:border-white/10 transition-all">
          <Search className="h-3.5 w-3.5 text-slate-500 mr-2" />
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            onFocus={() => setSearchFocused(true)}
            onBlur={() => setTimeout(() => setSearchFocused(false), 200)}
            placeholder="Search notes or use #tag..."
            className="bg-transparent text-xs text-white outline-none w-full placeholder-white/20"
          />
          {searchQuery && (
            <button onClick={() => setSearchQuery('')} className="text-slate-500 hover:text-white cursor-pointer p-0.5">
              <X className="h-3 w-3" />
            </button>
          )}
        </div>

        {searchFocused && categories.length > 0 && (
          <div className="flex flex-wrap gap-1 bg-black/40 border border-white/5 p-2 rounded-xl animate-fade-in">
            <span className="text-[8px] font-mono text-slate-450 w-full mb-0.5">Quick tag search tags:</span>
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
                  className={`text-[9px] font-mono px-2 py-0.5 rounded-lg border transition-all cursor-pointer ${
                    isActive
                      ? 'text-white border-white/20'
                      : 'bg-white/5 border-white/5 text-slate-400 hover:text-white hover:bg-white/10'
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
            className={`px-2.5 py-1 rounded-lg text-[9px] font-bold border shrink-0 transition-all cursor-pointer ${
              activeCategoryId === 'all'
                ? 'bg-white/10 text-white border-white/10'
                : 'bg-white/[0.01] text-white/40 border-white/5 hover:text-white'
            }`}
          >
            All
          </button>
          {categories.map(c => (
            <button
              key={c.id}
              onClick={() => c.id !== undefined && setActiveCategoryId(c.id)}
              className={`px-2.5 py-1 rounded-lg text-[9px] font-bold border shrink-0 transition-all flex items-center gap-1.5 cursor-pointer ${
                activeCategoryId === c.id
                  ? 'text-white border-white/15'
                  : 'bg-white/[0.01] text-white/40 border-white/5 hover:text-white'
              }`}
              style={activeCategoryId === c.id ? { backgroundColor: `${c.color}15`, borderColor: c.color } : {}}
            >
              <span className="h-1 w-1 rounded-full animate-pulse-soft" style={{ backgroundColor: c.color }} />
              {c.name}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto custom-scrollbar p-3 space-y-2.5">
        {filteredNotes.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center p-6 border border-dashed border-white/5 rounded-2xl bg-black/10 my-1">
            <Edit3 className="h-8 w-8 text-white/20 mb-3 animate-pulse" />
            <p className="text-xs text-white/40 select-none uppercase font-mono tracking-wider">Empty Notes Workspace</p>
            <p className="text-[10px] text-slate-500 mt-1.5 select-none leading-relaxed">No note logs matches the current criteria. Click Create Note below to jot down study structures, ideas, or quick references!</p>
          </div>
        ) : (
          filteredNotes.map(note => {
            const cat = note.categoryId !== undefined ? categoriesMap.get(note.categoryId) : undefined
            const updatedTimeStr = new Date(note.updatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
            return (
              <div
                key={note.id}
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
                className="group relative p-3.5 rounded-xl border border-white/5 bg-white/[0.015] hover:bg-white/[0.03] hover:border-white/10 hover:shadow-md transition-all duration-300 cursor-pointer flex flex-col gap-2.5 overflow-hidden"
              >
                <div className="absolute left-0 inset-y-0 w-1" style={{ backgroundColor: note.color || '#06b6d4' }} />
                <div className="flex items-start justify-between gap-4">
                  <div className="space-y-1 min-w-0">
                    {cat && (
                      <span
                        className="inline-block text-[8px] font-bold px-1.5 py-0.5 rounded border font-mono select-none"
                        style={{ backgroundColor: `${cat.color}10`, borderColor: `${cat.color}25`, color: cat.color }}
                      >
                        {cat.name}
                      </span>
                    )}
                    <h4 className="text-xs font-bold text-white leading-normal truncate pr-2 select-none">
                      {note.title || 'Untitled note'}
                    </h4>
                  </div>
                  <button
                    onClick={e => note.id !== undefined && onDelete(note.id, e)}
                    className="text-slate-500 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded hover:bg-white/5 cursor-pointer shrink-0"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
                <p className="text-[10px] text-slate-450 leading-relaxed truncate select-none italic">
                  {note.content ? note.content : 'No additional scratch details.'}
                </p>
                <div className="flex justify-between items-center text-[8px] font-mono text-slate-500 select-none">
                  <span>Updated: {new Date(note.updatedAt).toLocaleDateString()}</span>
                  <span>{updatedTimeStr}</span>
                </div>
              </div>
            )
          })
        )}
      </div>

      <div className="p-3 border-t border-white/5 bg-black/20 flex select-none">
        <button
          onClick={onCreateNote}
          className="w-full py-2 rounded-xl text-xs font-bold bg-white/10 border border-white/10 text-white hover:bg-white/15 transition-all cursor-pointer flex items-center justify-center gap-2 shadow-[inset_0_1px_1px_rgba(255,255,255,0.05)] active:scale-95"
        >
          <Plus className="h-4 w-4" />
          <span>Create Note</span>
        </button>
      </div>
    </div>
  )
}
