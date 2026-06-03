import React, { useMemo, useState } from 'react'
import { Plus, Check, Target, Sparkles } from 'lucide-react'
import type { TaskItem, CategoryItem } from '../db/types'

interface TaskRegistryProps {
  tasks: TaskItem[]
  categories: CategoryItem[]
  activeTaskId: number | null
  setActiveTaskId: (id: number | null) => void
  toggleTask: (id: number) => Promise<void>
  handleAddTask: (text: string, categoryId?: number, estimatedCycles?: number, priority?: 'low' | 'medium' | 'high') => void
  submitRecallGrade: (task: TaskItem, q: number) => Promise<void>
  timerCategoryId: number | undefined
  setTimerCategoryId: (id: number | undefined) => void
  timerMode: 'study' | 'break'
  taskCycleCount: number
  setTaskCycleCount: (n: number) => void
}

export const TaskRegistry: React.FC<TaskRegistryProps> = ({
  tasks,
  categories,
  activeTaskId,
  setActiveTaskId,
  toggleTask,
  handleAddTask,
  submitRecallGrade,
  timerCategoryId,
  setTimerCategoryId,
  timerMode,
  taskCycleCount,
  setTaskCycleCount
}) => {
  const [taskText, setTaskText] = useState('')
  const [taskCategory, setTaskCategory] = useState<string>('')
  const [taskPriority, setTaskPriority] = useState<'low' | 'medium' | 'high'>('medium')

  const categoriesMap = useMemo(() => {
    const m = new Map<number, CategoryItem>()
    categories.forEach(c => {
      if (c.id !== undefined) m.set(c.id, c)
    })
    return m
  }, [categories])

  const todayStr = useMemo(() => {
    const d = new Date()
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  }, [])

  // Filter Tasks
  const activeTasksList = useMemo(() => {
    // Only incomplete tasks
    return tasks.filter(t => !t.completed)
  }, [tasks])

  const reviewQueueList = useMemo(() => {
    // Completed tasks whose nextReviewDate is <= today, or completed tasks that have never been graded (no nextReviewDate)
    return tasks.filter(t => t.completed && (!t.nextReviewDate || t.nextReviewDate <= todayStr))
  }, [tasks, todayStr])

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      submitNewTask()
    }
  }

  const submitNewTask = () => {
    const trimmed = taskText.trim()
    if (!trimmed) return
    const catId = taskCategory ? Number(taskCategory) : undefined
    handleAddTask(trimmed, catId, taskCycleCount, taskPriority)
    setTaskText('')
  }

  const activeTask = useMemo(() => {
    if (activeTaskId === null) return null
    return tasks.find(t => t.id === activeTaskId && !t.completed) || null
  }, [activeTaskId, tasks])

  return (
    <div className="lg:col-span-12 flex flex-col gap-6 h-full">
      <div className="border border-white/[0.06] dynamic-card p-6 flex flex-col h-full">
        
        {/* Header Section */}
        <div className="flex items-center justify-between mb-4 border-b border-white/[0.06] pb-3">
          <div>
            <h2 className="font-serif-luxury italic tracking-wide text-white/80 text-xs uppercase">02 / ACTIVE REGISTRY</h2>
            <p className="text-[10px] text-white/60 font-semibold mt-0.5">Define and check target objectives</p>
          </div>
          
          {timerMode === 'study' && (
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-bold text-white/60 uppercase font-mono">Active Subject:</span>
              <select
                value={timerCategoryId ?? ''}
                onChange={e => setTimerCategoryId(e.target.value ? Number(e.target.value) : undefined)}
                className="rounded-xl border border-white/10 bg-white/5 px-2.5 py-1 text-xs text-white outline-none focus:border-white/20 cursor-pointer transition-all duration-300"
              >
                <option value="" className="bg-surface">General</option>
                {categories.map(cat => (
                  <option key={cat.id} value={cat.id} className="bg-surface">{cat.name}</option>
                ))}
              </select>
            </div>
          )}
        </div>

        {/* Active Task Target Indicator */}
        {activeTask && (
          <div className="mb-4 flex items-center gap-3 rounded-xl border border-accent-blue/20 bg-accent-blue/5 px-4 py-3 animate-slide-in-up">
            <div className="h-2 w-2 rounded-full bg-accent-blue animate-ping" />
            <div className="flex-1 min-w-0">
              <p className="text-[9px] uppercase font-bold tracking-wider text-slate-450">Active Target Focus</p>
              <p className="truncate text-xs font-bold text-accent-blue mt-0.5">{activeTask.text}</p>
            </div>
            <span className="whitespace-nowrap text-xs font-mono font-bold text-slate-450 flex items-center gap-1.5 bg-accent-blue/10 px-2.5 py-1 rounded-lg border border-accent-blue/10">
              <Target className="h-3.5 w-3.5 text-accent-blue" />
              <span>{activeTask.actualCycles ?? 0}/{activeTask.estimatedCycles ?? 1} Cycles</span>
            </span>
          </div>
        )}

        {/* Add Task Input Form */}
        <div className="flex flex-wrap items-center gap-2 mb-4 bg-white/[0.01] border border-white/[0.04] p-2 rounded-2xl">
          <input
            type="text"
            value={taskText}
            onChange={e => setTaskText(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="What is your next study objective?"
            className="flex-1 rounded-xl bg-white/5 border border-white/5 focus:bg-white/10 px-3.5 py-2 text-xs text-white placeholder:text-white/40 outline-none transition-all duration-300 min-w-[160px]"
          />
          
          <select
            value={taskCategory}
            onChange={e => setTaskCategory(e.target.value)}
            className="w-28 rounded-xl bg-white/5 border border-white/5 px-2 py-2 text-xs text-white outline-none cursor-pointer hover:bg-white/10 transition-all duration-300"
          >
            <option value="" className="bg-[#12141c]">No subject</option>
            {categories.map(cat => (
              <option key={cat.id} value={cat.id} className="bg-[#12141c]">{cat.name}</option>
            ))}
          </select>
          
          <select
            value={taskPriority}
            onChange={e => setTaskPriority(e.target.value as any)}
            className="w-20 rounded-xl bg-white/5 border border-white/5 px-2 py-2 text-xs text-white outline-none cursor-pointer hover:bg-white/10 transition-all duration-300"
          >
            <option value="medium" className="bg-[#12141c]">Medium</option>
            <option value="high" className="bg-[#12141c]">High</option>
            <option value="low" className="bg-[#12141c]">Low</option>
          </select>
          
          <select
            value={taskCycleCount}
            onChange={e => setTaskCycleCount(Number(e.target.value))}
            className="w-16 rounded-xl bg-white/5 border border-white/5 px-2 py-2 text-xs text-white outline-none cursor-pointer hover:bg-white/10 transition-all duration-300"
          >
            {[1,2,3,4,5,6,7,8].map(n => (
              <option key={n} value={n} className="bg-[#12141c]">🎯 {n}</option>
            ))}
          </select>
          
          <button
            onClick={submitNewTask}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-white/10 text-white border border-white/20 hover:bg-white/15 transition-all duration-300 ease-out cursor-pointer"
          >
            <Plus className="h-4 w-4" />
          </button>
        </div>

        {/* Due for Review Spaced Repetition Queue */}
        {reviewQueueList.length > 0 && (
          <div className="mb-6 p-4 rounded-2xl bg-amber-500/[0.03] border border-amber-500/10 flex flex-col gap-3">
            <div className="flex items-center justify-between border-b border-amber-500/10 pb-2">
              <div className="flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-amber-400" />
                <span className="text-xs font-bold text-amber-300 uppercase tracking-wider">SM-2 Spaced Repetition Review Queue</span>
              </div>
              <span className="text-[10px] font-mono font-bold text-amber-400/70 bg-amber-500/10 border border-amber-500/10 px-2 py-0.5 rounded-lg">
                {reviewQueueList.length} Due
              </span>
            </div>
            
            <div className="flex flex-col gap-2.5 max-h-[200px] overflow-y-auto custom-scrollbar pr-1">
              {reviewQueueList.map(task => (
                <div key={task.id} className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white/[0.02] border border-white/[0.04] p-3 rounded-xl">
                  <div className="flex items-center gap-2.5 min-w-0">
                    {task.categoryId !== undefined && categoriesMap.has(task.categoryId) && (
                      <span 
                        className="shrink-0 text-[8px] font-bold px-2 py-0.5 rounded-lg border text-white/90" 
                        style={{ 
                          backgroundColor: `${categoriesMap.get(task.categoryId)!.color}20`, 
                          borderColor: `${categoriesMap.get(task.categoryId)!.color}40` 
                        }}
                      >
                        {categoriesMap.get(task.categoryId)!.name}
                      </span>
                    )}
                    <span className="text-xs text-white/90 font-medium truncate">{task.text}</span>
                  </div>

                  {/* Recall score grading buttons */}
                  <div className="flex items-center gap-1.5 shrink-0">
                    <span className="text-[9px] text-slate-400 font-bold uppercase tracking-wider mr-1.5 hidden sm:inline">Recall score:</span>
                    {[0, 1, 2, 3, 4, 5].map(q => (
                      <button
                        key={q}
                        onClick={() => submitRecallGrade(task, q)}
                        className="px-2.5 py-1 rounded-lg text-[10px] font-bold font-mono bg-white/5 hover:bg-amber-500/20 text-white/80 hover:text-white border border-white/10 hover:border-amber-500/30 transition-all duration-300 ease-out cursor-pointer"
                        title={
                          q === 0 ? "Complete blackout" :
                          q === 1 ? "Incorrect but remembered" :
                          q === 2 ? "Incorrect; easy to recall after checking" :
                          q === 3 ? "Correct with serious effort" :
                          q === 4 ? "Correct after hesitation" :
                          "Perfect recall"
                        }
                      >
                        {q}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Active Objectives Scroll List */}
        <div className="flex-1 overflow-y-auto max-h-[360px] custom-scrollbar flex flex-col gap-1.5 pr-1">
          {activeTasksList.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 border border-dashed border-white/5 rounded-2xl bg-black/10 text-center my-2">
              <span className="text-4xl mb-3 animate-pulse-soft">🎯</span>
              <p className="text-xs font-bold text-slate-350 max-w-[200px] leading-relaxed">
                No study objectives set for today.
              </p>
              <p className="text-[10px] text-slate-550 max-w-[180px] mt-1.5">
                Input an objective above to plan your focus session.
              </p>
            </div>
          ) : (
            activeTasksList.map(task => (
              <div
                key={task.id}
                onClick={() => { if (!task.completed) setActiveTaskId(activeTaskId === task.id ? null : task.id!) }}
                className={`flex flex-col gap-2 rounded-xl px-4 py-3 transition-all duration-300 ease-out cursor-pointer border ${
                  activeTaskId === task.id
                    ? 'bg-white/10 border-white/20 shadow-md shadow-white/5'
                    : 'bg-white/[0.02] border-white/[0.04] hover:bg-white/[0.05] hover:border-white/10'
                }`}
              >
                <div className="flex items-center gap-3 w-full">
                  <div
                    onClick={e => { e.stopPropagation(); toggleTask(task.id!) }}
                    className={`flex h-5 w-5 shrink-0 cursor-pointer items-center justify-center rounded-lg border transition-all duration-300 ease-out border-white/10 bg-white/5 hover:border-white/20 hover:bg-white/10`}
                  >
                    {task.completed && <Check className="h-3.5 w-3.5 stroke-[2.5]" />}
                  </div>
                  
                  {task.categoryId !== undefined && categoriesMap.has(task.categoryId) && (
                    <span 
                      className="shrink-0 text-[8px] font-bold px-2 py-0.5 rounded-lg border text-white/90" 
                      style={{ 
                        backgroundColor: `${categoriesMap.get(task.categoryId)!.color}20`, 
                        borderColor: `${categoriesMap.get(task.categoryId)!.color}40` 
                      }}
                    >
                      {categoriesMap.get(task.categoryId)!.name}
                    </span>
                  )}

                  {task.priority && (
                    <span className={`shrink-0 text-[8px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-lg border ${
                      task.priority === 'high' 
                        ? 'bg-red-500/10 text-red-400 border-red-500/20' 
                        : task.priority === 'low' 
                        ? 'bg-blue-500/10 text-blue-400 border-blue-500/20' 
                        : 'bg-white/5 text-white/60 border-white/10'
                    }`}>
                      {task.priority}
                    </span>
                  )}

                  <span className={`flex-1 truncate text-xs font-semibold text-white`}>
                    {task.text}
                  </span>

                  <span className="shrink-0 text-[10px] font-mono font-semibold text-white/60 flex items-center gap-1 bg-white/5 px-2 py-0.5 rounded-md border border-white/10">
                    <Target className="h-3 w-3 text-white" />
                    <span>{task.actualCycles ?? 0}/{task.estimatedCycles ?? 1} Cycles</span>
                  </span>
                </div>
              </div>
            ))
          )}
        </div>
        
      </div>
    </div>
  )
}
