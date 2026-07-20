import { useId, useState, type ReactNode } from 'react'
import { ChevronDown } from 'lucide-react'
import { PanelCard } from '../PanelCard'
import { PanelHeader } from '../PanelHeader'

interface SettingsCardProps {
  title: string
  children: ReactNode
  id?: string
  description?: string
  defaultCollapsed?: boolean
  onResetDefaults?: () => void
}

export function SettingsCard({
  title,
  children,
  id,
  description,
  defaultCollapsed = false,
  onResetDefaults,
}: SettingsCardProps) {
  const [collapsed, setCollapsed] = useState(defaultCollapsed)
  const contentId = useId()

  const resetAction = onResetDefaults ? (
    <button
      type="button"
      onClick={onResetDefaults}
      aria-label={`Reset ${title} to defaults`}
      className="text-micro font-semibold text-accent-blue hover:text-accent-blue/80 transition-colors focus-ring ios-active-scale"
    >
      Reset
    </button>
  ) : undefined

  const collapseAction = defaultCollapsed ? (
    <button
      type="button"
      onClick={() => setCollapsed(c => !c)}
      aria-expanded={!collapsed}
      aria-controls={contentId}
      className="flex items-center gap-1 text-micro font-semibold settings-muted hover:text-primary transition-colors focus-ring ios-active-scale"
    >
      <ChevronDown aria-hidden className={`h-3.5 w-3.5 transition-transform ${collapsed ? '' : 'rotate-180'}`} />
      {collapsed ? 'Show' : 'Hide'}
    </button>
  ) : undefined

  const action = resetAction || collapseAction ? (
    <div className="flex items-center gap-3">
      {resetAction}
      {collapseAction}
    </div>
  ) : undefined

  return (
    <PanelCard id={id}>
      <PanelHeader title={title} bordered={false} className="mb-3" action={action} />
      {description && <p className="settings-muted leading-relaxed mb-3 -mt-1">{description}</p>}
      {!collapsed && (
        <div id={contentId}>
          {children}
        </div>
      )}
    </PanelCard>
  )
}
