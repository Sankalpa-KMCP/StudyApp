import type { ReactNode } from 'react'
import { PanelCard } from '../PanelCard'
import { PanelHeader } from '../PanelHeader'

interface SettingsCardProps {
  title: string
  children: ReactNode
  id?: string
}

export function SettingsCard({ title, children, id }: SettingsCardProps) {
  return (
    <PanelCard id={id}>
      <PanelHeader title={title} bordered={false} className="mb-3" />
      {children}
    </PanelCard>
  )
}
