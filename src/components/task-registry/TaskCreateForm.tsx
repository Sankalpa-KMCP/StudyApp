import { useId, useState } from 'react'
import { ChevronDown, Plus, Bookmark } from 'lucide-react'
import type { CategoryItem } from '../../db/types'
import { InlineCategoryManager } from '../shared/InlineCategoryManager'
import { SelectionChip } from '../shared/SelectionChip'
import { ToggleSetting } from '../shared/settings/ToggleSetting'
import { useConfirm } from '../../context/useConfirm'
import { addTaskTemplate, loadTaskTemplates, type TaskTemplate } from '../../lib/study/taskTemplates'
import { useTranslation } from '../../i18n/useTranslation'
import { PRIORITY_LABEL_KEYS } from './priorityLabels'

const OPTIONS_EXPANDED_KEY = 'focus_task_options_expanded'
const OPTIONS_PANEL_ID = 'task-create-options-panel'

interface TaskCreateFormProps {
  taskText: string
  setTaskText: (v: string) => void
  sessionCategoryId: number | undefined
  onSelectCategory: (id: number | undefined) => void
  categories: CategoryItem[]
  addCategory: (name: string, color: string) => Promise<number> | number
  deleteCategory: (id: number) => Promise<void> | void
  timerMode: 'study' | 'break'
  taskPriority: 'low' | 'medium' | 'high'
  setTaskPriority: (v: 'low' | 'medium' | 'high') => void
  taskCycleCount: number
  setTaskCycleCount: (n: number) => void
  taskIsStudySubject: boolean
  setTaskIsStudySubject: (v: boolean) => void
  onSubmit: () => void
}

const PRIORITY_ACCENT = {
  low: 'blue',
  medium: 'amber',
  high: 'red',
} as const

