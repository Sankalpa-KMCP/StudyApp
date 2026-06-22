import { useEffect, useRef } from 'react'
import type { ActiveTab } from '../../types/app'
import { readAppHashFromLocation, writeAppHash, resolveAppHash } from '../../lib/routing/appHashRouting'
import { setActiveTabSync } from '../../lib/routing/activeTabSync'

export interface ActiveTabSyncOptions {
  activeTab: ActiveTab
  navigateToTab: (tab: ActiveTab) => void | Promise<void>
}

export function useActiveTabSync({ activeTab, navigateToTab }: ActiveTabSyncOptions) {
  const activeTabRef = useRef(activeTab)

  useEffect(() => {
    activeTabRef.current = activeTab
  }, [activeTab])

  useEffect(() => {
    setActiveTabSync(activeTab)
    writeAppHash(activeTab)
  }, [activeTab])

  useEffect(() => {
    const onHashChange = () => {
      const { tab } = readAppHashFromLocation()
      const resolved = resolveAppHash(tab)
      if (resolved !== tab) {
        writeAppHash(resolved)
      }
      if (resolved === activeTabRef.current) return
      void navigateToTab(resolved).then(() => {
        if (activeTabRef.current !== resolved) {
          writeAppHash(activeTabRef.current)
        }
      })
    }
    window.addEventListener('hashchange', onHashChange)
    return () => window.removeEventListener('hashchange', onHashChange)
  }, [navigateToTab])
}
