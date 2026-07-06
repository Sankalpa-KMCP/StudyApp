import { Search, X, Bell, CircleUserRound } from 'lucide-react'
import type { View } from '../App'

export function Topbar(props: {
  activeView: View
  search: string
  noticeOpen: boolean
  onSearch: (value: string) => void
  onClearSearch: () => void
  onToggleNotices: () => void
  onOpenProfile: () => void
}) {
  return (
    <header className="topbar">
      <h2>{props.activeView === 'Home' ? 'Dashboard' : props.activeView}</h2>
      <div className="topbar-actions">
        <label className="search-field">
          <Search size={17} aria-hidden="true" />
          <span className="sr-only">Search</span>
          <input value={props.search} placeholder="Search" onChange={(event) => props.onSearch(event.target.value)} />
          {props.search ? (
            <button className="clear-button" type="button" aria-label="Clear search" onClick={props.onClearSearch}>
              <X size={14} aria-hidden="true" />
            </button>
          ) : null}
        </label>
        <button className={props.noticeOpen ? 'icon-button is-active' : 'icon-button'} type="button" aria-label="Notifications" onClick={props.onToggleNotices}>
          <Bell size={20} aria-hidden="true" />
        </button>
        <button className="avatar-button" type="button" aria-label="Profile" onClick={props.onOpenProfile}>
          <CircleUserRound size={21} aria-hidden="true" />
        </button>
      </div>
    </header>
  )
}
