import type { ActiveTab } from '../../types/app'

const prefetched = new Set<ActiveTab>()

const TAB_IMPORTS: Record<Exclude<ActiveTab, 'focus'>, () => Promise<unknown>> = {
  analytics: () => import('../../components/AnalyticsStudio'),
  journal: () => import('../../components/ActivityLedger'),
  settings: () => import('../../components/ControlDeck'),
}

/** Warm a lazy tab chunk on idle or nav hover. */
export function prefetchTabChunk(tab: ActiveTab) {
  if (tab === 'focus' || prefetched.has(tab)) return
  prefetched.add(tab)
  void TAB_IMPORTS[tab]()
}

/** @deprecated Use prefetchTabChunk('settings') */
export function prefetchControlDeck() {
  prefetchTabChunk('settings')
}

export function prefetchIdleTabChunks() {
  const tabs: Exclude<ActiveTab, 'focus'>[] = ['analytics', 'journal', 'settings']
  for (const tab of tabs) {
    prefetchTabChunk(tab)
  }
}
