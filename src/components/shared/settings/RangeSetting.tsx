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
    <div className="space-y-1.5">
      <div className="flex justify-between text-[10px] font-semibold text-white/60">
        <span>{label}</span>
        <span className="font-mono text-white/80">{value}{unit}</span>
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
