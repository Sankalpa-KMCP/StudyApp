import { useId, useState, type ReactNode } from 'react'
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
  const contentId = useId()
  const headingId = useId()

  return (
    <div id={id} className="flex flex-col gap-4">
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        aria-expanded={open}
        aria-controls={contentId}
        className="flex items-center justify-between gap-3 rounded-xl border border-card bg-[color-mix(in_srgb,var(--color-surface-card)_40%,transparent)] px-4 py-3 text-left transition-all ios-active-scale focus-ring hover:bg-[color-mix(in_srgb,var(--color-surface-card)_55%,transparent)]"
      >
        <h3 id={headingId} className="text-xs font-semibold text-primary">{title}</h3>
        <ChevronDown
          className={`h-4 w-4 shrink-0 settings-muted transition-transform ${open ? 'rotate-180' : ''}`}
          aria-hidden
        />
      </button>
      {open && (
        <div id={contentId} aria-labelledby={headingId} className="flex flex-col gap-4">
          {children}
        </div>
      )}
    </div>
  )
}
