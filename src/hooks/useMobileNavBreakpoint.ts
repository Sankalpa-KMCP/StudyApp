import { useEffect, useState } from 'react'
import { MOBILE_NAV_MAX_WIDTH_QUERY } from '../navigation/navDestinations'

/**
 * Tracks whether the dedicated mobile bottom navigation should replace the desktop Sidebar.
 * Keep the query string aligned with `src/styles/responsive.css` (`max-width: 760px`).
 */
export function useMobileNavBreakpoint(query: string = MOBILE_NAV_MAX_WIDTH_QUERY): boolean {
  const [matches, setMatches] = useState(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false
    return window.matchMedia(query).matches
  })

  useEffect(() => {
    if (typeof window.matchMedia !== 'function') return
    const media = window.matchMedia(query)
    const sync = () => setMatches(media.matches)
    sync()
    media.addEventListener('change', sync)
    return () => media.removeEventListener('change', sync)
  }, [query])

  return matches
}
