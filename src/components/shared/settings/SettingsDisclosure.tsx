import { useState, type ReactNode } from 'react'
import { ChevronDown } from 'lucide-react'

interface SettingsDisclosureProps {
  title: string
  children: ReactNode
  defaultOpen?: boolean
  id?: string
}

/** Collapsible wrapper for settings panel groups. Prefer SettingsCard defaultCollapsed for single cards. */
export function SettingsDisclosure({
  title,
  children,
  defaultOpen = false,
  id,
}: SettingsDisclosureProps) {
  const [open, setOpen] = useState(defaultOpen)

  return (
    <div id={id} className="flex flex-col gap-4">
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        aria-expanded={open}
        className="flex items-center justify-between gap-3 rounded-xl border border-[var(--color-border-card)] bg-[color-mix(in_srgb,var(--color-surface-card)_40%,transparent)] px-4 py-3 text-left transition-all ios-active-scale hover:bg-[color-mix(in_srgb,var(--color-surface-card)_55%,transparent)]"
      >
        <span className="text-xs font-semibold text-[var(--color-text-primary)]">{title}</span>
        <ChevronDown
          className={`h-4 w-4 shrink-0 settings-muted transition-transform ${open ? 'rotate-180' : ''}`}
          aria-hidden
        />
      </button>
      {open && <div className="flex flex-col gap-4">{children}</div>}
    </div>
  )
}
