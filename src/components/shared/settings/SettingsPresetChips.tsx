interface PresetChip {
  value: number
  label?: string
}

interface SettingsPresetChipsProps {
  presets: PresetChip[]
  activeValue: number
  onSelect: (value: number) => void
  unit?: string
  className?: string
}

export function SettingsPresetChips({
  presets,
  activeValue,
  onSelect,
  unit = 'm',
  className = '',
}: SettingsPresetChipsProps) {
  return (
    <div className={`flex flex-wrap gap-1.5 ${className}`.trim()}>
      {presets.map(({ value, label }) => {
        const isActive = activeValue === value
        return (
          <button
            key={value}
            type="button"
            onClick={() => onSelect(value)}
            className={`rounded-full px-2.5 py-1 text-micro font-semibold transition-all ios-active-scale border ${
              isActive
                ? 'bg-accent-blue/20 border-accent-blue/40 text-accent-blue'
                : 'bg-[color-mix(in_srgb,var(--color-surface-card)_60%,transparent)] border-[var(--color-border-card)] settings-muted hover:border-accent-blue/30'
            }`}
          >
            {label ?? `${value}${unit}`}
          </button>
        )
      })}
    </div>
  )
}
