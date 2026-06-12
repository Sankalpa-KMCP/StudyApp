import type { ReactNode } from 'react'
import { TabPageShell } from '../shared/TabPageShell'
import { SettingsSectionNav } from './SettingsSectionNav'

interface SettingsShellProps {
  banners?: ReactNode
  children: ReactNode
}

export function SettingsShell({ banners, children }: SettingsShellProps) {
  return (
    <TabPageShell>
      {banners && (
        <div className="lg:col-span-12 flex flex-col gap-4">
          {banners}
        </div>
      )}

      <div className="lg:col-span-12 lg:hidden">
        <SettingsSectionNav variant="pills" />
      </div>

      <div className="hidden lg:block lg:col-span-3">
        <div className="sticky top-4">
          <p className="settings-label mb-3 px-1">Sections</p>
          <SettingsSectionNav variant="sidebar" />
        </div>
      </div>

      <div className="lg:col-span-9 flex flex-col gap-10">
        {children}
      </div>
    </TabPageShell>
  )
}

interface SettingsSectionProps {
  id: string
  label: string
  children: ReactNode
  onResetDefaults?: () => void
}

export function SettingsSection({ id, label, children, onResetDefaults }: SettingsSectionProps) {
  return (
    <section
      id={`settings-${id}`}
      data-settings-section
      aria-labelledby={`nav-${id}`}
      className="flex flex-col gap-4 scroll-mt-4"
    >
      <div className="flex items-center justify-between gap-3 px-1">
        <h2 id={`heading-${id}`} className="text-sm font-bold tracking-wide text-[var(--color-text-primary)]">
          {label}
        </h2>
        {onResetDefaults && (
          <button
            type="button"
            onClick={onResetDefaults}
            className="text-micro font-semibold text-accent-blue hover:text-accent-blue/80 transition-colors ios-active-scale"
          >
            Reset section
          </button>
        )}
      </div>
      <div className="flex flex-col gap-4">
        {children}
      </div>
    </section>
  )
}
