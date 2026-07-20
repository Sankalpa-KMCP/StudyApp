import { useEffect, useId, useRef, useState } from 'react'
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
  const triggerId = useId()
  const menuId = useId()

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

  useEffect(() => {
    if (!open) return
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
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
        id={triggerId}
        onClick={() => setOpen(v => !v)}
        aria-label="More tools"
        aria-expanded={open}
        aria-haspopup="menu"
        aria-controls={menuId}
        className="chrome-icon-btn chrome-icon-btn--sm"
      >
        <MoreHorizontal className="h-4 w-4" />
      </button>
      {open && (
        <div
          id={menuId}
          role="menu"
          aria-labelledby={triggerId}
          className="absolute right-0 top-full z-40 mt-1.5 min-w-[200px] rounded-2xl border border-card glass-panel shadow-2xl py-1.5 overflow-hidden animate-fade-in"
        >
          {items.map(item => {
            const Icon = item.icon
            return (
              <button
                key={item.label}
                type="button"
                role="menuitem"
                onClick={item.onClick}
                className="flex w-full items-center gap-2.5 px-3.5 py-2.5 text-left text-label font-semibold text-primary hover:surface-subtle transition-colors ios-active-scale focus-ring"
              >
                <Icon className="h-4 w-4 text-accent-blue shrink-0" aria-hidden />
                <span className="flex-1">{item.label}</span>
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
