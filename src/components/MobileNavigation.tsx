import { useEffect, useId, useRef, useState } from 'react'
import {
  BookOpen,
  CalendarDays,
  Check,
  Ellipsis,
  FileText,
  Home,
  Settings,
  Target,
  TrendingUp,
  type AppIcon,
} from './icons'
import type { View } from '../navigation/viewRoutes'
import {
  isMobileMoreView,
  MOBILE_MORE_VIEWS,
  MOBILE_PRIMARY_VIEWS,
} from '../navigation/navDestinations'

const PRIMARY_ITEMS: ReadonlyArray<{ view: (typeof MOBILE_PRIMARY_VIEWS)[number]; Icon: AppIcon }> = [
  { view: 'Home', Icon: Home },
  { view: 'Tasks', Icon: Check },
  { view: 'Notes', Icon: FileText },
  { view: 'Progress', Icon: TrendingUp },
]

const MORE_ITEMS: ReadonlyArray<{ view: (typeof MOBILE_MORE_VIEWS)[number]; Icon: AppIcon }> = [
  { view: 'Subjects', Icon: BookOpen },
  { view: 'Calendar', Icon: CalendarDays },
  { view: 'Goals', Icon: Target },
  { view: 'Settings', Icon: Settings },
]

export function MobileNavigation({
  activeView,
  onNavigate,
}: {
  activeView: View
  onNavigate: (view: View) => void
}) {
  const [moreOpen, setMoreOpen] = useState(false)
  const [viewSnapshot, setViewSnapshot] = useState(activeView)
  const menuId = useId()
  const rootRef = useRef<HTMLElement>(null)
  const moreTriggerRef = useRef<HTMLButtonElement>(null)
  const itemRefs = useRef<Array<HTMLButtonElement | null>>([])
  const moreActive = isMobileMoreView(activeView)

  if (viewSnapshot !== activeView) {
    setViewSnapshot(activeView)
    if (moreOpen) setMoreOpen(false)
  }

  useEffect(() => {
    if (!moreOpen) return

    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target as Node | null
      if (target && rootRef.current?.contains(target)) return
      setMoreOpen(false)
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      event.preventDefault()
      event.stopPropagation()
      setMoreOpen(false)
      moreTriggerRef.current?.focus()
    }

    document.addEventListener('pointerdown', handlePointerDown)
    window.addEventListener('keydown', handleKeyDown, true)
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown)
      window.removeEventListener('keydown', handleKeyDown, true)
    }
  }, [moreOpen])

  useEffect(() => {
    if (!moreOpen) return
    itemRefs.current[0]?.focus()
  }, [moreOpen])

  const focusItem = (index: number) => {
    const count = MORE_ITEMS.length
    const next = ((index % count) + count) % count
    itemRefs.current[next]?.focus()
  }

  const selectDestination = (view: View) => {
    setMoreOpen(false)
    onNavigate(view)
  }

  return (
    <nav className="mobile-navigation" aria-label="Main navigation" ref={rootRef}>
      {PRIMARY_ITEMS.map(({ view, Icon }) => {
        const current = activeView === view
        return (
          <button
            key={view}
            className={current ? 'mobile-nav-item is-active' : 'mobile-nav-item'}
            type="button"
            aria-current={current ? 'page' : undefined}
            onClick={() => selectDestination(view)}
          >
            <Icon size={20} strokeWidth={1.8} aria-hidden="true" />
            <span>{view}</span>
          </button>
        )
      })}
      <div className="mobile-nav-more">
        <button
          ref={moreTriggerRef}
          className={moreOpen || moreActive ? 'mobile-nav-item is-active' : 'mobile-nav-item'}
          type="button"
          aria-label="More"
          aria-haspopup="menu"
          aria-expanded={moreOpen}
          aria-controls={menuId}
          onClick={() => setMoreOpen((open) => !open)}
        >
          <Ellipsis size={20} strokeWidth={1.8} aria-hidden="true" />
          <span>More</span>
        </button>
        {moreOpen ? (
          <div className="mobile-nav-more-menu" id={menuId} role="menu" aria-label="More destinations">
            {MORE_ITEMS.map(({ view, Icon }, index) => {
              const current = activeView === view
              return (
                <button
                  key={view}
                  ref={(node) => {
                    itemRefs.current[index] = node
                  }}
                  className={current ? 'mobile-nav-more-item is-active' : 'mobile-nav-more-item'}
                  type="button"
                  role="menuitem"
                  aria-current={current ? 'page' : undefined}
                  onClick={() => selectDestination(view)}
                  onKeyDown={(event) => {
                    if (event.key === 'ArrowDown') {
                      event.preventDefault()
                      focusItem(index + 1)
                    } else if (event.key === 'ArrowUp') {
                      event.preventDefault()
                      focusItem(index - 1)
                    } else if (event.key === 'Home') {
                      event.preventDefault()
                      focusItem(0)
                    } else if (event.key === 'End') {
                      event.preventDefault()
                      focusItem(MORE_ITEMS.length - 1)
                    }
                  }}
                >
                  <Icon size={18} strokeWidth={1.8} aria-hidden="true" />
                  <span>{view}</span>
                </button>
              )
            })}
          </div>
        ) : null}
      </div>
    </nav>
  )
}
