import { Layers } from 'lucide-react'
import type { CSSProperties } from 'react'
import { Button } from '../shared/Button'
import { countDueFlashcards } from './flashcardDue'
import type { FlashcardItem } from '../../db/types'

interface FlashcardsDueBannerProps {
  flashcards: FlashcardItem[]
  onReview: () => void
}

export function FlashcardsDueBanner({ flashcards, onReview }: FlashcardsDueBannerProps) {
  const dueCount = countDueFlashcards(flashcards)
  if (dueCount <= 0) return null

  const label = dueCount === 1 ? '1 card due' : `${dueCount} cards due`

  return (
    <div
      className="banner-accent mb-4 flex items-center justify-between gap-3 border border-accent-purple/25 bg-accent-purple/10 py-3 pr-4 pl-4"
      style={{ '--banner-accent': 'var(--color-accent-purple)' } as CSSProperties}
    >
      <div className="flex items-center gap-2.5 min-w-0">
        <div className="banner-icon-well">
          <Layers className="h-4 w-4 text-accent-purple shrink-0" aria-hidden />
        </div>
        <p className="text-label font-semibold text-primary truncate">{label} — review your recall deck</p>
      </div>
      <Button variant="secondary" size="sm" onClick={onReview} className="shrink-0">
        Review
      </Button>
    </div>
  )
}
