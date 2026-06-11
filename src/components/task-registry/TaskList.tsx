import { useState } from 'react'
import { Check, Target, AlertCircle } from 'lucide-react'
import type { CategoryItem, TaskItem } from '../../db/types'
import { db } from '../../db/db'
import { SM2_HELPER } from '../../lib/uxTerms'

const SM2_GRADES = [
  { q: 1, label: 'Forgot', title: 'Forgot (Incorrect)' },
  { q: 2, label: 'Hard', title: 'Hard (Barely)' },
  { q: 4, label: 'Good', title: 'Good (Correct)' },
  { q: 5, label: 'Easy', title: 'Easy (Instant)' },
] as const

interface TaskListProps {
  activeTasksList: TaskItem[]
  reviewQueueList: TaskItem[]
  categoriesMap: Map<number, CategoryItem>
  activeTaskId: number | null
  setActiveTaskId: (id: number | null) => void
  onActivateTask: (task: TaskItem) => void
  toggleTask: (id: number) => Promise<void>
  submitRecallGrade: (task: TaskItem, q: number) => Promise<void>
}

export function TaskList({
  activeTasksList,
  reviewQueueList,
  categoriesMap,
  activeTaskId,
  setActiveTaskId,
  onActivateTask,
  toggleTask,
  submitRecallGrade,
}: TaskListProps) {
  const VIRTUALIZE_THRESHOLD = 100
  const PAGE_SIZE = 50
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE)
  const shouldVirtualize = activeTasksList.length > VIRTUALIZE_THRESHOLD
  const visibleTasks = shouldVirtualize ? activeTasksList.slice(0, visibleCount) : activeTasksList

  const handleAddSubtask = async (task: TaskItem, text: string) => {
    if (task.id === undefined) return
    const sub = { id: Date.now().toString(), text, completed: false }
    await db.tasks.update(task.id, { subtasks: [...(task.subtasks ?? []), sub] })
  }

  const handleToggleSubtask = async (task: TaskItem, subId: string) => {
    if (task.id === undefined) return
    const subtasks = (task.subtasks ?? []).map(s =>
      s.id === subId ? { ...s, completed: !s.completed } : s,
    )
    await db.tasks.update(task.id, { subtasks })
  }

  const handleDeleteSubtask = async (task: TaskItem, subId: string) => {
    if (task.id === undefined) return
    const subtasks = (task.subtasks ?? []).filter(s => s.id !== subId)
    await db.tasks.update(task.id, { subtasks })
  }

  return (
    <>
      {reviewQueueList.length > 0 && (
        <div className="mb-6 p-4 rounded-[20px] bg-black/20 border border-white/5 flex flex-col gap-3 shadow-md animate-slide-in-up">
          <div className="flex items-center justify-between border-b border-white/5 pb-2">
            <span className="text-[9.5px] font-bold text-white/40 uppercase tracking-wider">Spaced Repetition Review</span>
            <span className="text-[8.5px] font-bold text-accent-amber bg-accent-amber/10 border border-accent-amber/20 px-2.5 py-0.5 rounded-full select-none">
              {reviewQueueList.length} Due
            </span>
          </div>

          <p className="text-micro text-white/40">{SM2_HELPER}</p>
          <div className="flex flex-col gap-1 max-h-[40vh] overflow-y-auto custom-scrollbar pr-1">
            {reviewQueueList.map(task => (
              <div key={task.id} className="flex flex-col md:flex-row md:items-center justify-between gap-3 py-2 border-b border-white/5 last:border-b-0 hover:bg-white/[0.03] px-1 rounded-xl transition-colors duration-200">
                <div className="flex items-center gap-2.5 min-w-0">
                  {task.categoryId !== undefined && categoriesMap.has(task.categoryId) && (
                    <span
                      className="shrink-0 text-[8px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border"
                      style={{
                        backgroundColor: `${categoriesMap.get(task.categoryId)!.color}10`,
                        borderColor: `${categoriesMap.get(task.categoryId)!.color}20`,
                        color: categoriesMap.get(task.categoryId)!.color,
                      }}
                    >
                      {categoriesMap.get(task.categoryId)!.name}
                    </span>
                  )}
                  <span className="text-xs text-white/90 font-semibold truncate select-none" title={task.text}>{task.text}</span>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <span className="text-[8px] text-white/40 font-bold uppercase tracking-wider mr-1.5 hidden sm:inline select-none">Recall:</span>
                  {SM2_GRADES.map(({ q, label, title }) => (
                    <button
                      key={q}
                      type="button"
                      title={title}
                      aria-label={`Recall grade ${q} (${title}) for ${task.text}`}
                      onClick={() => submitRecallGrade(task, q)}
                      className="min-h-11 min-w-11 sm:min-h-6 sm:min-w-6 rounded-full text-[9px] sm:text-[9px] font-bold bg-white/5 hover:bg-white/10 text-white/80 border border-white/10 transition-all ios-active-scale cursor-pointer flex items-center justify-center px-1"
                    >
                      <span className="sm:hidden">{label}</span>
                      <span className="hidden sm:inline font-mono">{q}</span>
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar flex flex-col pr-1">
        {activeTasksList.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 border border-dashed border-white/10 rounded-[24px] bg-black/20 text-center my-2 select-none animate-fade-in">
            <div className="flex h-10 w-10 items-center justify-center rounded-[10px] bg-white/5 mb-3 text-white/40">
              <AlertCircle className="h-5 w-5" />
            </div>
            <p className="text-sm font-bold text-white/70">No focus targets yet</p>
            <p className="text-label text-white/45 mt-1.5 font-medium max-w-xs leading-relaxed">
              Add a focus target below to link it to your study block.
            </p>
          </div>
        ) : (
          <div className="flex flex-col">
            {visibleTasks.map(task => {
              const isActive = activeTaskId === task.id
              const cat = task.categoryId !== undefined ? categoriesMap.get(task.categoryId) : undefined
              const priorityBorder = task.priority === 'high'
                ? 'border-l-[4px] border-l-[#ff453a]'
                : task.priority === 'medium'
                ? 'border-l-[4px] border-l-[#ff9f0a]'
                : 'border-l-[4px] border-l-accent-blue/40'

              const toggleActive = () => {
                if (task.completed) return
                if (isActive) {
                  setActiveTaskId(null)
                } else {
                  onActivateTask(task)
                }
              }

              return (
                <div
                  key={task.id}
                  aria-current={isActive ? 'true' : undefined}
                  className={`dynamic-card flex flex-col gap-3 py-4 px-4 transition-all duration-300 mb-2 ${
                    isActive
                      ? 'shadow-lg border-white/12 -translate-y-[1px] ring-1 ring-accent-blue/25 border-l-[4px] border-l-accent-blue'
                      : 'hover:-translate-y-[2px]'
                  } ${isActive ? '' : priorityBorder}`}
                >
                  <div className="flex items-center justify-between gap-3.5 w-full">
                    <div className="flex items-center gap-3 w-full min-w-0">
                      <button
                        type="button"
                        aria-label={task.completed ? 'Mark task incomplete' : 'Mark task complete'}
                        onClick={() => toggleTask(task.id!)}
                        className={`flex h-5 w-5 shrink-0 cursor-pointer items-center justify-center rounded-full border transition-all duration-250 ease-out ios-active-scale ${
                          task.completed
                            ? 'border-accent-green bg-accent-green text-white shadow-sm'
                            : 'border-white/20 hover:border-accent-blue hover:bg-white/5'
                        }`}
                      >
                        {task.completed && <Check className="h-3 w-3 stroke-[2.5]" />}
                      </button>
                      {cat && (
                        <span
                          className="shrink-0 text-[8px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full border"
                          style={{ backgroundColor: 'transparent', borderColor: cat.color, color: cat.color }}
                        >
                          {cat.name}
                        </span>
                      )}
                      {task.priority && (
                        <span className={`shrink-0 text-[8px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full border ${
                          task.priority === 'high'
                            ? 'bg-red-500/10 text-red-400 border-red-500/20'
                            : task.priority === 'low'
                            ? 'bg-accent-blue/10 text-accent-blue border-accent-blue/20'
                            : 'bg-transparent text-white/40 border-white/10'
                        }`}>
                          {task.priority}
                        </span>
                      )}
                      <span
                        title={task.text}
                        className={`flex-1 text-xs font-semibold select-none transition-colors ${isActive ? 'text-white line-clamp-2' : 'text-white/80 truncate'}`}
                      >
                        {task.text}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        type="button"
                        disabled={task.completed}
                        aria-label={isActive ? `Deselect ${task.text}` : `Select ${task.text} for timer`}
                        aria-pressed={isActive}
                        onClick={toggleActive}
                        className={`min-h-9 min-w-9 flex items-center justify-center rounded-full border transition-all ios-active-scale cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed ${
                          isActive
                            ? 'border-accent-blue bg-accent-blue/15 text-accent-blue'
                            : 'border-white/10 bg-white/5 text-white/50 hover:border-accent-blue/40 hover:text-accent-blue'
                        }`}
                      >
                        <Target className="h-4 w-4" />
                      </button>
                      <span className="text-[9px] font-mono font-bold text-white/60 flex items-center gap-1 bg-white/5 px-2.5 py-1 rounded-full border border-white/5">
                        <span>{task.actualCycles ?? 0}/{task.estimatedCycles ?? 1}</span>
                      </span>
                    </div>
                  </div>

                  {isActive && (
                    <div data-subtask-panel className="pl-8 pr-2 pt-2.5 border-t border-white/5 space-y-3 cursor-default">
                      {task.subtasks && task.subtasks.length > 0 && (
                        <div className="space-y-2">
                          {task.subtasks.map(sub => (
                            <div key={sub.id} className="flex items-center gap-2.5 text-xs">
                              <button
                                type="button"
                                onClick={() => handleToggleSubtask(task, sub.id)}
                                className={`h-4 w-4 shrink-0 rounded flex items-center justify-center transition-all cursor-pointer ${
                                  sub.completed
                                    ? 'border-accent-green bg-accent-green text-white'
                                    : 'border-white/20 hover:border-accent-blue bg-white/5'
                                }`}
                              >
                                {sub.completed && <Check className="h-2.5 w-2.5 stroke-[3]" />}
                              </button>
                              <span className={`flex-1 truncate ${sub.completed ? 'text-white/30 line-through' : 'text-white/80'}`}>
                                {sub.text}
                              </span>
                              <button
                                type="button"
                                aria-label={`Delete subtask ${sub.text}`}
                                onClick={() => handleDeleteSubtask(task, sub.id)}
                                className="text-[10px] text-white/30 hover:text-red-400 font-bold transition-colors cursor-pointer pl-1 pr-1"
                              >
                                ✕
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                      <div className="flex gap-2">
                        <input
                          type="text"
                          placeholder="Add subtask..."
                          className="flex-1 bg-black/30 border border-white/8 rounded-lg px-2.5 py-1.5 text-[10px] text-white placeholder-white/25 outline-none"
                          onKeyDown={async e => {
                            if (e.key === 'Enter') {
                              const target = e.target as HTMLInputElement
                              const text = target.value.trim()
                              if (text) {
                                await handleAddSubtask(task, text)
                                target.value = ''
                              }
                            }
                          }}
                        />
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
            {shouldVirtualize && visibleCount < activeTasksList.length && (
              <button
                type="button"
                onClick={() => setVisibleCount(c => c + PAGE_SIZE)}
                className="mt-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-label font-semibold text-white/70 hover:bg-white/10"
              >
                Show more ({activeTasksList.length - visibleCount} remaining)
              </button>
            )}
          </div>
        )}
      </div>
    </>
  )
}
