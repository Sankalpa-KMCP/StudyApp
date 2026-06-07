import type { ReactNode } from 'react'
import { Card } from '../Card'

interface SettingsCardProps {
  title: string
  children: ReactNode
}

export function SettingsCard({ title, children }: SettingsCardProps) {
  return (
    <Card variant="default" padding="md">
      <h3 className="text-caption font-bold uppercase tracking-widest text-white/45 mb-3">{title}</h3>
      {children}
    </Card>
  )
}
