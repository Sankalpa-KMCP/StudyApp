import { useState } from 'react'
import { ChevronDown, Plus, Bookmark } from 'lucide-react'
import type { CategoryItem } from '../../db/types'
import { InlineCategoryManager } from '../shared/InlineCategoryManager'
import { SelectionChip } from '../shared/SelectionChip'
import { useConfirm } from '../../context/useConfirm'
import { addTaskTemplate, loadTaskTemplates, type TaskTemplate } from '../../lib/study/taskTemplates'

const OPTIONS_EXPANDED_KEY = 'focus_task_options_expanded'

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
  const { requestConfirm } = useConfirm()
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
          label="Session subject"
          categories={categories}
          addCategory={addCategory}
          deleteCategory={deleteCategory}
          requestConfirm={requestConfirm}
          selectedCategoryId={sessionCategoryId}
          onSelectCategory={onSelectCategory}
        />
        {timerMode === 'break' && (
          <p className="text-micro text-muted mt-1">Subject locked during break mode.</p>
        )}
        {sessionCategoryId !== undefined && (() => {
          const cat = categories.find(c => c.id === sessionCategoryId)
          if (!cat?.dailyGoalMinutes) return null
          return (
            <span className="inline-flex mt-2 text-[10px] font-bold text-accent-blue bg-accent-blue/10 border border-accent-blue/20 px-2.5 py-1 rounded-full">
              Subject goal: {cat.dailyGoalMinutes} min/day
            </span>
          )
        })()}
      </div>

      {templates.length > 0 && (
        <div className="flex flex-col gap-1.5">
          <span className="text-micro font-bold uppercase tracking-wider text-muted">Templates</span>
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
          Add focus target
        </label>
        <div className="flex gap-2">
          <input
            id="task-input"
            type="text"
            value={taskText}
            onChange={e => setTaskText(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="What do you want to focus on?"
            className="flex-1 rounded-xl surface-subtle border border-card px-4 py-3 text-sm text-primary placeholder:text-muted outline-none focus:border-accent-blue/30 transition-all font-semibold"
          />
          <button
            type="button"
            onClick={onSubmit}
            aria-label="Add focus target"
            className="flex h-[46px] w-[46px] shrink-0 items-center justify-center rounded-xl bg-accent-blue hover:bg-accent-blue/90 text-on-accent transition-all ios-active-scale cursor-pointer shadow-md shadow-accent-blue/15"
          >
            <Plus className="h-5 w-5" />
          </button>
          <button
            type="button"
            onClick={saveCurrentAsTemplate}
            disabled={!taskText.trim()}
            aria-label="Save as template"
            title="Save as template"
            className="flex h-[46px] w-[46px] shrink-0 items-center justify-center rounded-xl surface-subtle border border-card text-muted hover:text-accent-purple transition-all ios-active-scale cursor-pointer disabled:opacity-40"
          >
            <Bookmark className="h-5 w-5" />
          </button>
        </div>
      </div>

      <button
        type="button"
        onClick={toggleOptions}
        className="flex items-center justify-between w-full text-left text-micro font-bold uppercase tracking-wider text-muted hover:text-secondary transition-colors"
        aria-expanded={showOptions}
      >
        <span>More options</span>
        <ChevronDown className={`h-4 w-4 transition-transform ${showOptions ? 'rotate-180' : ''}`} />
      </button>

      {showOptions && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1 border-t border-card">
          <div className="flex flex-col gap-3">
            <div className="flex flex-col gap-1.5">
              <span className="text-micro font-bold uppercase tracking-wider text-muted">Priority Level</span>
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
                    {p}
                  </SelectionChip>
                ))}
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <span className="text-micro font-bold uppercase tracking-wider text-muted">Estimated Pomodoro Cycles</span>
              <select
                value={taskCycleCount}
                onChange={e => setTaskCycleCount(Number(e.target.value))}
                className="w-full rounded-lg surface-subtle border border-card px-3 py-2 text-xs text-primary outline-none cursor-pointer font-bold settings-select"
              >
                {[1, 2, 3, 4, 5, 6, 7, 8].map(n => (
                  <option key={n} value={n}>🎯 {n} {n === 1 ? 'Cycle' : 'Cycles'}</option>
                ))}
              </select>
              <p className="text-micro text-muted leading-relaxed">One cycle = one focus block (default 25 min).</p>
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <span className="text-micro font-bold uppercase tracking-wider text-muted">Recall Scheduling</span>
            <button
              type="button"
              onClick={() => setTaskIsStudySubject(!taskIsStudySubject)}
              className={`flex items-center justify-between rounded-lg border px-3.5 py-2.5 text-xs font-semibold transition-all cursor-pointer w-full text-left ${
                taskIsStudySubject
                  ? 'bg-accent-purple/10 text-accent-purple border-accent-purple/20'
                  : 'surface-subtle text-muted border-card hover:text-secondary'
              }`}
            >
              <span>🔄 Spaced Repetition (SM-2)</span>
              <div className={`h-4.5 w-8 rounded-full transition-all relative p-0.5 border ${
                taskIsStudySubject ? 'bg-accent-purple border-accent-purple/40' : 'surface-subtle border-card'
              }`}>
                <div className={`h-3 w-3 rounded-full bg-primary transition-all transform ${
                  taskIsStudySubject ? 'translate-x-3.5' : 'translate-x-0'
                }`} />
              </div>
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
