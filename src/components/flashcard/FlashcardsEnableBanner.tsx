import { useState, type CSSProperties } from 'react'
import { Layers } from 'lucide-react'
import { Button } from '../shared/Button'

const DISMISS_KEY = 'flashcards_enable_banner_dismissed'

interface FlashcardsEnableBannerProps {
  onEnable: () => void
}

export function FlashcardsEnableBanner({ onEnable }: FlashcardsEnableBannerProps) {
  const [dismissed, setDismissed] = useState(
    () => typeof window !== 'undefined' && !!localStorage.getItem(DISMISS_KEY),
  )

  if (dismissed) return null

  const handleDismiss = () => {
    localStorage.setItem(DISMISS_KEY, 'true')
    setDismissed(true)
  }

  return (
    <div
      className="banner-accent mb-4 flex items-center justify-between gap-3 border border-accent-purple/20 bg-accent-purple/8 py-3 pr-4 pl-4"
      style={{ '--banner-accent': 'var(--color-accent-purple)' } as CSSProperties}
    >
      <div className="flex items-center gap-2.5 min-w-0">
        <div className="banner-icon-well">
          <Layers className="h-4 w-4 text-accent-purple shrink-0" aria-hidden />
        </div>
        <p className="text-label font-semibold text-primary truncate">
          Optional recall deck — spaced repetition flashcards
        </p>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <Button variant="secondary" size="sm" onClick={onEnable}>
          Enable in Settings
        </Button>
        <button
          type="button"
          onClick={handleDismiss}
          className="text-micro font-semibold settings-muted hover:text-[var(--color-text-primary)] transition-colors px-1"
        >
          Dismiss
        </button>
      </div>
    </div>
  )
}
