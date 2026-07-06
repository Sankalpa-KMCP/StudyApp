import { useState, useRef } from 'react'
import { useVirtualizer } from '@tanstack/react-virtual'
import { Check, Target, AlertCircle, ChevronDown, ChevronUp, Plus } from 'lucide-react'
import { EmptyState } from '../shared/EmptyState'
import { VirtualList } from '../shared/VirtualList'
import type { CategoryItem, TaskItem } from '../../db/types'
import { updateSubtasks } from '../../db/repositories/tasks'
import { SM2_HELPER } from '../../lib/shared/uxTerms'

const SM2_GRADES = [
  { q: 1, label: 'Forgot', title: 'Forgot (Incorrect)' },
  { q: 2, label: 'Hard', title: 'Hard (Barely)' },
  { q: 4, label: 'Good', title: 'Good (Correct)' },
  { q: 5, label: 'Easy', title: 'Easy (Instant)' },
] as const

const COMPLETED_SECTION_KEY = 'completed_section_open'
const COMPLETED_DISPLAY_CAP = 20
const VIRTUALIZE_THRESHOLD = 100
const REVIEW_VIRTUALIZE_THRESHOLD = 25
const TASK_ROW_ESTIMATE = 140
const REVIEW_ROW_ESTIMATE = 72

interface TaskListProps {
  activeTasksList: TaskItem[]
  reviewQueueList: TaskItem[]
  completedTasksList: TaskItem[]
  categoriesMap: Map<number, CategoryItem>
  activeTaskId: number | null
  setActiveTaskId: (id: number | null) => void
  onActivateTask: (task: TaskItem) => void
  toggleTask: (id: number) => Promise<void>
  submitRecallGrade: (task: TaskItem, q: number) => Promise<void>
  searchQuery?: string
}

