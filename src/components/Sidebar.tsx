import { Home, Check, FileText, BookOpen, CalendarDays, NotebookText, TrendingUp, Target, PanelLeftOpen, PanelLeftClose, Settings, type AppIcon } from './icons'
import type { View } from '../App'

const navItems: Array<{ label: View; icon: AppIcon }> = [
  { label: 'Home', icon: Home },
  { label: 'Tasks', icon: Check },
  { label: 'Notes', icon: FileText },
  { label: 'Subjects', icon: BookOpen },
  { label: 'Calendar', icon: CalendarDays },
  { label: 'Flashcards', icon: NotebookText },
  { label: 'Progress', icon: TrendingUp },
  { label: 'Goals', icon: Target },
]

export function Sidebar({
  activeView,
  collapsed,
  onNavigate,
  onToggleCollapsed,
}: {
  activeView: View
  collapsed: boolean
  onNavigate: (view: View) => void
  onToggleCollapsed: () => void
}) {
  return (
    <aside className="sidebar" aria-label="Main navigation">
      <div className="brand-row">
        <button className="brand-dot" type="button" aria-label="Go to dashboard" onClick={() => onNavigate('Home')}>
          <img src={`${import.meta.env.BASE_URL}brand-mark.svg`} alt="" />
        </button>
        <div className="brand-copy">
          <strong>Study room</strong>
          <span>Local · private · yours</span>
        </div>
        <button className="sidebar-toggle" type="button" aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'} aria-pressed={collapsed} onClick={onToggleCollapsed}>
          {collapsed ? <PanelLeftOpen size={18} aria-hidden="true" /> : <PanelLeftClose size={18} aria-hidden="true" />}
        </button>
      </div>
      <nav>
        {navItems.map(({ label, icon: Icon }) => (
          <button className={activeView === label ? 'nav-item is-active' : 'nav-item'} type="button" key={label} title={collapsed ? label : undefined} onClick={() => onNavigate(label)}>
            <Icon size={21} strokeWidth={1.8} aria-hidden="true" />
            <span>{label}</span>
          </button>
        ))}
      </nav>
      <div className="sidebar-footer">
        <button className={activeView === 'Settings' ? 'nav-item is-active' : 'nav-item'} type="button" title={collapsed ? 'Settings' : undefined} onClick={() => onNavigate('Settings')}>
          <Settings size={21} strokeWidth={1.8} aria-hidden="true" />
          <span>Settings</span>
        </button>
      </div>
    </aside>
  )
}
