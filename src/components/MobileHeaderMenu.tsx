import { useEffect, useRef, useState } from 'react'
import { MoreHorizontal, Search, Sparkles, Keyboard } from 'lucide-react'

interface MobileHeaderMenuProps {
  onShowOnboarding?: () => void
  onOpenHotkeys: () => void
  onOpenCommandPalette: () => void
}

export function MobileHeaderMenu({
  onShowOnboarding,
  onOpenHotkeys,
  onOpenCommandPalette,
}: MobileHeaderMenuProps) {
  const [open, setOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onPointerDown = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', onPointerDown)
    return () => document.removeEventListener('mousedown', onPointerDown)
  }, [open])

  const items = [
    onShowOnboarding && {
      label: 'Getting Started Tour',
      icon: Sparkles,
      onClick: () => {
        onShowOnboarding()
        setOpen(false)
      },
    },
    {
      label: 'Keyboard Shortcuts',
      icon: Keyboard,
      onClick: () => {
        onOpenHotkeys()
        setOpen(false)
      },
    },
    {
      label: 'Search app',
      icon: Search,
      onClick: () => {
        onOpenCommandPalette()
        setOpen(false)
      },
    },
  ].filter(Boolean) as Array<{
    label: string
    icon: typeof Sparkles
    onClick: () => void
  }>

  return (
    <div ref={menuRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        aria-label="More tools"
        aria-expanded={open}
        aria-haspopup="menu"
        className="flex h-8 w-8 items-center justify-center rounded-full surface-subtle border border-card text-muted hover:text-primary hover:surface-track transition-all ios-active-scale"
      >
        <MoreHorizontal className="h-4 w-4" />
      </button>
      {open && (
        <div
          role="menu"
          className="absolute right-0 top-full z-40 mt-1.5 min-w-[200px] rounded-2xl border border-card glass-panel shadow-2xl py-1.5 overflow-hidden"
        >
          {items.map(item => {
            const Icon = item.icon
            return (
              <button
                key={item.label}
                type="button"
                role="menuitem"
                onClick={item.onClick}
                className="flex w-full items-center gap-2.5 px-3.5 py-2.5 text-left text-label font-semibold text-primary hover:bg-white/5 transition-colors ios-active-scale"
              >
                <Icon className="h-4 w-4 text-accent-blue shrink-0" />
                <span className="flex-1">{item.label}</span>
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
