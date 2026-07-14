import { Brain, Zap, Moon, Wind } from 'lucide-react'
import { useTranslation } from '../../i18n/useTranslation'
import type { TranslationKey } from '../../i18n'

interface MoodPickerProps {
  draftMood: string
  onSelect: (value: string) => void
}

const MOODS = [
  { labelKey: 'journalMoodFocused', icon: Brain, value: 'focused' },
  { labelKey: 'journalMoodEnergetic', icon: Zap, value: 'energetic' },
  { labelKey: 'journalMoodTired', icon: Moon, value: 'tired' },
  { labelKey: 'journalMoodDistracted', icon: Wind, value: 'distracted' },
] as const satisfies ReadonlyArray<{ labelKey: TranslationKey; icon: typeof Brain; value: string }>

export function MoodPicker({ draftMood, onSelect }: MoodPickerProps) {
  const { t } = useTranslation()

  return (
    <div className="mb-6">
      <p className="text-caption font-semibold text-muted uppercase tracking-wider mb-3 select-none">{t('journalMoodQuestion')}</p>
      <div className="mood-picker-container" role="group" aria-label={t('journalMoodAria')}>
        {MOODS.map(m => {
          const isSelected = draftMood === m.value
          const Icon = m.icon
          return (
            <button
              key={m.value}
              type="button"
              aria-pressed={isSelected}
              onClick={() => onSelect(m.value)}
              className={`mood-btn mood-${m.value} ${isSelected ? 'mood-active' : ''}`}
            >
              <div className="mood-icon-wrapper">
                <Icon className="h-5 w-5" aria-hidden />
              </div>
              <span>{t(m.labelKey)}</span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