export function TaskList({
  activeTasksList,
  reviewQueueList,
  completedTasksList,
  categoriesMap,
  activeTaskId,
  setActiveTaskId,
  onActivateTask,
  toggleTask,
  submitRecallGrade,
  searchQuery = '',
}: TaskListProps) {
  const activeListRef = useRef<HTMLDivElement>(null)
  const [completedVisibleCount, setCompletedVisibleCount] = useState(COMPLETED_DISPLAY_CAP)
  const [completedOpen, setCompletedOpen] = useState(() => {
    if (typeof window === 'undefined') return false
    return localStorage.getItem(COMPLETED_SECTION_KEY) === 'true'
  })

  const normalizedQuery = searchQuery.trim().toLowerCase()
  const matchesSearch = (task: TaskItem) =>
    !normalizedQuery || task.text.toLowerCase().includes(normalizedQuery)

  const filteredActive = activeTasksList.filter(matchesSearch)
  const filteredCompleted = completedTasksList.filter(matchesSearch)

  const shouldVirtualize = filteredActive.length > VIRTUALIZE_THRESHOLD
  const visibleCompleted = filteredCompleted.slice(0, completedVisibleCount)

  const activeVirtualizer = useVirtualizer({
    count: filteredActive.length,
    getScrollElement: () => activeListRef.current,
    estimateSize: () => TASK_ROW_ESTIMATE,
    overscan: 5,
    enabled: shouldVirtualize,
  })

  const toggleCompletedSection = () => {
    setCompletedOpen(prev => {
      const next = !prev
      localStorage.setItem(COMPLETED_SECTION_KEY, String(next))
      return next
    })
  }

  const handleAddSubtask = async (task: TaskItem, text: string) => {
    if (task.id === undefined) return
    const sub = { id: Date.now().toString(), text, completed: false }
    await updateSubtasks(task.id, [...(task.subtasks ?? []), sub])
  }

  const handleToggleSubtask = async (task: TaskItem, subId: string) => {
    if (task.id === undefined) return
    const subtasks = (task.subtasks ?? []).map(s =>
      s.id === subId ? { ...s, completed: !s.completed } : s,
    )
    await updateSubtasks(task.id, subtasks)
  }

  const handleDeleteSubtask = async (task: TaskItem, subId: string) => {
    if (task.id === undefined) return
    const subtasks = (task.subtasks ?? []).filter(s => s.id !== subId)
    await updateSubtasks(task.id, subtasks)
  }

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const card = e.currentTarget
    if (card.closest('[data-reduce-effects="true"]')) return
    const rect = card.getBoundingClientRect()
    card.style.setProperty('--mouse-x', `${e.clientX - rect.left}px`)
    card.style.setProperty('--mouse-y', `${e.clientY - rect.top}px`)
  }

  const renderTaskRow = (task: TaskItem, { completed = false }: { completed?: boolean } = {}) => {
    const isActive = !completed && activeTaskId === task.id
    const cat = task.categoryId !== undefined ? categoriesMap.get(task.categoryId) : undefined
    const subtaskCount = task.subtasks?.length ?? 0
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

    const isInteractive = !completed && !isActive

    return (
      <div
        key={task.id}
        aria-current={isActive ? 'true' : undefined}
        onMouseMove={isInteractive ? handleMouseMove : undefined}
        className={`dynamic-card flex flex-col gap-3 py-4 px-4 transition-all duration-305 mb-2 ${
          completed
            ? 'opacity-70'
            : isActive
            ? 'shadow-lg border-card -translate-y-[1px] ring-1 ring-accent-blue/25 border-l-[4px] border-l-accent-blue'
            : 'dynamic-card-interactive hover:-translate-y-[2px]'
        } ${completed || isActive ? '' : priorityBorder}`}
      >
        <div className="flex items-center justify-between gap-3.5 w-full">
          <div className="flex items-center gap-3 w-full min-w-0">
            <button
              type="button"
              aria-label={task.completed ? 'Mark task incomplete' : 'Mark task complete'}
              onClick={() => toggleTask(task.id!)}
              className={`flex h-5 w-5 shrink-0 cursor-pointer items-center justify-center rounded-full border transition-all duration-250 ease-out ios-active-scale ${
                task.completed
                  ? 'border-accent-green bg-accent-green text-on-accent shadow-sm'
                  : 'border-card hover:border-accent-blue hover:surface-subtle'
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
            {!completed && task.priority && (
              <span className={`shrink-0 text-[8px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full border ${
                task.priority === 'high'
                  ? 'bg-red-500/10 text-red-400 border-red-500/20'
                  : task.priority === 'low'
                  ? 'bg-accent-blue/10 text-accent-blue border-accent-blue/20'
                  : 'bg-transparent text-muted border-card'
              }`}>
                {task.priority}
              </span>
            )}
            <span
              title={task.text}
              className={`flex-1 text-xs font-semibold select-none transition-colors ${
                completed
                  ? 'text-muted line-through truncate'
                  : isActive
                  ? 'text-primary line-clamp-2'
                  : 'text-secondary truncate'
              }`}
            >
              {task.text}
            </span>
            {!completed && subtaskCount > 0 && !isActive && (
              <span className="shrink-0 text-micro font-bold text-muted surface-subtle border border-card px-2 py-0.5 rounded-full">
                {subtaskCount} subtask{subtaskCount === 1 ? '' : 's'}
              </span>
            )}
          </div>
          {!completed && (
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
                    : 'border-card surface-subtle text-muted hover:border-accent-blue/40 hover:text-accent-blue'
                }`}
              >
                <Target className="h-4 w-4" />
              </button>
              <span className="text-micro font-mono font-bold text-secondary flex items-center gap-1 surface-subtle px-2.5 py-1 rounded-full border border-card">
                <span>{task.actualCycles ?? 0}/{task.estimatedCycles ?? 1}</span>
              </span>
            </div>
          )}
        </div>

        {!completed && isActive && subtaskCount === 0 && (
          <p className="pl-8 text-micro text-muted italic">Add subtasks to break this target into steps.</p>
        )}

        {!completed && isActive && (
          <div data-subtask-panel className="pl-8 pr-2 pt-2.5 border-t border-card space-y-3 cursor-default">
            {subtaskCount > 0 && (
              <div className="space-y-2">
                {task.subtasks!.map(sub => (
                  <div key={sub.id} className="flex items-center gap-2.5 text-xs">
                    <button
                      type="button"
                      onClick={() => handleToggleSubtask(task, sub.id)}
                      className={`h-4 w-4 shrink-0 rounded flex items-center justify-center transition-all cursor-pointer ${
                        sub.completed
                          ? 'border-accent-green bg-accent-green text-on-accent'
                          : 'border-card hover:border-accent-blue surface-subtle'
                      }`}
                    >
                      {sub.completed && <Check className="h-2.5 w-2.5 stroke-[3]" />}
                    </button>
                    <span className={`flex-1 truncate ${sub.completed ? 'text-muted line-through' : 'text-secondary'}`}>
                      {sub.text}
                    </span>
                    <button
                      type="button"
                      aria-label={`Delete subtask ${sub.text}`}
                      onClick={() => handleDeleteSubtask(task, sub.id)}
                      className="text-micro text-muted hover:text-red-400 font-bold transition-colors cursor-pointer pl-1 pr-1"
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
                className="flex-1 surface-subtle border border-card rounded-lg px-2.5 py-1.5 text-micro text-primary placeholder:text-muted outline-none"
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
  }

  return (
    <>
      {reviewQueueList.length > 0 && (
        <div className="mb-6 p-4 rounded-[20px] surface-subtle border border-card flex flex-col gap-3 shadow-md animate-slide-in-up">
          <div className="flex items-center justify-between border-b border-card pb-2">
            <span className="text-[9.5px] font-bold text-muted uppercase tracking-wider">Spaced Repetition Review</span>
            <span className="text-[8.5px] font-bold text-accent-amber bg-accent-amber/10 border border-accent-amber/20 px-2.5 py-0.5 rounded-full select-none">
              {reviewQueueList.length} Due
            </span>
          </div>

          <p className="text-micro text-muted">{SM2_HELPER}</p>
          <VirtualList
            items={reviewQueueList}
            className="flex flex-col gap-1 max-h-[40vh] overflow-y-auto custom-scrollbar pr-1"
            estimateSize={REVIEW_ROW_ESTIMATE}
            enabled={reviewQueueList.length > REVIEW_VIRTUALIZE_THRESHOLD}
            getKey={task => task.id ?? task.text}
            renderItem={task => (
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 py-2 border-b border-card last:border-b-0 hover:surface-subtle px-1 rounded-xl transition-colors duration-200">
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
                  <span className="text-xs text-primary font-semibold truncate select-none" title={task.text}>{task.text}</span>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <span className="text-[8px] text-muted font-bold uppercase tracking-wider mr-1.5 hidden sm:inline select-none">Recall:</span>
                  {SM2_GRADES.map(({ q, label, title }) => (
                    <button
                      key={q}
                      type="button"
                      title={title}
                      aria-label={`Recall grade ${q} (${title}) for ${task.text}`}
                      onClick={() => submitRecallGrade(task, q)}
                      className="min-h-11 min-w-11 sm:min-h-6 sm:min-w-6 rounded-full text-micro sm:text-micro font-bold surface-subtle hover:surface-track text-secondary border border-card transition-all ios-active-scale cursor-pointer flex items-center justify-center px-1"
                    >
                      <span className="sm:hidden">{label}</span>
                      <span className="hidden sm:inline font-mono">{q}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          />
        </div>
      )}

      <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar flex flex-col pr-1">
        {filteredActive.length === 0 && filteredCompleted.length === 0 ? (
          <EmptyState
            icon={<AlertCircle className="h-8 w-8" />}
            title={normalizedQuery ? 'No matching focus targets' : 'No focus targets yet'}
            description={normalizedQuery
              ? 'Try a different search term.'
              : 'Add a focus target below to link it to your study block.'}
            action={!normalizedQuery ? (
              <span className="inline-flex items-center gap-1.5 text-label text-muted">
                <Plus className="h-3.5 w-3.5" aria-hidden />
                Use the form above to add your first target
              </span>
            ) : undefined}
          />
        ) : (
          <div ref={activeListRef} className={`flex flex-col ${shouldVirtualize ? 'max-h-[60vh] overflow-y-auto custom-scrollbar' : ''}`}>
            {shouldVirtualize ? (
              <div
                style={{ height: `${activeVirtualizer.getTotalSize()}px`, width: '100%', position: 'relative' }}
              >
                {activeVirtualizer.getVirtualItems().map(virtualRow => {
                  const task = filteredActive[virtualRow.index]
                  return (
                    <div
                      key={task.id ?? virtualRow.key}
                      ref={activeVirtualizer.measureElement}
                      data-index={virtualRow.index}
                      style={{
                        position: 'absolute',
                        top: 0,
                        left: 0,
                        width: '100%',
                        transform: `translateY(${virtualRow.start}px)`,
                      }}
                    >
                      {renderTaskRow(task)}
                    </div>
                  )
                })}
              </div>
            ) : (
              filteredActive.map(task => renderTaskRow(task))
            )}
          </div>
        )}

        {filteredCompleted.length > 0 && (
          <div className="mt-4 border-t border-card pt-4">
            <button
              type="button"
              onClick={toggleCompletedSection}
              className="flex w-full items-center justify-between text-micro font-bold uppercase tracking-wider text-muted hover:text-primary transition-colors mb-2"
              aria-expanded={completedOpen}
            >
              <span>Recently completed ({filteredCompleted.length})</span>
              {completedOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </button>
            {completedOpen && (
              <div className="flex flex-col">
                {visibleCompleted.map(task => renderTaskRow(task, { completed: true }))}
                {completedVisibleCount < filteredCompleted.length && (
                  <button
                    type="button"
                    onClick={() => setCompletedVisibleCount(c => c + COMPLETED_DISPLAY_CAP)}
                    className="mt-2 rounded-full border border-card surface-subtle px-4 py-2 text-label font-semibold text-secondary hover:surface-track"
                  >
                    Show more ({filteredCompleted.length - completedVisibleCount} remaining)
                  </button>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </>
  )
}
