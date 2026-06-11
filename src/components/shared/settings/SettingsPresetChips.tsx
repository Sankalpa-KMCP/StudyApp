import { SelectionChip } from '../SelectionChip'

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
      {presets.map(({ value, label }) => (
        <SelectionChip
          key={value}
          selected={activeValue === value}
          accent="blue"
          size="sm"
          onClick={() => onSelect(value)}
        >
          {label ?? `${value}${unit}`}
        </SelectionChip>
      ))}
    </div>
  )
}
