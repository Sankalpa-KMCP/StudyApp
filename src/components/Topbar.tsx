import { Search, X, Bell, CircleUserRound } from './icons'
import type { View } from '../App'
import { useCallback, useEffect, useId, useRef, useState } from 'react'
import { QuickAddMenu, type QuickAddItem } from './QuickAddMenu'
import { GlobalSearchResults } from './GlobalSearchResults'
import type { SearchResult } from '../appUtils'

export function Topbar(props: {
  activeView: View
  search: string
  searchResults: SearchResult[]
  searchEnabled?: boolean
  noticeOpen: boolean
  noticePopoverId: string
  onSearch: (value: string) => void
  onClearSearch: () => void
  onSelectSearchResult: (result: SearchResult) => void
  onToggleNotices: () => void
  onCloseNotices: () => void
  onOpenProfile: () => void
  onQuickAdd: (item: QuickAddItem) => void
}) {
  const searchEnabled = props.searchEnabled !== false
  const searchInputRef = useRef<HTMLInputElement>(null)
  const noticeTriggerRef = useRef<HTMLButtonElement>(null)
  const searchRootRef = useRef<HTMLDivElement>(null)
  const listboxId = useId()
  const [quickAddOpen, setQuickAddOpen] = useState(false)
  const [resultsOpen, setResultsOpen] = useState(false)
  const [activeIndex, setActiveIndex] = useState(0)
  const [viewSnapshot, setViewSnapshot] = useState(props.activeView)
  const { onClearSearch, onCloseNotices, noticeOpen, onToggleNotices, search, searchResults } = props
  const hasQuery = search.trim().length > 0
  const resultsIdentity = `${search}\0${searchResults.map((result) => `${result.type}:${result.id}`).join('\0')}`
  const [resultsIdentitySnapshot, setResultsIdentitySnapshot] = useState(resultsIdentity)

  if (viewSnapshot !== props.activeView) {
    setViewSnapshot(props.activeView)
    setResultsOpen(false)
    setActiveIndex(0)
  }

  if (resultsIdentitySnapshot !== resultsIdentity) {
    setResultsIdentitySnapshot(resultsIdentity)
    setActiveIndex(0)
  }

  const showResults = searchEnabled && resultsOpen && hasQuery && !noticeOpen && !quickAddOpen

  const closeResults = useCallback(() => {
    setResultsOpen(false)
    setActiveIndex(0)
  }, [])

  const openResultsIfQuery = useCallback(() => {
    if (!searchEnabled || !hasQuery || noticeOpen || quickAddOpen) return
    setResultsOpen(true)
  }, [hasQuery, noticeOpen, quickAddOpen, searchEnabled])

  const handleQuickAddOpenChange = useCallback((open: boolean) => {
    setQuickAddOpen(open)
    if (open) {
      onCloseNotices()
      setResultsOpen(false)
      setActiveIndex(0)
    }
  }, [onCloseNotices])

  useEffect(() => {
    const handleShortcut = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null
      const isTyping = target?.matches('input, textarea, select, [contenteditable="true"]')
      if (event.key === '/' && !isTyping) {
        event.preventDefault()
        if (!searchEnabled) return
        searchInputRef.current?.focus()
        if (hasQuery) setResultsOpen(true)
      }
      if (event.key === 'Escape' && !noticeOpen && !quickAddOpen && document.activeElement === searchInputRef.current) {
        if (resultsOpen) {
          event.preventDefault()
          closeResults()
          return
        }
        onClearSearch()
        searchInputRef.current?.blur()
      }
    }
    window.addEventListener('keydown', handleShortcut)
    return () => window.removeEventListener('keydown', handleShortcut)
  }, [closeResults, hasQuery, noticeOpen, onClearSearch, quickAddOpen, resultsOpen, searchEnabled])

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

  useEffect(() => {
    if (!showResults) return

    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target as Node | null
      if (target && searchRootRef.current?.contains(target)) return
      closeResults()
    }

    document.addEventListener('pointerdown', handlePointerDown)
    return () => document.removeEventListener('pointerdown', handlePointerDown)
  }, [closeResults, showResults])

  const selectResult = (result: SearchResult) => {
    closeResults()
    props.onSelectSearchResult(result)
  }

  const moveActive = (delta: number) => {
    if (searchResults.length === 0) return
    setActiveIndex((current) => {
      const next = current + delta
      if (next < 0) return searchResults.length - 1
      if (next >= searchResults.length) return 0
      return next
    })
  }

  const activeOptionId = showResults && searchResults.length > 0
    ? `${listboxId}-option-${activeIndex}`
    : undefined

  return (
    <header className="topbar">
      <p className="topbar-title">{props.activeView === 'Home' ? 'Dashboard' : props.activeView}</p>
      <div className="topbar-actions">
        <div className="global-search" ref={searchRootRef}>
          <label className="search-field">
            <Search size={17} aria-hidden="true" />
            <span className="sr-only">Search</span>
            <input
              ref={searchInputRef}
              value={props.search}
              placeholder="Search"
              disabled={!searchEnabled}
              role="combobox"
              aria-expanded={showResults}
              aria-controls={listboxId}
              aria-haspopup="listbox"
              aria-autocomplete="list"
              aria-activedescendant={activeOptionId}
              aria-disabled={!searchEnabled || undefined}
              onFocus={() => openResultsIfQuery()}
              onBlur={(event) => {
                const next = event.relatedTarget as Node | null
                if (next && searchRootRef.current?.contains(next)) return
                closeResults()
              }}
              onChange={(event) => {
                props.onSearch(event.target.value)
                if (event.target.value.trim()) setResultsOpen(true)
                else closeResults()
              }}
              onKeyDown={(event) => {
                if (!showResults && (event.key === 'ArrowDown' || event.key === 'ArrowUp') && hasQuery) {
                  event.preventDefault()
                  setResultsOpen(true)
                  return
                }
                if (!showResults) return
                if (event.key === 'ArrowDown') {
                  event.preventDefault()
                  moveActive(1)
                } else if (event.key === 'ArrowUp') {
                  event.preventDefault()
                  moveActive(-1)
                } else if (event.key === 'Home' && searchResults.length > 0) {
                  event.preventDefault()
                  setActiveIndex(0)
                } else if (event.key === 'End' && searchResults.length > 0) {
                  event.preventDefault()
                  setActiveIndex(searchResults.length - 1)
                } else if (event.key === 'Enter' && searchResults.length > 0) {
                  event.preventDefault()
                  const result = searchResults[activeIndex]
                  if (result) selectResult(result)
                }
              }}
            />
            {props.search ? (
              <button
                className="clear-button"
                type="button"
                aria-label="Clear search"
                disabled={!searchEnabled}
                onClick={() => {
                  onClearSearch()
                  closeResults()
                  searchInputRef.current?.focus()
                }}
              >
                <X size={14} aria-hidden="true" />
              </button>
            ) : <kbd className="search-shortcut" aria-hidden="true">/</kbd>}
          </label>
          {showResults ? (
            <GlobalSearchResults
              id={listboxId}
              query={search}
              results={searchResults}
              activeIndex={activeIndex}
              onHoverIndex={setActiveIndex}
              onSelect={selectResult}
            />
          ) : null}
        </div>
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
            closeResults()
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
            closeResults()
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
