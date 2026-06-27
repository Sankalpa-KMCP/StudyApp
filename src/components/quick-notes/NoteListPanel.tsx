import { Edit3, Plus, Search, Trash2, X } from 'lucide-react'
import type { CategoryItem, QuickNoteItem } from '../../db/types'
import type { useNoteFilters } from '../../hooks/quick-notes/useNoteFilters'
import { useTranslation } from '../../i18n/useTranslation'
import { getDefaultNoteColor } from '../../lib/settings/noteTagColors'
import { EmptyState } from '../shared/EmptyState'
import { VirtualList } from '../shared/VirtualList'

type NoteFiltersApi = ReturnType<typeof useNoteFilters>

const VIRTUALIZE_THRESHOLD = 25
const NOTE_ROW_ESTIMATE = 120

interface NoteListPanelProps {
  categories: CategoryItem[]
  filteredNotes: QuickNoteItem[]
  categoriesMap: Map<number, CategoryItem>
  noteTagColors: string[]
  filters: NoteFiltersApi
  onStartEditing: (note: QuickNoteItem) => void
  onDelete: (id: number) => void
  onCreateNote: () => void
}

function NoteRow({
  note,
  categoriesMap,
  defaultColor,
  onStartEditing,
  onDelete,
}: {
  note: QuickNoteItem
  categoriesMap: Map<number, CategoryItem>
  defaultColor: string
  onStartEditing: (note: QuickNoteItem) => void
  onDelete: (id: number) => void
}) {
  const { t } = useTranslation()
  const cat = note.categoryId !== undefined ? categoriesMap.get(note.categoryId) : undefined
  const displayTitle = note.title || t('notesUntitled')
  const updatedTimeStr = new Date(note.updatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  const updatedDateStr = new Date(note.updatedAt).toLocaleDateString()

  return (
    <article className="group relative p-3.5 rounded-xl border border-card surface-subtle hover:surface-subtle hover:border-card hover:shadow-md transition-all duration-300 flex flex-col gap-2.5 overflow-hidden mb-2.5">
      <div className="absolute left-0 inset-y-0 w-1" style={{ backgroundColor: note.color || defaultColor }} />
      <div className="flex items-start justify-between gap-2">
        <div className="space-y-1 min-w-0 flex-1">
          {cat && (
            <span
              className="inline-block text-micro font-bold px-1.5 py-0.5 rounded border font-mono select-none"
              style={{ backgroundColor: `${cat.color}10`, borderColor: `${cat.color}25`, color: cat.color }}
            >
              {cat.name}
            </span>
          )}
          <h4 className="text-xs font-bold text-primary leading-normal truncate pr-2 select-none">
            {displayTitle}
          </h4>
        </div>
        <div className="flex items-center gap-0.5 shrink-0 opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 transition-opacity">
          <button
            type="button"
            onClick={() => onStartEditing(note)}
            aria-label={t('notesEditAria', { title: displayTitle })}
            className="focus-ring text-muted hover:text-accent-blue p-1 rounded-lg hover:surface-subtle cursor-pointer"
          >
            <Edit3 className="h-3.5 w-3.5" aria-hidden />
          </button>
          <button
            type="button"
            onClick={() => note.id !== undefined && onDelete(note.id)}
            aria-label={t('notesDeleteAria', { title: displayTitle })}
            className="focus-ring text-muted hover:text-danger p-1 rounded-lg hover:surface-subtle cursor-pointer"
          >
            <Trash2 className="h-3.5 w-3.5" aria-hidden />
          </button>
        </div>
      </div>
      <p className="text-caption text-muted leading-relaxed truncate select-none italic">
        {note.content ? note.content : t('notesNoDetails')}
      </p>
      <div className="flex justify-between items-center text-micro font-mono text-muted select-none">
        <span>{t('notesUpdatedDate', { date: updatedDateStr })}</span>
        <span>{updatedTimeStr}</span>
      </div>
    </article>
  )
}

export function NoteListPanel({
  categories,
  filteredNotes,
  categoriesMap,
  noteTagColors,
  filters,
  onStartEditing,
  onDelete,
  onCreateNote,
}: NoteListPanelProps) {
  const { t } = useTranslation()
  const defaultNoteColor = getDefaultNoteColor(noteTagColors)
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
          <Search className="h-3.5 w-3.5 text-muted mr-2" aria-hidden />
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            onFocus={() => setSearchFocused(true)}
            onBlur={() => setTimeout(() => setSearchFocused(false), 200)}
            placeholder={t('notesSearchPlaceholder')}
            aria-label={t('notesSearchAria')}
            className="bg-transparent text-xs text-primary outline-none w-full placeholder:text-muted focus-ring rounded-lg"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              aria-label={t('notesClearSearchAria')}
              className="focus-ring text-muted hover:text-primary cursor-pointer p-0.5 rounded-lg"
            >
              <X className="h-3 w-3" aria-hidden />
            </button>
          )}
        </div>

        {searchFocused && categories.length > 0 && (
          <div className="flex flex-wrap gap-1 surface-subtle border border-card p-2 rounded-xl animate-fade-in">
            <span className="text-micro font-mono text-muted w-full mb-0.5">{t('notesQuickTagLabel')}</span>
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
                  className={`focus-ring text-micro font-mono px-2 py-0.5 rounded-lg border transition-all cursor-pointer ${
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
            type="button"
            onClick={() => setActiveCategoryId('all')}
            className={`focus-ring px-2.5 py-1 rounded-lg text-micro font-bold border shrink-0 transition-all cursor-pointer ${
              activeCategoryId === 'all'
                ? 'surface-track text-primary border-card'
                : 'surface-subtle text-muted border-card hover:text-primary'
            }`}
          >
            {t('notesFilterAll')}
          </button>
          {categories.map(c => (
            <button
              key={c.id}
              type="button"
              onClick={() => c.id !== undefined && setActiveCategoryId(c.id)}
              className={`focus-ring px-2.5 py-1 rounded-lg text-micro font-bold border shrink-0 transition-all flex items-center gap-1.5 cursor-pointer ${
                activeCategoryId === c.id
                  ? 'text-primary border-card'
                  : 'surface-subtle text-muted border-card hover:text-primary'
              }`}
              style={activeCategoryId === c.id ? { backgroundColor: `${c.color}15`, borderColor: c.color } : {}}
            >
              <span className="h-1 w-1 rounded-full animate-pulse-soft" style={{ backgroundColor: c.color }} aria-hidden />
              {c.name}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 min-h-0 p-3">
        {filteredNotes.length === 0 ? (
          <EmptyState
            icon={<Edit3 className="h-8 w-8" />}
            title={t('notesEmptyTitle')}
            description={t('notesEmptyDescription')}
            action={
              <button
                type="button"
                onClick={onCreateNote}
                className="focus-ring px-4 py-2 rounded-xl text-xs font-bold surface-track border border-card text-primary hover:surface-track transition-all cursor-pointer"
              >
                {t('notesCreateNote')}
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
                defaultColor={defaultNoteColor}
                onStartEditing={onStartEditing}
                onDelete={onDelete}
              />
            )}
          />
        )}
      </div>

      <div className="p-3 border-t border-card surface-subtle flex select-none">
        <button
          type="button"
          onClick={onCreateNote}
          className="focus-ring w-full py-2 rounded-xl text-xs font-bold surface-track border border-card text-primary hover:surface-track transition-all cursor-pointer flex items-center justify-center gap-2 shadow-[inset_0_1px_1px_rgba(255,255,255,0.05)] active:scale-95"
        >
          <Plus className="h-4 w-4" aria-hidden />
          <span>{t('notesCreateNote')}</span>
        </button>
      </div>
    </div>
  )
}
