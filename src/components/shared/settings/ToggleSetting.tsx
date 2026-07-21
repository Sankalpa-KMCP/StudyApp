import { useId } from 'react'

interface ToggleSettingProps {
  label: string
  description?: string
  checked: boolean
  onChange: (checked: boolean) => void
}

export function ToggleSetting({ label, description, checked, onChange }: ToggleSettingProps) {
  const labelId = useId()
  const descriptionId = useId()

  return (
    <div className="flex items-center justify-between gap-3 select-none">
      <div>
        <div id={labelId} className="settings-label">{label}</div>
        {description && (
          <div id={descriptionId} className="settings-muted mt-0.5">{description}</div>
        )}
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-labelledby={labelId}
        aria-describedby={description ? descriptionId : undefined}
        onClick={() => onChange(!checked)}
        className={`ios-switch ios-switch--blue focus-ring shrink-0 ${checked ? 'active' : ''}`}
      >
        <span className="ios-switch-thumb" />
      </button>
    </div>
  )
}
