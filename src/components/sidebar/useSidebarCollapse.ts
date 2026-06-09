import { useCallback, useState } from 'react'
import { SIDEBAR_COLLAPSED_KEY } from './constants'

const TRANSITION_FADE_MS = 80
const TRANSITION_REVEAL_MS = 180

export function useSidebarCollapse() {
  const [collapsed, setCollapsed] = useState(
    () => typeof window !== 'undefined' && localStorage.getItem(SIDEBAR_COLLAPSED_KEY) === 'true',
  )
  const [transitioning, setTransitioning] = useState(false)

  const toggleCollapsed = useCallback(() => {
    setTransitioning(true)
    window.setTimeout(() => {
      setCollapsed(prev => {
        const next = !prev
        localStorage.setItem(SIDEBAR_COLLAPSED_KEY, String(next))
        return next
      })
      window.setTimeout(() => setTransitioning(false), TRANSITION_REVEAL_MS)
    }, TRANSITION_FADE_MS)
  }, [])

  return { collapsed, transitioning, toggleCollapsed }
}
