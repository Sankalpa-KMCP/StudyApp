import { Button } from '../shared/Button'

interface MoodPickerProps {
  draftMood: string
  onSelect: (value: string) => void
}

const MOODS = [
  { label: 'Focused', emoji: '🧠', value: 'focused' },
  { label: 'Energetic', emoji: '⚡', value: 'energetic' },
  { label: 'Tired', emoji: '🥱', value: 'tired' },
  { label: 'Distracted', emoji: '🌪', value: 'distracted' },
]

export function MoodPicker({ draftMood, onSelect }: MoodPickerProps) {
  return (
    <div className="mb-5">
      <p className="text-caption font-semibold text-white/55 uppercase tracking-wider mb-2.5">How are you feeling?</p>
      <div className="flex flex-wrap gap-2" role="group" aria-label="Track mood">
        {MOODS.map(m => {
          const isSelected = draftMood === m.value
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
              <span>{m.emoji}</span>
              <span>{m.label}</span>
            </Button>
          )
        })}
      </div>
    </div>
  )
}
