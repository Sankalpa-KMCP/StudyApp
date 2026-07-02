import { useState } from 'react'
import { X } from 'lucide-react'
import { useConfirm } from '../../context/useConfirm'
import { useSettingsPanel } from './SettingsPanelContext'
import { SettingsCard } from '../shared/settings/SettingsCard'

const SWATCH_COLORS = ['#3B82F6', '#8B5CF6', '#EC4899', '#EF4444', '#F59E0B', '#10B981', '#64748B']

function clampCategoryGoal(raw: number): number {
  const stepped = Math.round(raw / 15) * 15
  return Math.min(960, Math.max(15, stepped))
}

export function CategoriesPanel() {
  const { categories: catApi, pushToast } = useSettingsPanel()
  const { requestConfirm } = useConfirm()
  const { categories, addCategory, updateCategory, deleteCategory } = catApi

  const [newCategoryName, setNewCategoryName] = useState('')
  const [newCategoryColor, setNewCategoryColor] = useState('#3B82F6')
  const [newCategoryGoal, setNewCategoryGoal] = useState('')
  const [editingCategoryId, setEditingCategoryId] = useState<number | null>(null)
  const [editingCategoryName, setEditingCategoryName] = useState('')
  const [goalDrafts, setGoalDrafts] = useState<Record<number, string>>({})

  const handleAdd = async () => {
    const val = newCategoryName.trim()
    if (!val) return
    const goal = newCategoryGoal.trim() ? clampCategoryGoal(Number(newCategoryGoal)) : undefined
    await addCategory(val, newCategoryColor, goal)
    pushToast('SETTINGS', `Category "${val}" added`)
    setNewCategoryName('')
    setNewCategoryGoal('')
  }

  const commitGoal = (catId: number, raw: string) => {
    const trimmed = raw.trim()
    if (!trimmed) {
      void updateCategory(catId, { dailyGoalMinutes: undefined })
      return
    }
    const num = clampCategoryGoal(Number(trimmed))
    void updateCategory(catId, { dailyGoalMinutes: num })
    setGoalDrafts(prev => {
      const next = { ...prev }
      delete next[catId]
      return next
    })
  }

  const handleDelete = async (catId: number, name: string) => {
    const ok = await requestConfirm({
      title: `Delete "${name}"?`,
      message: 'Tasks linked to this category will keep their data but lose the category label.',
      confirmLabel: 'Delete',
      danger: true,
    })
    if (!ok) return
    try {
      await deleteCategory(catId)
      pushToast('SETTINGS', `Category "${name}" removed`)
    } catch {
      pushToast('SETTINGS', 'Cannot delete the last category')
    }
  }

  return (
    <SettingsCard id="settings-categories" title="Subject Categories" defaultCollapsed>
      <div className="flex gap-2 mb-4 settings-input border border-[var(--color-border-card)] p-2 rounded-full flex-wrap sm:flex-nowrap">
        <input
          id="category-name-input"
          value={newCategoryName}
          onChange={e => setNewCategoryName(e.target.value)}
          type="text"
          placeholder="Label (e.g. Science)"
          aria-label="Category name"
          className="flex-1 min-w-[120px] rounded-full bg-transparent px-3 py-1.5 text-xs outline-none transition-all"
          onKeyDown={e => { if (e.key === 'Enter') void handleAdd() }}
        />
        <input
          value={newCategoryGoal}
          onChange={e => setNewCategoryGoal(e.target.value)}
          type="number"
          min={15}
          max={960}
          step={15}
          placeholder="Goal (min)"
          aria-label="Category daily goal minutes"
          className="w-24 rounded-full bg-transparent px-3 py-1.5 text-xs outline-none transition-all"
        />
        <input
          type="color"
          value={newCategoryColor}
          onChange={e => setNewCategoryColor(e.target.value)}
          className="h-8 w-8 cursor-pointer rounded-full border border-[var(--color-border-card)] bg-transparent p-0.5"
        />
        <button
          type="button"
          onClick={() => void handleAdd()}
          className="rounded-full bg-accent-blue hover:bg-accent-blue/90 text-on-accent px-4 py-1.5 text-xs font-bold transition-all ios-active-scale cursor-pointer"
        >
          Add
        </button>
      </div>

      <div className="flex items-center gap-2.5 mb-4 px-2 select-none">
        <span className="settings-muted font-bold uppercase tracking-wider text-micro">Swatches:</span>
        <div className="flex flex-wrap gap-2">
          {SWATCH_COLORS.map(color => (
            <button
              key={color}
              type="button"
              onClick={() => setNewCategoryColor(color)}
              className={`h-5 w-5 rounded-full border cursor-pointer transition-all duration-200 hover:scale-110 ${
                newCategoryColor.toLowerCase() === color.toLowerCase()
                  ? 'border-[var(--color-text-primary)] scale-105 shadow-md'
                  : 'border-[var(--color-border-card)] hover:border-accent-blue/40'
              }`}
              style={{ backgroundColor: color }}
              title={color}
              aria-label={`Category color ${color}`}
            />
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto max-h-[260px] custom-scrollbar space-y-2 pr-1">
        {categories.length === 0 ? (
          <p className="text-xs italic settings-muted text-center py-4">No categories configured yet.</p>
        ) : (
          categories.map(cat => (
            <div
              key={cat.id}
              className="flex items-center gap-2.5 rounded-[16px] bg-[color-mix(in_srgb,var(--color-surface-card)_40%,transparent)] border border-[var(--color-border-card)] px-3.5 py-2.5"
            >
              <label className="relative h-3 w-3 shrink-0 cursor-pointer" title="Change category color">
                <span className="block h-3 w-3 rounded-full border border-[var(--color-border-card)]" style={{ backgroundColor: cat.color }} />
                <input
                  type="color"
                  value={cat.color}
                  onChange={e => {
                    if (cat.id === undefined) return
                    void updateCategory(cat.id, { color: e.target.value })
                  }}
                  className="absolute inset-0 opacity-0 cursor-pointer"
                  aria-label={`Color for ${cat.name}`}
                />
              </label>
              {editingCategoryId === cat.id ? (
                <input
                  type="text"
                  value={editingCategoryName}
                  onChange={e => setEditingCategoryName(e.target.value)}
                  onBlur={() => {
                    if (cat.id === undefined) return
                    const trimmed = editingCategoryName.trim()
                    if (trimmed && trimmed !== cat.name) {
                      void updateCategory(cat.id, { name: trimmed })
                    }
                    setEditingCategoryId(null)
                  }}
                  onKeyDown={e => {
                    if (e.key === 'Enter') (e.target as HTMLInputElement).blur()
                    if (e.key === 'Escape') setEditingCategoryId(null)
                  }}
                  ref={el => el?.focus()}
                  className="flex-1 min-w-0 rounded-lg settings-input px-2 py-1 text-xs"
                  aria-label={`Edit name for ${cat.name}`}
                />
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    if (cat.id === undefined) return
                    setEditingCategoryId(cat.id)
                    setEditingCategoryName(cat.name)
                  }}
                  className="flex-1 text-left text-xs font-bold text-[var(--color-text-primary)] truncate hover:opacity-80 transition-colors cursor-pointer"
                >
                  {cat.name}
                </button>
              )}
              <input
                type="number"
                min={15}
                max={960}
                step={15}
                aria-label={`Daily goal minutes for ${cat.name}`}
                placeholder="Goal"
                value={cat.id !== undefined && goalDrafts[cat.id] !== undefined ? goalDrafts[cat.id] : (cat.dailyGoalMinutes ?? '')}
                onChange={e => {
                  if (cat.id === undefined) return
                  setGoalDrafts(prev => ({ ...prev, [cat.id!]: e.target.value }))
                }}
                onBlur={e => {
                  if (cat.id === undefined) return
                  commitGoal(cat.id, e.target.value)
                }}
                onKeyDown={e => {
                  if (e.key === 'Enter' && cat.id !== undefined) {
                    commitGoal(cat.id, (e.target as HTMLInputElement).value)
                  }
                }}
                className="w-16 rounded-lg settings-input px-2 py-1 text-micro"
              />
              <button
                type="button"
                onClick={() => cat.id !== undefined && void handleDelete(cat.id, cat.name)}
                aria-label={`Delete category ${cat.name}`}
                className="flex h-6 w-6 items-center justify-center rounded-full settings-muted hover:text-red-400 hover:bg-red-500/10 transition-all ios-active-scale cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          ))
        )}
      </div>
    </SettingsCard>
  )
}
