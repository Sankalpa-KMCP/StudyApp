import { Brain, Zap, Moon, Wind } from 'lucide-react'

interface MoodPickerProps {
  draftMood: string
  onSelect: (value: string) => void
}

const MOODS = [
  { label: 'Focused', icon: Brain, value: 'focused' },
  { label: 'Energetic', icon: Zap, value: 'energetic' },
  { label: 'Tired', icon: Moon, value: 'tired' },
  { label: 'Distracted', icon: Wind, value: 'distracted' },
] as const

export function MoodPicker({ draftMood, onSelect }: MoodPickerProps) {
  return (
    <div className="mb-6">
      <p className="text-caption font-semibold text-muted uppercase tracking-wider mb-3 select-none">How are you feeling?</p>
      <div className="mood-picker-container" role="group" aria-label="Track mood">
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
              <span>{m.label}</span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
