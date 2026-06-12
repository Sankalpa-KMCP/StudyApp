import { useState } from 'react'
import { useDebouncedCallback } from '../../../hooks/useDebouncedCallback'

interface RangeSettingProps {
  label: string
  value: number
  min: number
  max: number
  step?: number
  unit?: string
  onChange: (value: number) => void
  debounceMs?: number
  commitOnRelease?: boolean
}

export function RangeSetting({
  label,
  value,
  min,
  max,
  step = 1,
  unit = '',
  onChange,
  debounceMs = 300,
  commitOnRelease = true,
}: RangeSettingProps) {
  const [prevValue, setPrevValue] = useState(value)
  const [localValue, setLocalValue] = useState(value)

  if (value !== prevValue) {
    setPrevValue(value)
    setLocalValue(value)
  }

  const debouncedCommit = useDebouncedCallback((next: number) => {
    onChange(next)
  }, debounceMs)

  const handleChange = (next: number) => {
    setLocalValue(next)
    debouncedCommit(next)
  }

  const handleRelease = () => {
    if (!commitOnRelease) return
    debouncedCommit.flush()
    onChange(localValue)
  }

  return (
    <div className="space-y-2">
      <div className="flex justify-between items-center settings-label">
        <span>{label}</span>
        <span className="font-mono text-[var(--color-text-primary)] bg-[color-mix(in_srgb,var(--color-surface-card)_80%,transparent)] border border-[var(--color-border-card)] rounded-full px-2 py-0.5 text-label">{localValue}{unit}</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={localValue}
        onChange={e => handleChange(parseFloat(e.target.value))}
        onPointerUp={handleRelease}
        onKeyUp={handleRelease}
        className="w-full accent-accent-blue"
      />
    </div>
  )
}
