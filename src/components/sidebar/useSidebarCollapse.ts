import { useState } from 'react'
import { SIDEBAR_COLLAPSED_KEY } from './constants'

export function useSidebarCollapse() {
  const [collapsed, setCollapsed] = useState(
    () => typeof window !== 'undefined' && localStorage.getItem(SIDEBAR_COLLAPSED_KEY) === 'true',
  )

  const toggleCollapsed = () => {
    setCollapsed(prev => {
      const next = !prev
      localStorage.setItem(SIDEBAR_COLLAPSED_KEY, String(next))
      return next
    })
  }

  return { collapsed, toggleCollapsed }
}
