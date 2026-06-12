import { useSyncExternalStore } from 'react'
import type { ActiveTab } from '../../types/app'

let activeTab: ActiveTab = 'focus'
const listeners = new Set<() => void>()

export function setActiveTabSync(tab: ActiveTab) {
  if (activeTab === tab) return
  activeTab = tab
  for (const listener of listeners) listener()
}

export function getActiveTabSync(): ActiveTab {
  return activeTab
}

export function useActiveTabSync(): ActiveTab {
  return useSyncExternalStore(
    onStoreChange => {
      listeners.add(onStoreChange)
      return () => listeners.delete(onStoreChange)
    },
    () => activeTab,
    () => activeTab,
  )
}
