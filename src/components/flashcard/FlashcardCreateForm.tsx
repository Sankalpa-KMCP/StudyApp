import type { FormEvent } from 'react'
import { GraduationCap, Layers } from 'lucide-react'
import type { CategoryItem } from '../../db/types'
import { InlineCategoryManager } from '../shared/InlineCategoryManager'
import { PanelCard } from '../shared/PanelCard'
import { PanelHeader } from '../shared/PanelHeader'
import { Button } from '../shared/Button'

interface FlashcardCreateFormProps {
  categories: CategoryItem[]
  addCategory: (name: string, color: string) => Promise<number | void> | number | void
  deleteCategory: (id: number) => Promise<void> | void
  newQuestion: string
  setNewQuestion: (v: string) => void
  newAnswer: string
  setNewAnswer: (v: string) => void
  newCategoryId: number | undefined
  setNewCategoryId: (id: number | undefined) => void
  onSubmit: (e: FormEvent) => void
  stats: { due: number; total: number }
  onStudyDue: () => void
  onStudyAll: () => void
}

export function FlashcardCreateForm({
  categories,
  addCategory,
  deleteCategory,
  newQuestion,
  setNewQuestion,
  newAnswer,
  setNewAnswer,
  newCategoryId,
  setNewCategoryId,
  onSubmit,
  stats,
  onStudyDue,
  onStudyAll,
}: FlashcardCreateFormProps) {
  return (
    <div className="lg:col-span-4 space-y-6">
      <PanelCard>
        <PanelHeader title="Create new flashcard" bordered={false} className="mb-4" />
        <form onSubmit={onSubmit} className="space-y-4">
          <div>
            <label htmlFor="flashcard-question" className="block text-[10px] font-bold uppercase text-white/45 mb-1.5 select-none">Question / Term</label>
            <textarea
              id="flashcard-question"
              required
              rows={2}
              value={newQuestion}
              onChange={e => setNewQuestion(e.target.value)}
              placeholder="Enter front side question..."
              className="w-full rounded-2xl border border-white/8 bg-white/4 px-4 py-3 text-sm text-white placeholder-white/25 outline-none transition-all focus:bg-white/8 focus:border-accent-blue/30"
            />
          </div>
          <div>
            <label htmlFor="flashcard-answer" className="block text-[10px] font-bold uppercase text-white/45 mb-1.5 select-none">Answer / Definition</label>
            <textarea
              id="flashcard-answer"
              required
              rows={3}
              value={newAnswer}
              onChange={e => setNewAnswer(e.target.value)}
              placeholder="Enter back side answer detail..."
              className="w-full rounded-2xl border border-white/8 bg-white/4 px-4 py-3 text-sm text-white placeholder-white/25 outline-none transition-all focus:bg-white/8 focus:border-accent-blue/30"
            />
          </div>
          <InlineCategoryManager
            label="Deck Category"
            categories={categories}
            addCategory={addCategory}
            deleteCategory={deleteCategory}
            selectedCategoryId={newCategoryId}
            onSelectCategory={setNewCategoryId}
          />
          <Button type="submit" variant="primary" className="w-full gap-2">
            Add to Deck
          </Button>
        </form>
      </PanelCard>

      <PanelCard className="space-y-3">
        <PanelHeader title="Study decks" bordered={false} className="mb-0" />
        <p className="text-[11px] text-white/40 select-none leading-relaxed">
          Reviewing cards periodically trains active recall. Shuffle is active by default.
        </p>
        <div className="grid grid-cols-2 gap-3 pt-2">
          <button
            onClick={onStudyDue}
            disabled={stats.due === 0}
            className={`py-3.5 rounded-[20px] text-xs font-semibold border flex flex-col items-center justify-center gap-1 transition-all ios-active-scale ${
              stats.due > 0
                ? 'bg-accent-blue/15 text-accent-blue border-accent-blue/20 hover:bg-accent-blue/20 cursor-pointer'
                : 'bg-white/[0.02] text-white/30 border-white/5 cursor-not-allowed'
            }`}
          >
            <GraduationCap className="h-4.5 w-4.5" />
            <span>Study Due ({stats.due})</span>
          </button>
          <button
            onClick={onStudyAll}
            disabled={stats.total === 0}
            className={`py-3.5 rounded-[20px] text-xs font-semibold border flex flex-col items-center justify-center gap-1 transition-all ios-active-scale ${
              stats.total > 0
                ? 'bg-white/5 text-white border-white/10 hover:bg-white/10 cursor-pointer'
                : 'bg-white/[0.02] text-white/30 border-white/5 cursor-not-allowed'
            }`}
          >
            <Layers className="h-4.5 w-4.5" />
            <span>Study All ({stats.total})</span>
          </button>
        </div>
      </PanelCard>
    </div>
  )
}
