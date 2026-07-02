import { useState } from 'react'
import type { CategoryItem } from '../../db/types'

type RequestConfirm = (options: {
  title: string
  message: string
  confirmLabel?: string
  danger?: boolean
}) => Promise<boolean>

interface InlineCategoryManagerProps {
  categories: CategoryItem[]
  addCategory: (name: string, color: string) => Promise<number | void> | number | void
  deleteCategory: (id: number) => Promise<void> | void
  selectedCategoryId?: number
  onSelectCategory?: (id: number | undefined) => void
  showSelector?: boolean
  label?: string
  requestConfirm?: RequestConfirm
}

export function InlineCategoryManager({
  categories,
  addCategory,
  deleteCategory,
  selectedCategoryId,
  onSelectCategory,
  showSelector = true,
  label = 'Category',
  requestConfirm,
}: InlineCategoryManagerProps) {
  const [showManager, setShowManager] = useState(false)
  const [inlineName, setInlineName] = useState('')
  const [inlineColor, setInlineColor] = useState('#3B82F6')

  const handleDelete = async (c: CategoryItem) => {
    if (c.id === undefined) return
    if (requestConfirm) {
      const ok = await requestConfirm({
        title: `Delete "${c.name}"?`,
        message: 'Tasks linked to this category will keep their data but lose the category label.',
        confirmLabel: 'Delete',
        danger: true,
      })
      if (!ok) return
    }
    try {
      await deleteCategory(c.id)
    } catch {
      // last category — repo throws
    }
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-1.5 select-none">
        <label className="text-micro font-bold uppercase text-muted">{label}</label>
        <button
          type="button"
          onClick={() => setShowManager(!showManager)}
          className="text-micro font-bold text-accent-blue hover:underline cursor-pointer"
        >
          {showManager ? 'Done' : '✏️ Manage'}
        </button>
      </div>

      {showManager ? (
        <div className="space-y-2.5 surface-subtle border border-card p-3 rounded-2xl animate-fade-in mb-2">
          <div className="flex gap-2">
            <input
              type="text"
              value={inlineName}
              onChange={e => setInlineName(e.target.value)}
              placeholder="New category label..."
              className="flex-1 rounded-full surface-subtle border border-card px-3 py-1.5 text-xs text-primary placeholder:text-muted outline-none"
            />
            <input
              type="color"
              value={inlineColor}
              onChange={e => setInlineColor(e.target.value)}
              className="h-7 w-7 shrink-0 cursor-pointer rounded-full border border-card surface-subtle p-0.5"
            />
            <button
              type="button"
              onClick={async () => {
                const name = inlineName.trim()
                if (name) {
                  const newId = await addCategory(name, inlineColor)
                  setInlineName('')
                  if (typeof newId === 'number' && onSelectCategory) {
                    onSelectCategory(newId)
                  }
                }
              }}
              className="px-3 rounded-full bg-accent-blue text-on-accent text-xs font-bold transition-all ios-active-scale cursor-pointer"
            >
              Add
            </button>
          </div>
          <div className="max-h-24 overflow-y-auto custom-scrollbar space-y-1.5 pr-1 border-t border-card pt-2">
            {categories.map(c => (
              <div key={c.id} className="flex items-center justify-between text-micro font-semibold surface-subtle px-2.5 py-1.5 rounded-lg">
                <div className="flex items-center gap-1.5 truncate">
                  <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: c.color }} />
                  <span className="text-secondary truncate">{c.name}</span>
                </div>
                <button
                  type="button"
                  onClick={() => void handleDelete(c)}
                  aria-label={`Delete category ${c.name}`}
                  className="text-muted hover:text-red-400 font-bold transition-colors cursor-pointer"
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
        </div>
      ) : showSelector && onSelectCategory ? (
        <select
          value={selectedCategoryId ?? ''}
          onChange={e => onSelectCategory(e.target.value ? parseInt(e.target.value) : undefined)}
          className="w-full rounded-full border border-card surface-subtle px-4 py-2.5 text-xs text-primary outline-none transition-all focus:border-accent-blue/30 cursor-pointer settings-input"
        >
          <option value="">Uncategorized</option>
          {categories.map(c => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      ) : null}
    </div>
  )
}
