import { Search, X, Bell, CircleUserRound } from 'lucide-react'
import type { View } from '../App'
import { useEffect, useRef } from 'react'

export function Topbar(props: {
  activeView: View
  search: string
  noticeOpen: boolean
  onSearch: (value: string) => void
  onClearSearch: () => void
  onToggleNotices: () => void
  onOpenProfile: () => void
}) {
  const searchInputRef = useRef<HTMLInputElement>(null)
  const { onClearSearch } = props

  useEffect(() => {
    const handleShortcut = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null
      const isTyping = target?.matches('input, textarea, select, [contenteditable="true"]')
      if (event.key === '/' && !isTyping) {
        event.preventDefault()
        searchInputRef.current?.focus()
      }
      if (event.key === 'Escape' && document.activeElement === searchInputRef.current) {
        onClearSearch()
        searchInputRef.current?.blur()
      }
    }
    window.addEventListener('keydown', handleShortcut)
    return () => window.removeEventListener('keydown', handleShortcut)
  }, [onClearSearch])

  return (
    <header className="topbar">
      <p className="topbar-title">{props.activeView === 'Home' ? 'Dashboard' : props.activeView}</p>
      <div className="topbar-actions">
        <label className="search-field">
          <Search size={17} aria-hidden="true" />
          <span className="sr-only">Search</span>
          <input ref={searchInputRef} value={props.search} placeholder="Search" onChange={(event) => props.onSearch(event.target.value)} />
          {props.search ? (
            <button className="clear-button" type="button" aria-label="Clear search" onClick={props.onClearSearch}>
              <X size={14} aria-hidden="true" />
            </button>
          ) : <kbd className="search-shortcut" aria-hidden="true">/</kbd>}
        </label>
        <button className={props.noticeOpen ? 'icon-button is-active' : 'icon-button'} type="button" aria-label="Notifications" aria-expanded={props.noticeOpen} onClick={props.onToggleNotices}>
          <Bell size={20} aria-hidden="true" />
        </button>
        <button className="avatar-button" type="button" aria-label="Profile" onClick={props.onOpenProfile}>
          <CircleUserRound size={21} aria-hidden="true" />
        </button>
      </div>
    </header>
  )
}