export function TaskCreateForm({
  taskText,
  setTaskText,
  sessionCategoryId,
  onSelectCategory,
  categories,
  addCategory,
  deleteCategory,
  timerMode,
  taskPriority,
  setTaskPriority,
  taskCycleCount,
  setTaskCycleCount,
  taskIsStudySubject,
  setTaskIsStudySubject,
  onSubmit,
}: TaskCreateFormProps) {
  const { t } = useTranslation()
  const { requestConfirm } = useConfirm()
  const cycleSelectId = useId()
  const [templates, setTemplates] = useState<TaskTemplate[]>(() => loadTaskTemplates())
  const [showOptions, setShowOptions] = useState(() => {
    if (typeof window === 'undefined') return false
    return sessionStorage.getItem(OPTIONS_EXPANDED_KEY) === 'true'
  })

  const toggleOptions = () => {
    setShowOptions(prev => {
      const next = !prev
      sessionStorage.setItem(OPTIONS_EXPANDED_KEY, String(next))
      return next
    })
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') onSubmit()
  }

  const applyTemplate = (template: TaskTemplate) => {
    setTaskText(template.text)
    setTaskCycleCount(template.estimatedCycles)
    if (template.priority) setTaskPriority(template.priority)
    if (template.isStudySubject !== undefined) setTaskIsStudySubject(template.isStudySubject)
    if (template.categoryId !== undefined) onSelectCategory(template.categoryId)
  }

  const saveCurrentAsTemplate = () => {
    const trimmed = taskText.trim()
    if (!trimmed) return
    addTaskTemplate({
      text: trimmed,
      estimatedCycles: taskCycleCount,
      categoryId: sessionCategoryId,
      priority: taskPriority,
      isStudySubject: taskIsStudySubject,
    })
    setTemplates(loadTaskTemplates())
  }

  return (
    <div className="focus-task-form flex flex-col gap-4 mb-6">
      <div className={timerMode === 'break' ? 'opacity-70 pointer-events-none' : ''}>
        <InlineCategoryManager
          label={t('taskSessionSubject')}
          categories={categories}
          addCategory={addCategory}
          deleteCategory={deleteCategory}
          requestConfirm={requestConfirm}
          selectedCategoryId={sessionCategoryId}
          onSelectCategory={onSelectCategory}
        />
        {timerMode === 'break' && (
          <p className="text-micro text-muted mt-1">{t('taskSubjectLockedBreak')}</p>
        )}
        {sessionCategoryId !== undefined && (() => {
          const cat = categories.find(c => c.id === sessionCategoryId)
          if (!cat?.dailyGoalMinutes) return null
          return (
            <span className="inline-flex mt-2 text-micro font-bold text-accent-blue bg-accent-blue/10 border border-accent-blue/20 px-2.5 py-1 rounded-full">
              {t('taskSubjectGoal', { minutes: cat.dailyGoalMinutes })}
            </span>
          )
        })()}
      </div>

      {templates.length > 0 && (
        <div className="flex flex-col gap-1.5">
          <span className="text-micro font-bold uppercase tracking-wider text-muted">{t('taskTemplates')}</span>
          <div className="flex flex-wrap gap-1.5">
            {templates.map(template => (
              <SelectionChip
                key={template.id}
                selected={false}
                accent="purple"
                size="sm"
                onClick={() => applyTemplate(template)}
              >
                {template.text}
              </SelectionChip>
            ))}
          </div>
        </div>
      )}

      <div className="flex flex-col gap-1">
        <label htmlFor="task-input" className="text-micro font-bold uppercase tracking-wider text-muted">
          {t('taskAddFocusTarget')}
        </label>
        <div className="flex gap-2">
          <input
            id="task-input"
            type="text"
            value={taskText}
            onChange={e => setTaskText(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={t('taskFocusPlaceholder')}
            className="settings-input flex-1 rounded-chrome-lg text-sm text-primary placeholder:text-muted font-semibold focus-ring !rounded-chrome-lg"
          />
          <button
            type="button"
            onClick={onSubmit}
            aria-label={t('taskAddFocusTargetAria')}
            className="focus-ring flex h-[46px] w-[46px] shrink-0 items-center justify-center rounded-chrome-lg bg-accent-blue hover:bg-accent-blue/90 text-on-accent transition-all ios-active-scale cursor-pointer shadow-md shadow-accent-blue/15"
          >
            <Plus className="h-5 w-5" />
          </button>
          <button
            type="button"
            onClick={saveCurrentAsTemplate}
            disabled={!taskText.trim()}
            aria-label={t('taskSaveAsTemplateAria')}
            title={t('taskSaveAsTemplate')}
            className="focus-ring flex h-[46px] w-[46px] shrink-0 items-center justify-center rounded-chrome-lg surface-subtle border border-card text-muted hover:text-accent-purple transition-all ios-active-scale cursor-pointer disabled:opacity-40"
          >
            <Bookmark className="h-5 w-5" />
          </button>
        </div>
      </div>

      <button
        type="button"
        onClick={toggleOptions}
        className="focus-ring flex items-center justify-between w-full text-left text-micro font-bold uppercase tracking-wider text-muted hover:text-secondary transition-colors rounded-lg px-1"
        aria-expanded={showOptions}
        aria-controls={OPTIONS_PANEL_ID}
      >
        <span>{t('taskMoreOptions')}</span>
        <ChevronDown aria-hidden className={`h-4 w-4 transition-transform ${showOptions ? 'rotate-180' : ''}`} />
      </button>

      {showOptions && (
        <div id={OPTIONS_PANEL_ID} className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1 border-t border-card">
          <div className="flex flex-col gap-3">
            <div className="flex flex-col gap-1.5">
              <span className="text-micro font-bold uppercase tracking-wider text-muted">{t('taskPriorityLevel')}</span>
              <div className="flex gap-1.5">
                {(['low', 'medium', 'high'] as const).map(p => (
                  <SelectionChip
                    key={p}
                    selected={taskPriority === p}
                    accent={PRIORITY_ACCENT[p]}
                    size="sm"
                    className="flex-1 capitalize"
                    onClick={() => setTaskPriority(p)}
                  >
                    {t(PRIORITY_LABEL_KEYS[p])}
                  </SelectionChip>
                ))}
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <label htmlFor={cycleSelectId} className="text-micro font-bold uppercase tracking-wider text-muted">
                {t('taskEstimatedCycles')}
              </label>
              <select
                id={cycleSelectId}
                value={taskCycleCount}
                onChange={e => setTaskCycleCount(Number(e.target.value))}
                className="settings-select rounded-chrome-lg text-micro font-bold focus-ring"
              >
                {[1, 2, 3, 4, 5, 6, 7, 8].map(n => (
                  <option key={n} value={n}>
                    {n === 1 ? t('taskCycleOne', { n }) : t('taskCycleMany', { n })}
                  </option>
                ))}
              </select>
              <p className="text-micro text-muted leading-relaxed">{t('taskCycleHelper')}</p>
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <span className="text-micro font-bold uppercase tracking-wider text-muted">{t('taskRecallScheduling')}</span>
            <ToggleSetting
              label={t('taskSpacedRepetitionToggle')}
              checked={taskIsStudySubject}
              onChange={setTaskIsStudySubject}
            />
          </div>
        </div>
      )}
    </div>
  )
}
