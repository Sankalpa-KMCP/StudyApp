import { useId, type ReactNode } from 'react'

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

export function TabSectionLabel({ children, id }: { children: ReactNode; id?: string }) {
  return (
    <h2 id={id} className="panel-title select-none">
      {children}
    </h2>
  )
}

interface TabSectionProps {
  label: string
  children: ReactNode
  className?: string
}

export function TabSection({ label, children, className = '' }: TabSectionProps) {
  const labelId = useId()

  return (
    <section
      aria-labelledby={labelId}
      className={`lg:col-span-12 flex flex-col gap-4 ${className}`.trim()}
    >
      <TabSectionLabel id={labelId}>{label}</TabSectionLabel>
      {children}
    </section>
  )
}
