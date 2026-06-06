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
      <p className="text-[10px] font-semibold text-white/55 uppercase tracking-wider mb-2.5">Track Mood</p>
      <div className="flex flex-wrap gap-2" role="group" aria-label="Track mood">
        {MOODS.map(m => {
          const isSelected = draftMood === m.value
          return (
            <button
              key={m.value}
              type="button"
              aria-pressed={isSelected}
              onClick={() => onSelect(m.value)}
              className={`flex items-center gap-1.5 rounded-full border px-4 py-1.5 text-xs font-semibold transition-all duration-200 cursor-pointer ios-active-scale ${
                isSelected
                  ? 'border-accent-blue/30 bg-accent-blue/15 text-accent-blue shadow-sm'
                  : 'border-white/8 bg-white/4 text-text-secondary hover:border-white/15 hover:text-text-primary hover:bg-white/8'
              }`}
            >
              <span>{m.emoji}</span>
              <span>{m.label}</span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
