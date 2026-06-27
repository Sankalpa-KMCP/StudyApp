import { useId, useState } from 'react'
import { t } from '../../i18n'
import type { CategoryItem } from '../../db/types'
import { Button } from './Button'
import { DEFAULT_CATEGORY_COLOR } from '../../lib/shared/categoryConstants'

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
  const [inlineColor, setInlineColor] = useState(DEFAULT_CATEGORY_COLOR)
  const panelId = useId()

  const handleDelete = async (c: CategoryItem) => {
    if (c.id === undefined) return
    if (requestConfirm) {
      const ok = await requestConfirm({
        title: t('categoriesDeleteConfirmTitle', { name: c.name }),
        message: t('categoriesDeleteConfirmMessage'),
        confirmLabel: t('categoriesDeleteConfirmLabel'),
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
    <fieldset className="border-0 p-0 m-0 min-w-0">
      <div className="flex justify-between items-center mb-1.5 select-none">
        <legend className="text-micro font-bold uppercase text-muted">{label}</legend>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => setShowManager(!showManager)}
          aria-expanded={showManager}
          aria-controls={panelId}
          className="!px-0 !py-0 text-micro font-bold text-accent-blue hover:underline"
        >
          {showManager ? 'Done' : '✏️ Manage'}
        </Button>
      </div>

      {showManager ? (
        <div
          id={panelId}
          className="space-y-2.5 surface-subtle border border-card p-3 rounded-2xl animate-fade-in mb-2"
        >
          <div className="flex gap-2">
            <input
              type="text"
              value={inlineName}
              onChange={e => setInlineName(e.target.value)}
              placeholder="New category label..."
              className="settings-input flex-1 !rounded-full !py-1.5 !px-3 text-micro"
            />
            <input
              type="color"
              value={inlineColor}
              onChange={e => setInlineColor(e.target.value)}
              aria-label="Category color"
              className="h-7 w-7 shrink-0 cursor-pointer rounded-full border border-card surface-subtle p-0.5"
            />
            <Button
              type="button"
              variant="primary"
              size="sm"
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
            >
              Add
            </Button>
          </div>
          <div className="max-h-24 overflow-y-auto custom-scrollbar space-y-1.5 pr-1 border-t border-card pt-2">
            {categories.map(c => (
              <div key={c.id} className="flex items-center justify-between text-micro font-semibold surface-subtle px-2.5 py-1.5 rounded-lg">
                <div className="flex items-center gap-1.5 truncate">
                  <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: c.color }} />
                  <span className="text-secondary truncate">{c.name}</span>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => void handleDelete(c)}
                  aria-label={`Delete category ${c.name}`}
                  className="!px-1.5 !py-0.5 text-muted hover:text-danger font-bold"
                >
                  ✕
                </Button>
              </div>
            ))}
          </div>
        </div>
      ) : showSelector && onSelectCategory ? (
        <select
          value={selectedCategoryId ?? ''}
          onChange={e => onSelectCategory(e.target.value ? parseInt(e.target.value) : undefined)}
          className="settings-select text-micro"
        >
          <option value="">Uncategorized</option>
          {categories.map(c => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      ) : null}
    </fieldset>
  )
}
