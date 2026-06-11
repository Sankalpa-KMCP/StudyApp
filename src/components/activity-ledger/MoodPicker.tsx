import { Brain, Zap, Moon, Wind } from 'lucide-react'
import { Button } from '../shared/Button'

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
    <div className="mb-5">
      <p className="text-caption font-semibold text-muted uppercase tracking-wider mb-2.5">How are you feeling?</p>
      <div className="flex flex-wrap gap-2" role="group" aria-label="Track mood">
        {MOODS.map(m => {
          const isSelected = draftMood === m.value
          const Icon = m.icon
          return (
            <Button
              key={m.value}
              type="button"
              variant={isSelected ? 'primary' : 'ghost'}
              size="sm"
              aria-pressed={isSelected}
              onClick={() => onSelect(m.value)}
              className={`gap-1.5 px-4 py-2 ${isSelected ? '' : 'border border-white/8'}`}
            >
              <Icon className="h-3.5 w-3.5" aria-hidden />
              <span>{m.label}</span>
            </Button>
          )
        })}
      </div>
    </div>
  )
}
