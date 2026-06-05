import type { ReactNode } from 'react'

interface SettingsCardProps {
  title: string
  children: ReactNode
}

export function SettingsCard({ title, children }: SettingsCardProps) {
  return (
    <div className="rounded-2xl border border-white/8 bg-white/[0.03] p-4 backdrop-blur-md">
      <h3 className="text-[10px] font-bold uppercase tracking-widest text-white/45 mb-3">{title}</h3>
      {children}
    </div>
  )
}
