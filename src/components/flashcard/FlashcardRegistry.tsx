import { useState } from 'react'
import { Layers, Trash2, Calendar } from 'lucide-react'
import type { CategoryItem, FlashcardItem } from '../../db/types'
import { EmptyState } from '../shared/EmptyState'
import { PanelCard } from '../shared/PanelCard'
import { PanelHeader } from '../shared/PanelHeader'

interface FlashcardRegistryProps {
  flashcards: FlashcardItem[]
  filteredCards: FlashcardItem[]
  categoriesMap: Map<number, CategoryItem>
  activeCategoryFilter: 'all' | number
  activeSpacingFilter: 'all' | 'new' | 'due' | 'completed'
  setActiveSpacingFilter: (status: 'all' | 'new' | 'due' | 'completed') => void
  todayStr: string
  isDue: (card: FlashcardItem) => boolean
  onDelete: (id: number) => void
  onFocusCreate?: () => void
}

export function FlashcardRegistry({
  flashcards,
  filteredCards,
  categoriesMap,
  activeCategoryFilter,
  activeSpacingFilter,
  setActiveSpacingFilter,
  todayStr,
  isDue,
  onDelete,
  onFocusCreate,
}: FlashcardRegistryProps) {
  const VIRTUALIZE_THRESHOLD = 100
  const PAGE_SIZE = 50
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE)
  const shouldVirtualize = filteredCards.length > VIRTUALIZE_THRESHOLD
  const visibleCards = shouldVirtualize ? filteredCards.slice(0, visibleCount) : filteredCards

  return (
    <PanelCard className="lg:col-span-8 flex flex-col min-h-[450px] lg:h-[600px] !p-5">
      <PanelHeader
        title="Flashcards registry"
        bordered={false}
        className="mb-4"
        action={
          <div className="flex bg-black/35 border border-white/5 p-1 rounded-xl">
            {(['all', 'new', 'due', 'completed'] as const).map(status => {
              const count = flashcards.filter(c => {
                const matchesCategory = activeCategoryFilter === 'all' || c.categoryId === activeCategoryFilter
                if (!matchesCategory) return false
                if (status === 'all') return true
                if (status === 'new') return c.latestGrade === undefined
                if (status === 'due') return c.latestGrade !== undefined && (!c.nextReviewDate || c.nextReviewDate <= todayStr)
                if (status === 'completed') return c.latestGrade !== undefined && c.nextReviewDate && c.nextReviewDate > todayStr
                return true
              }).length

              return (
                <button
                  key={status}
                  type="button"
                  onClick={() => setActiveSpacingFilter(status)}
                  className={`px-2.5 py-1 rounded-lg text-[9px] font-bold uppercase tracking-wider transition-all cursor-pointer ${
                    activeSpacingFilter === status ? 'bg-white/10 text-white shadow-sm' : 'text-white/40 hover:text-white'
                  }`}
                >
                  {status} ({count})
                </button>
              )
            })}
          </div>
        }
      />

      <div className="flex-1 overflow-y-auto custom-scrollbar pr-1 space-y-3">
        {filteredCards.length === 0 ? (
          <EmptyState
            icon={<Layers className="h-8 w-8" />}
            title="No flashcards yet"
            description="Add a question and answer above to start spaced repetition practice."
            action={
              onFocusCreate ? (
                <button
                  type="button"
                  onClick={onFocusCreate}
                  className="rounded-full bg-accent-purple/15 border border-accent-purple/25 px-4 py-2 text-xs font-bold text-accent-purple hover:bg-accent-purple/25 transition-all"
                >
                  Create your first card
                </button>
              ) : undefined
            }
          />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {visibleCards.map(card => {
              const cat = card.categoryId !== undefined ? categoriesMap.get(card.categoryId) : undefined
              const isCardDue = isDue(card)
              return (
                <div
                  key={card.id}
                  className="group p-4.5 rounded-[22px] border border-white/8 bg-white/4 hover:bg-white/8 transition-all flex flex-col justify-between gap-3 relative shadow-sm"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="space-y-1">
                      <span
                        className="inline-block text-[8px] font-bold tracking-wider uppercase px-2 py-0.5 rounded-full border"
                        style={cat ? { backgroundColor: 'transparent', borderColor: cat.color, color: cat.color } : { backgroundColor: 'rgba(255,255,255,0.05)', color: 'rgba(255,255,255,0.4)', borderColor: 'rgba(255,255,255,0.08)' }}
                      >
                        {cat ? cat.name : 'Uncategorized'}
                      </span>
                      <p className="text-xs font-semibold text-white leading-normal pr-4 line-clamp-2">{card.question}</p>
                    </div>
                    <button
                      type="button"
                      aria-label={`Delete flashcard ${card.question}`}
                      onClick={() => card.id !== undefined && onDelete(card.id)}
                      className="text-white/40 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded-full hover:bg-white/5 cursor-pointer"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                  <div className="h-px bg-white/5" />
                  <p className="text-[10px] text-white/50 leading-normal line-clamp-2 italic">{card.answer}</p>
                  <div className="flex items-center justify-between text-[8px] font-mono text-white/40 mt-1 select-none">
                    <span className="flex items-center gap-1">
                      <Calendar className="h-3 w-3" />
                      Next:{' '}
                      {card.nextReviewDate ? (
                        <span className={isCardDue ? 'text-accent-amber font-bold' : 'text-white/45'}>
                          {card.nextReviewDate} {isCardDue && '(Due)'}
                        </span>
                      ) : (
                        <span className="text-accent-blue font-bold">Unreviewed</span>
                      )}
                    </span>
                    <span>Grade: {card.latestGrade !== undefined ? `${card.latestGrade}/5` : 'None'}</span>
                  </div>
                </div>
              )
            })}
            {shouldVirtualize && visibleCount < filteredCards.length && (
              <button
                type="button"
                onClick={() => setVisibleCount(c => c + PAGE_SIZE)}
                className="col-span-full rounded-full border border-white/10 bg-white/5 px-4 py-2 text-label font-semibold text-white/70 hover:bg-white/10"
              >
                Show more ({filteredCards.length - visibleCount} remaining)
              </button>
            )}
          </div>
        )}
      </div>
    </PanelCard>
  )
}
