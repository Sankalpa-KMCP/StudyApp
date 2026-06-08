import { lazy, Suspense } from 'react'
import { TabLoadingFallback } from '../shared/TabLoadingFallback'

const FocusTabContent = lazy(() =>
  import('./FocusTabContent').then(m => ({ default: m.FocusTabContent }))
)

export function FocusTab() {
  return (
    <Suspense fallback={<TabLoadingFallback label="focus" />}>
      <FocusTabContent />
    </Suspense>
  )
}
