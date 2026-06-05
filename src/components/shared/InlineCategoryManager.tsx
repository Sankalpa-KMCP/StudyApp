import { useState } from 'react'
import type { CategoryItem } from '../../db/types'

interface InlineCategoryManagerProps {
  categories: CategoryItem[]
  addCategory: (name: string, color: string) => Promise<void> | void
  deleteCategory: (id: number) => Promise<void> | void
  selectedCategoryId?: number
  onSelectCategory?: (id: number | undefined) => void
  showSelector?: boolean
  label?: string
}

export function InlineCategoryManager({
  categories,
  addCategory,
  deleteCategory,
  selectedCategoryId,
  onSelectCategory,
  showSelector = true,
  label = 'Category',
}: InlineCategoryManagerProps) {
  const [showManager, setShowManager] = useState(false)
  const [inlineName, setInlineName] = useState('')
  const [inlineColor, setInlineColor] = useState('#3B82F6')

  return (
    <div>
      <div className="flex justify-between items-center mb-1.5 select-none">
        <label className="text-[10px] font-bold uppercase text-white/45">{label}</label>
        <button
          type="button"
          onClick={() => setShowManager(!showManager)}
          className="text-[9px] font-bold text-accent-blue hover:underline cursor-pointer"
        >
          {showManager ? 'Done' : '✏️ Manage'}
        </button>
      </div>

      {showManager ? (
        <div className="space-y-2.5 bg-black/20 border border-white/5 p-3 rounded-2xl animate-fade-in mb-2">
          <div className="flex gap-2">
            <input
              type="text"
              value={inlineName}
              onChange={e => setInlineName(e.target.value)}
              placeholder="New category label..."
              className="flex-1 rounded-full bg-white/5 border border-white/8 px-3 py-1.5 text-xs text-white placeholder-white/20 outline-none"
            />
            <input
              type="color"
              value={inlineColor}
              onChange={e => setInlineColor(e.target.value)}
              className="h-7 w-7 shrink-0 cursor-pointer rounded-full border border-white/10 bg-[#0c0f17] p-0.5"
            />
            <button
              type="button"
              onClick={async () => {
                const name = inlineName.trim()
                if (name) {
                  await addCategory(name, inlineColor)
                  setInlineName('')
                }
              }}
              className="px-3 rounded-full bg-accent-blue text-white text-xs font-bold transition-all ios-active-scale cursor-pointer"
            >
              Add
            </button>
          </div>
          <div className="max-h-24 overflow-y-auto custom-scrollbar space-y-1.5 pr-1 border-t border-white/5 pt-2">
            {categories.map(c => (
              <div key={c.id} className="flex items-center justify-between text-[10px] font-semibold bg-white/5 px-2.5 py-1.5 rounded-lg">
                <div className="flex items-center gap-1.5 truncate">
                  <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: c.color }} />
                  <span className="text-white/80 truncate">{c.name}</span>
                </div>
                <button
                  type="button"
                  onClick={async () => {
                    if (c.id !== undefined) await deleteCategory(c.id)
                  }}
                  className="text-white/40 hover:text-red-400 font-bold transition-colors cursor-pointer"
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
          className="w-full rounded-full border border-white/8 bg-white/4 px-4 py-2.5 text-xs text-white outline-none transition-all focus:bg-white/8 focus:border-accent-blue/30 cursor-pointer"
        >
          <option value="" className="bg-[#0b0c10] text-white/45">Uncategorized</option>
          {categories.map(c => (
            <option key={c.id} value={c.id} className="bg-[#0b0c10] text-white">
              {c.name}
            </option>
          ))}
        </select>
      ) : null}
    </div>
  )
}
