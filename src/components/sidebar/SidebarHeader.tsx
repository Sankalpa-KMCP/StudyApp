import { Brain, ChevronLeft } from 'lucide-react'

interface SidebarHeaderProps {
  collapsed: boolean
  onToggleCollapse: () => void
}

export function SidebarHeader({ collapsed, onToggleCollapse }: SidebarHeaderProps) {
  if (collapsed) {
    return (
      <header className="grid justify-items-center gap-2 px-1 py-0.5 select-none">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[10px] bg-gradient-to-tr from-accent-blue to-accent-purple shadow-md shadow-accent-blue/10">
          <Brain className="h-5.5 w-5.5 text-white" />
        </div>
        <button
          type="button"
          onClick={onToggleCollapse}
          aria-label="Expand sidebar"
          title="Expand sidebar"
          className="sidebar-collapse-btn hidden md:flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/[0.04] text-white/50 hover:bg-white/[0.08] hover:text-white/80 transition-all cursor-pointer focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-blue"
        >
          <ChevronLeft className="sidebar-chevron h-4 w-4" />
        </button>
      </header>
    )
  }

  return (
    <div className="flex items-center gap-3 px-1 py-0.5 select-none">
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[10px] bg-gradient-to-tr from-accent-blue to-accent-purple shadow-md shadow-accent-blue/10">
        <Brain className="h-5.5 w-5.5 text-white" />
      </div>
      <div className="min-w-0 flex-1 overflow-hidden">
        <h1 className="text-sm font-bold text-white tracking-wide leading-none whitespace-nowrap">Study Dashboard</h1>
        <p className="text-caption text-white/50 font-medium mt-1.5 leading-none whitespace-nowrap">by Sankalpa KMCP</p>
      </div>
      <button
        type="button"
        onClick={onToggleCollapse}
        aria-label="Collapse sidebar"
        title="Collapse sidebar"
        className="sidebar-collapse-btn hidden md:flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/[0.04] text-white/50 hover:bg-white/[0.08] hover:text-white/80 transition-all cursor-pointer focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-blue"
      >
        <ChevronLeft className="sidebar-chevron sidebar-chevron--expanded h-4 w-4" />
      </button>
    </div>
  )
}
