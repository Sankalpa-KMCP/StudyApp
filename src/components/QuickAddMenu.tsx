import { useEffect, useId, useRef } from 'react'
import { CalendarDays, Check, Clock3, FileText, Plus } from './icons'

export type QuickAddItem = 'task' | 'note' | 'event' | 'focus'

const QUICK_ADD_ITEMS: ReadonlyArray<{
  id: QuickAddItem
  label: string
  Icon: typeof Check
}> = [
  { id: 'task', label: 'Task', Icon: Check },
  { id: 'note', label: 'Note', Icon: FileText },
  { id: 'event', label: 'Event', Icon: CalendarDays },
  { id: 'focus', label: 'Focus session', Icon: Clock3 },
]

export function QuickAddMenu({
  open,
  onOpenChange,
  onSelect,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSelect: (item: QuickAddItem) => void
}) {
  const menuId = useId()
  const rootRef = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const itemRefs = useRef<Array<HTMLButtonElement | null>>([])

  useEffect(() => {
    if (!open) return

    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target as Node | null
      if (target && rootRef.current?.contains(target)) return
      onOpenChange(false)
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      event.preventDefault()
      event.stopPropagation()
      onOpenChange(false)
      triggerRef.current?.focus()
    }

    document.addEventListener('pointerdown', handlePointerDown)
    window.addEventListener('keydown', handleKeyDown, true)
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown)
      window.removeEventListener('keydown', handleKeyDown, true)
    }
  }, [open, onOpenChange])

  useEffect(() => {
    if (!open) return
    itemRefs.current[0]?.focus()
  }, [open])

  const focusItem = (index: number) => {
    const count = QUICK_ADD_ITEMS.length
    const next = ((index % count) + count) % count
    itemRefs.current[next]?.focus()
  }

  const activateItem = (item: QuickAddItem) => {
    onOpenChange(false)
    onSelect(item)
  }

  return (
    <div className="quick-add" ref={rootRef}>
      <button
        ref={triggerRef}
        className={open ? 'quick-add-trigger is-active' : 'quick-add-trigger'}
        type="button"
        aria-label="Quick add"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={menuId}
        onClick={() => onOpenChange(!open)}
      >
        <Plus size={18} aria-hidden="true" />
        <span className="quick-add-trigger-label">Add</span>
      </button>
      {open ? (
        <div className="quick-add-menu" id={menuId} role="menu" aria-label="Quick add">
          {QUICK_ADD_ITEMS.map((item, index) => {
            const Icon = item.Icon
            return (
              <button
                key={item.id}
                ref={(node) => {
                  itemRefs.current[index] = node
                }}
                className="quick-add-item"
                type="button"
                role="menuitem"
                onClick={() => activateItem(item.id)}
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
                    focusItem(QUICK_ADD_ITEMS.length - 1)
                  }
                }}
              >
                <Icon size={18} aria-hidden="true" />
                <span>{item.label}</span>
              </button>
            )
          })}
        </div>
      ) : null}
    </div>
  )
}
