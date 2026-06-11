interface ToggleSettingProps {
  label: string
  description?: string
  checked: boolean
  onChange: (checked: boolean) => void
}

export function ToggleSetting({ label, description, checked, onChange }: ToggleSettingProps) {
  return (
    <label className="flex items-center justify-between gap-3 cursor-pointer select-none">
      <div>
        <div className="settings-label">{label}</div>
        {description && <div className="settings-muted mt-0.5">{description}</div>}
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        onClick={() => onChange(!checked)}
        className={`relative h-6 w-11 rounded-full transition-colors ${checked ? 'bg-accent-blue' : 'bg-[color-mix(in_srgb,var(--color-text-primary)_15%,transparent)]'}`}
      >
        <span
          className={`absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-[var(--color-text-primary)] transition-transform ${checked ? 'translate-x-5 !bg-white' : ''}`}
        />
      </button>
    </label>
  )
}
