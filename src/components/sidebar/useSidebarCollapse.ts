import { useCallback, useEffect, useRef, useState } from 'react'
import { SIDEBAR_COLLAPSED_KEY } from './constants'

const TRANSITION_FADE_MS = 80
const TRANSITION_REVEAL_MS = 180

export function useSidebarCollapse() {
  const [collapsed, setCollapsed] = useState(
    () => typeof window !== 'undefined' && localStorage.getItem(SIDEBAR_COLLAPSED_KEY) === 'true',
  )
  const [transitioning, setTransitioning] = useState(false)
  const timeoutsRef = useRef<number[]>([])

  useEffect(() => {
    return () => {
      for (const id of timeoutsRef.current) {
        window.clearTimeout(id)
      }
      timeoutsRef.current = []
    }
  }, [])

  const toggleCollapsed = useCallback(() => {
    setTransitioning(true)
    const fadeId = window.setTimeout(() => {
      setCollapsed(prev => {
        const next = !prev
        localStorage.setItem(SIDEBAR_COLLAPSED_KEY, String(next))
        return next
      })
      const revealId = window.setTimeout(() => setTransitioning(false), TRANSITION_REVEAL_MS)
      timeoutsRef.current.push(revealId)
    }, TRANSITION_FADE_MS)
    timeoutsRef.current.push(fadeId)
  }, [])

  return { collapsed, transitioning, toggleCollapsed }
}
