import React, { useState } from 'react'
import { ChevronDown, Plus } from 'lucide-react'
import type { CategoryItem } from '../../db/types'
import { InlineCategoryManager } from '../shared/InlineCategoryManager'

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

  return (
    <div className="flex flex-col gap-4 mb-6 bg-white/[0.02] border border-white/5 p-4 rounded-[24px]">
      <div className={timerMode === 'break' ? 'opacity-70 pointer-events-none' : ''}>
        <InlineCategoryManager
          label="Session subject"
          categories={categories}
          addCategory={addCategory}
          deleteCategory={deleteCategory}
          selectedCategoryId={sessionCategoryId}
          onSelectCategory={onSelectCategory}
        />
        {timerMode === 'break' && (
          <p className="text-micro text-white/40 mt-1">Subject locked during break mode.</p>
        )}
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor="task-input" className="text-micro font-bold uppercase tracking-wider text-white/40">
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
            className="flex-1 rounded-xl bg-black/20 border border-white/5 px-4 py-3 text-sm text-white placeholder:text-white/30 outline-none focus:border-accent-blue/30 focus:bg-black/35 transition-all font-semibold"
          />
          <button
            type="button"
            onClick={onSubmit}
            aria-label="Add focus target"
            className="flex h-[46px] w-[46px] shrink-0 items-center justify-center rounded-xl bg-accent-blue hover:bg-accent-blue/90 text-white transition-all ios-active-scale cursor-pointer shadow-md shadow-accent-blue/15"
          >
            <Plus className="h-5 w-5" />
          </button>
        </div>
      </div>

      <button
        type="button"
        onClick={toggleOptions}
        className="flex items-center justify-between w-full text-left text-micro font-bold uppercase tracking-wider text-white/45 hover:text-white/70 transition-colors"
        aria-expanded={showOptions}
      >
        <span>Options</span>
        <ChevronDown className={`h-4 w-4 transition-transform ${showOptions ? 'rotate-180' : ''}`} />
      </button>

      {showOptions && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1 border-t border-white/5">
          <div className="flex flex-col gap-3">
            <div className="flex flex-col gap-1.5">
              <span className="text-micro font-bold uppercase tracking-wider text-white/40">Priority Level</span>
              <div className="flex gap-1.5">
                {(['low', 'medium', 'high'] as const).map(p => {
                  const isActive = taskPriority === p
                  const colors = {
                    low: 'hover:border-accent-blue/40 text-accent-blue bg-accent-blue/5 border-accent-blue/20',
                    medium: 'hover:border-accent-amber/40 text-accent-amber bg-accent-amber/5 border-accent-amber/20',
                    high: 'hover:border-red-500/40 text-red-400 bg-red-500/5 border-red-500/20',
                  }
                  return (
                    <button
                      key={p}
                      type="button"
                      onClick={() => setTaskPriority(p)}
                      className={`flex-1 py-1.5 rounded-lg text-caption font-semibold border capitalize transition-all cursor-pointer ${
                        isActive ? colors[p] : 'bg-transparent border-white/10 text-white/50 hover:bg-white/5 hover:text-white/70'
                      }`}
                    >
                      {p}
                    </button>
                  )
                })}
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <span className="text-micro font-bold uppercase tracking-wider text-white/40">Estimated Pomodoro Cycles</span>
              <select
                value={taskCycleCount}
                onChange={e => setTaskCycleCount(Number(e.target.value))}
                className="w-full rounded-lg bg-black/20 border border-white/5 px-3 py-2 text-xs text-white outline-none cursor-pointer hover:bg-black/30 transition-colors font-bold"
              >
                {[1, 2, 3, 4, 5, 6, 7, 8].map(n => (
                  <option key={n} value={n} className="bg-[#11131e]">🎯 {n} {n === 1 ? 'Cycle' : 'Cycles'}</option>
                ))}
              </select>
              <p className="text-micro text-white/40 leading-relaxed">One cycle = one focus block (default 25 min).</p>
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <span className="text-micro font-bold uppercase tracking-wider text-white/40">Recall Scheduling</span>
            <button
              type="button"
              onClick={() => setTaskIsStudySubject(!taskIsStudySubject)}
              className={`flex items-center justify-between rounded-lg border px-3.5 py-2.5 text-xs font-semibold transition-all cursor-pointer w-full text-left ${
                taskIsStudySubject
                  ? 'bg-accent-purple/10 text-accent-purple border-accent-purple/20'
                  : 'bg-black/20 text-white/50 border-white/5 hover:border-white/10 hover:text-white/70'
              }`}
            >
              <span>🔄 Spaced Repetition (SM-2)</span>
              <div className={`h-4.5 w-8 rounded-full transition-all relative p-0.5 border ${
                taskIsStudySubject ? 'bg-accent-purple border-accent-purple/40' : 'bg-white/5 border-white/10'
              }`}>
                <div className={`h-3 w-3 rounded-full bg-white transition-all transform ${
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
