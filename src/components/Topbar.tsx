import { Search, X, Bell, CircleUserRound } from './icons'
import type { View } from '../App'
import { useCallback, useEffect, useRef, useState } from 'react'
import { QuickAddMenu, type QuickAddItem } from './QuickAddMenu'

export function Topbar(props: {
  activeView: View
  search: string
  noticeOpen: boolean
  noticePopoverId: string
  onSearch: (value: string) => void
  onClearSearch: () => void
  onToggleNotices: () => void
  onCloseNotices: () => void
  onOpenProfile: () => void
  onQuickAdd: (item: QuickAddItem) => void
}) {
  const searchInputRef = useRef<HTMLInputElement>(null)
  const noticeTriggerRef = useRef<HTMLButtonElement>(null)
  const [quickAddOpen, setQuickAddOpen] = useState(false)
  const { onClearSearch, onCloseNotices, noticeOpen, onToggleNotices } = props

  const handleQuickAddOpenChange = useCallback((open: boolean) => {
    setQuickAddOpen(open)
    if (open) onCloseNotices()
  }, [onCloseNotices])

  useEffect(() => {
    const handleShortcut = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null
      const isTyping = target?.matches('input, textarea, select, [contenteditable="true"]')
      if (event.key === '/' && !isTyping) {
        event.preventDefault()
        searchInputRef.current?.focus()
      }
      if (event.key === 'Escape' && !noticeOpen && !quickAddOpen && document.activeElement === searchInputRef.current) {
        onClearSearch()
        searchInputRef.current?.blur()
      }
    }
    window.addEventListener('keydown', handleShortcut)
    return () => window.removeEventListener('keydown', handleShortcut)
  }, [onClearSearch, noticeOpen, quickAddOpen])

  useEffect(() => {
    if (!noticeOpen) return

    const handleNoticeEscape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      event.preventDefault()
      event.stopPropagation()
      onCloseNotices()
      noticeTriggerRef.current?.focus()
    }

    window.addEventListener('keydown', handleNoticeEscape, true)
    return () => window.removeEventListener('keydown', handleNoticeEscape, true)
  }, [noticeOpen, onCloseNotices])

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
        <QuickAddMenu
          open={quickAddOpen}
          onOpenChange={handleQuickAddOpenChange}
          onSelect={props.onQuickAdd}
        />
        <button
          ref={noticeTriggerRef}
          className={props.noticeOpen ? 'icon-button is-active' : 'icon-button'}
          type="button"
          aria-label="Notifications"
          aria-expanded={props.noticeOpen}
          aria-controls={props.noticePopoverId}
          onClick={() => {
            setQuickAddOpen(false)
            onToggleNotices()
          }}
        >
          <Bell size={20} aria-hidden="true" />
        </button>
        <button
          className="avatar-button"
          type="button"
          aria-label="Profile"
          onClick={() => {
            setQuickAddOpen(false)
            props.onOpenProfile()
          }}
        >
          <CircleUserRound size={21} aria-hidden="true" />
        </button>
      </div>
    </header>
  )
}

export type { QuickAddItem }
