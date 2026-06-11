import { lazy, Suspense } from 'react'
import { TabLoadingFallback } from '../shared/TabLoadingFallback'

const ControlDeck = lazy(() =>
  import('../ControlDeck').then(m => ({ default: m.ControlDeck })),
)

interface SettingsTabProps {
  onShowOnboarding?: () => void
}

export function SettingsTab({ onShowOnboarding }: SettingsTabProps) {
  return (
    <Suspense fallback={<TabLoadingFallback label="settings" />}>
      <ControlDeck onShowOnboarding={onShowOnboarding} />
    </Suspense>
  )
}
