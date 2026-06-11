import type { ReactNode } from 'react'

const SHELL_CLASS = 'grid grid-cols-1 lg:grid-cols-12 gap-6 w-full flex-1 items-start min-h-0'

interface TabPageShellProps {
  children: ReactNode
  className?: string
}

export function TabPageShell({ children, className = '' }: TabPageShellProps) {
  return (
    <div className={`tab-page-shell ${SHELL_CLASS} ${className}`.trim()}>
      {children}
    </div>
  )
}

export function TabSectionLabel({ children }: { children: ReactNode }) {
  return (
    <p className="text-label font-bold uppercase tracking-wider settings-muted select-none">
      {children}
    </p>
  )
}

interface TabSectionProps {
  label: string
  children: ReactNode
  className?: string
}

export function TabSection({ label, children, className = '' }: TabSectionProps) {
  return (
    <div className={`lg:col-span-12 flex flex-col gap-4 ${className}`.trim()}>
      <TabSectionLabel>{label}</TabSectionLabel>
      {children}
    </div>
  )
}
