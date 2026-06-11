interface RangeSettingProps {
  label: string
  value: number
  min: number
  max: number
  step?: number
  unit?: string
  onChange: (value: number) => void
}

export function RangeSetting({ label, value, min, max, step = 1, unit = '', onChange }: RangeSettingProps) {
  return (
    <div className="space-y-2">
      <div className="flex justify-between items-center settings-label">
        <span>{label}</span>
        <span className="font-mono text-[var(--color-text-primary)] bg-[color-mix(in_srgb,var(--color-surface-card)_80%,transparent)] border border-[var(--color-border-card)] rounded-full px-2 py-0.5 text-label">{value}{unit}</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={e => onChange(parseFloat(e.target.value))}
        className="w-full accent-accent-blue"
      />
    </div>
  )
}
