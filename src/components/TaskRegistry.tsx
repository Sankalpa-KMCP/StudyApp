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
    return tasks.filter(t => !t.completed)
  }, [tasks])

  const reviewQueueList = useMemo(() => {
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
    <div className="flex flex-col gap-6 h-full w-full">
      <div className="border border-white/[0.08] bg-gradient-to-br from-white/[0.02] to-white/[0.005] dynamic-card p-6 flex flex-col h-full shadow-[inset_0_1px_1px_rgba(255,255,255,0.08),0_24px_48px_rgba(0,0,0,0.4)]">
        
        {/* Header Section */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-5 border-b border-white/[0.06] pb-4">
          <div>
            <h2 className="font-serif-luxury italic tracking-wider text-white/50 text-[10px] uppercase select-none">02 / ACTIVE REGISTRY</h2>
            <p className="text-sm font-bold text-white mt-1">Study Objectives</p>
          </div>
          
          {timerMode === 'study' && (
            <div className="flex items-center gap-2.5">
              <span className="text-[9px] font-bold text-white/40 uppercase font-mono tracking-wider select-none">Session Focus:</span>
              <select
                value={timerCategoryId ?? ''}
                onChange={e => setTimerCategoryId(e.target.value ? Number(e.target.value) : undefined)}
                className="rounded-xl border border-white/10 bg-black/40 hover:bg-black/60 px-3 py-1.5 text-xs text-white outline-none focus:border-white/20 cursor-pointer transition-all"
              >
                <option value="" className="bg-[#0b0c10] text-white/60">General / None</option>
                {categories.map(cat => (
                  <option key={cat.id} value={cat.id} className="bg-[#0b0c10] text-white">{cat.name}</option>
                ))}
              </select>
            </div>
          )}
        </div>

        {/* Active Task Target Indicator */}
        {activeTask && (
          <div className="mb-5 flex items-center gap-3.5 rounded-2xl border border-accent-blue/20 bg-accent-blue/5 p-4 shadow-[0_0_15px_rgba(var(--color-accent-blue-rgb),0.05)] animate-slide-in-up">
            <div className="relative flex h-2.5 w-2.5 shrink-0 items-center justify-center">
              <div className="absolute h-full w-full rounded-full bg-accent-blue animate-ping opacity-75" />
              <div className="h-2 w-2 rounded-full bg-accent-blue" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[9px] uppercase font-bold tracking-widest text-slate-500 font-mono">Current Active Sprint Target</p>
              <p className="truncate text-xs font-bold text-accent-blue mt-0.5 whitespace-pre-wrap">{activeTask.text}</p>
            </div>
            <span className="whitespace-nowrap text-xs font-mono font-bold text-white/80 flex items-center gap-1.5 bg-accent-blue/15 px-3 py-1.5 rounded-xl border border-accent-blue/20 shadow-[0_2px_8px_rgba(0,0,0,0.15)]">
              <Target className="h-3.5 w-3.5 text-accent-blue stroke-[2.5]" />
              <span>{activeTask.actualCycles ?? 0}/{activeTask.estimatedCycles ?? 1} Pomos</span>
            </span>
          </div>
        )}

        {/* Add Task Input Form */}
        <div className="flex flex-wrap items-center gap-2.5 mb-5 bg-black/20 border border-white/5 p-2.5 rounded-2xl">
          <input
            type="text"
            value={taskText}
            onChange={e => setTaskText(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Add new focus objective..."
            className="flex-1 min-w-[200px] rounded-xl bg-white/[0.02] border border-white/5 focus:bg-white/[0.04] focus:border-white/10 px-3.5 py-2.5 text-xs text-white placeholder:text-white/20 outline-none transition-all"
          />
          
          <div className="flex items-center gap-1.5">
            <select
              value={taskCategory}
              onChange={e => setTaskCategory(e.target.value)}
              className="w-24 rounded-xl bg-white/5 border border-white/5 px-2 py-2 text-xs text-white outline-none cursor-pointer hover:bg-white/10 transition-all font-semibold"
            >
              <option value="" className="bg-[#0b0c10] text-white/60">No Subject</option>
              {categories.map(cat => (
                <option key={cat.id} value={cat.id} className="bg-[#0b0c10] text-white">{cat.name}</option>
              ))}
            </select>
            
            <select
              value={taskPriority}
              onChange={e => setTaskPriority(e.target.value as any)}
              className="w-20 rounded-xl bg-white/5 border border-white/5 px-2 py-2 text-xs text-white outline-none cursor-pointer hover:bg-white/10 transition-all font-semibold"
            >
              <option value="medium" className="bg-[#0b0c10] text-amber-400">Medium</option>
              <option value="high" className="bg-[#0b0c10] text-red-400">High</option>
              <option value="low" className="bg-[#0b0c10] text-blue-400">Low</option>
            </select>
            
            <select
              value={taskCycleCount}
              onChange={e => setTaskCycleCount(Number(e.target.value))}
              className="w-16 rounded-xl bg-white/5 border border-white/5 px-2 py-2 text-xs text-white outline-none cursor-pointer hover:bg-white/10 transition-all"
            >
              {[1,2,3,4,5,6,7,8].map(n => (
                <option key={n} value={n} className="bg-[#0b0c10]">🎯 {n}</option>
              ))}
            </select>
            
            <button
              onClick={submitNewTask}
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white/10 border border-white/10 text-white hover:bg-white/15 transition-all cursor-pointer shadow-[inset_0_1px_1px_rgba(255,255,255,0.05)] active:scale-95"
            >
              <Plus className="h-4.5 w-4.5" />
            </button>
          </div>
        </div>

        {/* Due for Review Spaced Repetition Queue */}
        {reviewQueueList.length > 0 && (
          <div className="mb-6 p-4 rounded-2xl bg-amber-500/[0.015] border border-amber-500/10 flex flex-col gap-3 shadow-[0_4px_16px_rgba(245,158,11,0.02)]">
            <div className="flex items-center justify-between border-b border-amber-500/10 pb-2">
              <div className="flex items-center gap-2">
                <Sparkles className="h-3.5 w-3.5 text-amber-400 animate-pulse" />
                <span className="text-[10px] font-bold text-amber-300 uppercase tracking-widest font-mono">Spaced Repetition due queue</span>
              </div>
              <span className="text-[9px] font-mono font-bold text-amber-400 bg-amber-500/15 border border-amber-500/20 px-2 py-0.5 rounded-full select-none">
                {reviewQueueList.length} Due
              </span>
            </div>
            
            <div className="flex flex-col gap-2 max-h-[180px] overflow-y-auto custom-scrollbar pr-1">
              {reviewQueueList.map(task => (
                <div key={task.id} className="flex flex-col md:flex-row md:items-center justify-between gap-3 bg-white/[0.01] hover:bg-white/[0.02] border border-white/5 p-3 rounded-xl transition-all duration-300">
                  <div className="flex items-center gap-2.5 min-w-0">
                    {task.categoryId !== undefined && categoriesMap.has(task.categoryId) && (
                      <span 
                        className="shrink-0 text-[8px] font-bold px-2 py-0.5 rounded-lg border text-white/95" 
                        style={{ 
                          backgroundColor: `${categoriesMap.get(task.categoryId)!.color}18`, 
                          borderColor: `${categoriesMap.get(task.categoryId)!.color}35`,
                          color: categoriesMap.get(task.categoryId)!.color
                        }}
                      >
                        {categoriesMap.get(task.categoryId)!.name}
                      </span>
                    )}
                    <span className="text-xs text-white/90 font-medium truncate select-none">{task.text}</span>
                  </div>

                  {/* Recall score grading buttons */}
                  <div className="flex items-center gap-1 shrink-0">
                    <span className="text-[8px] text-white/40 font-bold uppercase tracking-wider mr-1.5 hidden sm:inline select-none">Recall:</span>
                    {[0, 1, 2, 3, 4, 5].map(q => (
                      <button
                        key={q}
                        onClick={() => submitRecallGrade(task, q)}
                        className="h-6 w-6 rounded-lg text-[10px] font-bold font-mono bg-white/5 hover:bg-amber-500/20 text-white/70 hover:text-white border border-white/10 hover:border-amber-500/30 transition-all cursor-pointer flex items-center justify-center active:scale-90"
                        title={
                          q === 0 ? "Blackout: Forgot entirely" :
                          q === 1 ? "Incorrect: recognized but failed recall" :
                          q === 2 ? "Incorrect: easily remembered after answer check" :
                          q === 3 ? "Correct: retrieved with significant effort" :
                          q === 4 ? "Correct: recalled easily after hesitation" :
                          "Perfect: immediate recall"
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
        <div className="flex-1 overflow-y-auto max-h-[350px] custom-scrollbar flex flex-col gap-2 pr-1">
          {activeTasksList.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 border border-dashed border-white/5 rounded-2xl bg-black/10 text-center my-2 select-none">
              <span className="text-3xl mb-3 animate-pulse-soft">🎯</span>
              <p className="text-xs font-bold text-slate-350 max-w-[200px] leading-relaxed">
                Objective checklist is clear.
              </p>
              <p className="text-[9px] text-slate-650 max-w-[180px] mt-1.5 uppercase font-mono">
                Define targets to begin focus tracking.
              </p>
            </div>
          ) : (
            activeTasksList.map(task => {
              const isActive = activeTaskId === task.id
              const cat = task.categoryId !== undefined ? categoriesMap.get(task.categoryId) : undefined
              return (
                <div
                  key={task.id}
                  onClick={() => { if (!task.completed) setActiveTaskId(activeTaskId === task.id ? null : task.id!) }}
                  className={`flex flex-col gap-2 rounded-2xl px-4 py-3.5 transition-all duration-300 ease-out cursor-pointer border ${
                    isActive
                      ? 'bg-white/[0.06] shadow-lg border-white/15'
                      : 'bg-white/[0.015] border-white/5 hover:bg-white/[0.03] hover:border-white/10'
                  }`}
                  style={isActive && cat ? { borderColor: `${cat.color}40`, boxShadow: `0 0 16px ${cat.color}08` } : {}}
                >
                  <div className="flex items-center gap-3 w-full">
                    
                    {/* Checkbox */}
                    <div
                      onClick={e => { e.stopPropagation(); toggleTask(task.id!) }}
                      className={`flex h-5 w-5 shrink-0 cursor-pointer items-center justify-center rounded-lg border transition-all duration-300 ease-out bg-white/5 hover:scale-105 active:scale-95 ${
                        task.completed 
                          ? 'border-accent-green bg-accent-green/10 text-accent-green shadow-[0_0_8px_rgba(22,163,74,0.2)]'
                          : 'border-white/10 hover:border-white/20 hover:bg-white/10'
                      }`}
                    >
                      {task.completed && <Check className="h-3.5 w-3.5 stroke-[2.5]" />}
                    </div>
                    
                    {/* Subject tag */}
                    {cat && (
                      <span 
                        className="shrink-0 text-[8px] font-bold px-2 py-0.5 rounded-lg border text-white/90 font-mono uppercase tracking-wider" 
                        style={{ 
                          backgroundColor: `${cat.color}15`, 
                          borderColor: `${cat.color}30`,
                          color: cat.color
                        }}
                      >
                        {cat.name}
                      </span>
                    )}

                    {/* Priority Indicator Tag */}
                    {task.priority && (
                      <span className={`shrink-0 text-[8px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-lg border font-mono ${
                        task.priority === 'high' 
                          ? 'bg-red-500/10 text-red-400 border-red-500/20 shadow-[0_0_8px_rgba(239,68,68,0.1)]' 
                          : task.priority === 'low' 
                          ? 'bg-blue-500/10 text-blue-400 border-blue-500/20' 
                          : 'bg-white/5 text-white/50 border-white/10'
                      }`}>
                        {task.priority}
                      </span>
                    )}

                    {/* Task Content text */}
                    <span className={`flex-1 truncate text-xs font-semibold select-none transition-colors ${
                      isActive ? 'text-white' : 'text-white/80'
                    }`}>
                      {task.text}
                    </span>

                    {/* Cycles metrics */}
                    <span className="shrink-0 text-[9px] font-mono font-bold text-white/50 flex items-center gap-1.5 bg-white/5 px-2.5 py-1 rounded-lg border border-white/10">
                      <Target className="h-3 w-3 text-white/60" />
                      <span>{task.actualCycles ?? 0}/{task.estimatedCycles ?? 1} Cycles</span>
                    </span>
                  </div>
                </div>
              )
            })
          )}
        </div>
        
      </div>
    </div>
  )
}
