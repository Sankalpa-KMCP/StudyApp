import { useState } from 'react'
import { X } from 'lucide-react'
import { useConfirm } from '../../context/useConfirm'
import { useTranslation } from '../../i18n/useTranslation'
import { useSettingsPanel } from '../../context/settingsPanelContext'
import { SettingsCard } from '../shared/settings/SettingsCard'
import { Button } from '../shared/Button'

/** Aligns with theme accent palette in index.css @theme */
const SWATCH_COLORS = ['#007aff', '#af52de', '#ec4899', '#ff453a', '#ff9500', '#34c759', '#64748B']
const DEFAULT_CATEGORY_COLOR = SWATCH_COLORS[0]

function clampCategoryGoal(raw: number): number {
  const stepped = Math.round(raw / 15) * 15
  return Math.min(960, Math.max(15, stepped))
}

export function CategoriesPanel() {
  const { t } = useTranslation()
  const { categories: catApi, pushToast } = useSettingsPanel()
  const { requestConfirm } = useConfirm()
  const { categories, addCategory, updateCategory, deleteCategory } = catApi

  const [newCategoryName, setNewCategoryName] = useState('')
  const [newCategoryColor, setNewCategoryColor] = useState(DEFAULT_CATEGORY_COLOR)
  const [newCategoryGoal, setNewCategoryGoal] = useState('')
  const [editingCategoryId, setEditingCategoryId] = useState<number | null>(null)
  const [editingCategoryName, setEditingCategoryName] = useState('')
  const [goalDrafts, setGoalDrafts] = useState<Record<number, string>>({})

  const handleAdd = async () => {
    const val = newCategoryName.trim()
    if (!val) return
    const goal = newCategoryGoal.trim() ? clampCategoryGoal(Number(newCategoryGoal)) : undefined
    await addCategory(val, newCategoryColor, goal)
    pushToast('SETTINGS', t('categoriesAddedToast', { name: val }))
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
      title: t('categoriesDeleteConfirmTitle', { name }),
      message: t('categoriesDeleteConfirmMessage'),
      confirmLabel: t('categoriesDeleteConfirmLabel'),
      danger: true,
    })
    if (!ok) return
    try {
      await deleteCategory(catId)
      pushToast('SETTINGS', t('categoriesRemovedToast', { name }))
    } catch {
      pushToast('SETTINGS', t('categoriesCannotDeleteLast'))
    }
  }

  return (
    <SettingsCard id="settings-categories" title={t('categoriesPanelTitle')} defaultCollapsed>
      <div className="flex gap-2 mb-4 settings-input border border-card p-2 rounded-full flex-wrap sm:flex-nowrap">
        <input
          id="category-name-input"
          value={newCategoryName}
          onChange={e => setNewCategoryName(e.target.value)}
          type="text"
          placeholder={t('categoriesNamePlaceholder')}
          aria-label={t('categoriesNameAria')}
          className="settings-input flex-1 min-w-[120px] !rounded-full !py-1.5 !px-3 text-micro !border-0 !bg-transparent"
          onKeyDown={e => { if (e.key === 'Enter') void handleAdd() }}
        />
        <input
          value={newCategoryGoal}
          onChange={e => setNewCategoryGoal(e.target.value)}
          type="number"
          min={15}
          max={960}
          step={15}
          placeholder={t('categoriesGoalPlaceholder')}
          aria-label={t('categoriesGoalAria')}
          className="settings-input w-24 !rounded-full !py-1.5 !px-3 text-micro !border-0 !bg-transparent"
        />
        <input
          type="color"
          value={newCategoryColor}
          onChange={e => setNewCategoryColor(e.target.value)}
          aria-label={t('categoriesColorAria', { color: newCategoryColor })}
          className="h-8 w-8 cursor-pointer rounded-full border border-card bg-transparent p-0.5 focus-ring"
        />
        <Button type="button" variant="primary" size="sm" onClick={() => void handleAdd()}>
          {t('categoriesAdd')}
        </Button>
      </div>

      <div className="flex items-center gap-2.5 mb-4 px-2 select-none">
        <span className="settings-muted font-bold uppercase tracking-wider text-micro">{t('categoriesSwatches')}</span>
        <div className="flex flex-wrap gap-2" role="group" aria-label={t('categoriesSwatches')}>
          {SWATCH_COLORS.map(color => {
            const selected = newCategoryColor.toLowerCase() === color.toLowerCase()
            return (
              <button
                key={color}
                type="button"
                onClick={() => setNewCategoryColor(color)}
                aria-pressed={selected}
                className={`h-5 w-5 rounded-full border cursor-pointer transition-all duration-200 hover:scale-110 focus-ring ${
                  selected
                    ? 'border-primary scale-105 shadow-md'
                    : 'border-card hover:border-accent-blue/40'
                }`}
                style={{ backgroundColor: color }}
                title={color}
                aria-label={t('categoriesColorAria', { color })}
              />
            )
          })}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto max-h-[260px] custom-scrollbar space-y-2 pr-1">
        {categories.length === 0 ? (
          <p className="text-xs italic settings-muted text-center py-4">{t('categoriesEmpty')}</p>
        ) : (
          categories.map(cat => (
            <div
              key={cat.id}
              className="flex items-center gap-2.5 rounded-[16px] bg-[color-mix(in_srgb,var(--color-surface-card)_40%,transparent)] border border-card px-3.5 py-2.5"
            >
              <label className="relative h-3 w-3 shrink-0 cursor-pointer" title={t('categoriesChangeColorTitle')}>
                <span className="block h-3 w-3 rounded-full border border-card" style={{ backgroundColor: cat.color }} />
                <input
                  type="color"
                  value={cat.color}
                  onChange={e => {
                    if (cat.id === undefined) return
                    void updateCategory(cat.id, { color: e.target.value })
                  }}
                  className="absolute inset-0 opacity-0 cursor-pointer focus-ring"
                  aria-label={t('categoriesColorForAria', { name: cat.name })}
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
                  className="settings-input flex-1 min-w-0 !rounded-lg !py-1 !px-2 text-micro"
                  aria-label={t('categoriesEditNameAria', { name: cat.name })}
                />
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    if (cat.id === undefined) return
                    setEditingCategoryId(cat.id)
                    setEditingCategoryName(cat.name)
                  }}
                  className="flex-1 text-left text-xs font-bold text-primary truncate hover:opacity-80 transition-colors cursor-pointer focus-ring rounded-lg px-1"
                >
                  {cat.name}
                </button>
              )}
              <input
                type="number"
                min={15}
                max={960}
                step={15}
                aria-label={t('categoriesDailyGoalAria', { name: cat.name })}
                placeholder={t('categoriesGoalShort')}
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
                className="settings-input w-16 !rounded-lg !py-1 !px-2 text-micro"
              />
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => cat.id !== undefined && void handleDelete(cat.id, cat.name)}
                aria-label={t('categoriesDeleteAria', { name: cat.name })}
                className="!h-6 !w-6 !p-0 text-muted hover:text-danger"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          ))
        )}
      </div>
    </SettingsCard>
  )
}
