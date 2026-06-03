import React, { useMemo, useState } from 'react'
import { Plus, Check, Target, Sparkles, AlertCircle } from 'lucide-react'
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
      <div className="border border-white/[0.08] bg-gradient-to-br from-white/[0.02] to-white/[0.005] dynamic-card p-5 md:p-6 flex flex-col h-full shadow-[inset_0_1px_1px_rgba(255,255,255,0.08),0_24px_48px_rgba(0,0,0,0.4)]">
        
        {/* Header Section */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-5 border-b border-white/[0.06] pb-4">
          <div className="select-none">
            <span className="font-mono text-[9px] font-black uppercase tracking-widest text-white/50">02 / ACTIVE REGISTRY</span>
            <p className="text-sm font-bold text-white mt-1">Study Objectives</p>
          </div>
          
          {timerMode === 'study' && (
            <div className="flex items-center gap-2.5">
              <span className="text-[8.5px] font-black text-white/40 uppercase font-mono tracking-widest select-none">Focus Focus:</span>
              <select
                value={timerCategoryId ?? ''}
                onChange={e => setTimerCategoryId(e.target.value ? Number(e.target.value) : undefined)}
                className="rounded-xl border border-white/10 bg-black/40 hover:bg-black/60 px-3.5 py-2 text-xs font-semibold text-white outline-none focus:border-white/20 cursor-pointer transition-all"
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
          <div className="mb-5 flex items-center gap-3.5 rounded-2xl border border-accent-blue/30 bg-accent-blue/5 p-4 shadow-[0_0_20px_rgba(6,182,212,0.08)] animate-slide-in-up">
            <div className="relative flex h-3 w-3 shrink-0 items-center justify-center">
              <div className="absolute h-full w-full rounded-full bg-accent-blue animate-ping opacity-75" />
              <div className="h-2 w-2 rounded-full bg-accent-blue shadow-[0_0_8px_var(--color-accent-blue)]" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[8px] uppercase font-mono font-black tracking-widest text-slate-500">Current Active Target</p>
              <p className="truncate text-xs font-extrabold text-accent-blue mt-1 whitespace-pre-wrap">{activeTask.text}</p>
            </div>
            <span className="whitespace-nowrap text-xs font-mono font-black text-white/95 flex items-center gap-2 bg-accent-blue/15 px-3.5 py-2 rounded-xl border border-accent-blue/20 shadow-[0_2px_12px_rgba(0,0,0,0.3)]">
              <Target className="h-4 w-4 text-accent-blue stroke-[2.5]" />
              <span>{activeTask.actualCycles ?? 0}/{activeTask.estimatedCycles ?? 1} Cycles</span>
            </span>
          </div>
        )}

        {/* Add Task Input Form */}
        <div className="flex flex-wrap items-center gap-2.5 mb-5 bg-black/25 border border-white/5 p-2.5 rounded-2xl shadow-[inset_0_1px_2px_rgba(0,0,0,0.4)]">
          <input
            type="text"
            value={taskText}
            onChange={e => setTaskText(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Create focus objective..."
            className="flex-1 min-w-[200px] rounded-xl bg-white/[0.02] border border-white/5 focus:bg-white/[0.05] focus:border-white/15 px-3.5 py-2.5 text-xs text-white placeholder:text-white/20 outline-none transition-all duration-300 font-semibold"
          />
          
          <div className="flex items-center gap-2">
            <select
              value={taskCategory}
              onChange={e => setTaskCategory(e.target.value)}
              className="w-24 rounded-xl bg-white/5 border border-white/5 px-2.5 py-2.5 text-xs text-white outline-none cursor-pointer hover:bg-white/10 hover:border-white/10 transition-all font-semibold"
            >
              <option value="" className="bg-[#0b0c10] text-white/60">No Category</option>
              {categories.map(cat => (
                <option key={cat.id} value={cat.id} className="bg-[#0b0c10] text-white">{cat.name}</option>
              ))}
            </select>
            
            <select
              value={taskPriority}
              onChange={e => setTaskPriority(e.target.value as any)}
              className="w-22 rounded-xl bg-white/5 border border-white/5 px-2.5 py-2.5 text-xs text-white outline-none cursor-pointer hover:bg-white/10 hover:border-white/10 transition-all font-semibold"
            >
              <option value="medium" className="bg-[#0b0c10] text-amber-400">Medium</option>
              <option value="high" className="bg-[#0b0c10] text-red-400">High</option>
              <option value="low" className="bg-[#0b0c10] text-blue-400">Low</option>
            </select>
            
            <select
              value={taskCycleCount}
              onChange={e => setTaskCycleCount(Number(e.target.value))}
              className="w-18 rounded-xl bg-white/5 border border-white/5 px-2.5 py-2.5 text-xs text-white outline-none cursor-pointer hover:bg-white/10 hover:border-white/10 transition-all font-bold"
            >
              {[1,2,3,4,5,6,7,8].map(n => (
                <option key={n} value={n} className="bg-[#0b0c10]">🎯 {n}</option>
              ))}
            </select>
            
            <button
              onClick={submitNewTask}
              className="flex h-9.5 w-9.5 shrink-0 items-center justify-center rounded-xl bg-white/10 border border-white/10 text-white hover:bg-white/15 hover:border-white/20 transition-all cursor-pointer shadow-[inset_0_1px_1px_rgba(255,255,255,0.1)] active:scale-90"
            >
              <Plus className="h-5 w-5 stroke-[2.5]" />
            </button>
          </div>
        </div>

        {/* Due for Review Spaced Repetition Queue */}
        {reviewQueueList.length > 0 && (
          <div className="mb-6 p-4 rounded-2xl bg-amber-500/[0.01] border border-amber-500/15 flex flex-col gap-3 shadow-[0_4px_24px_rgba(245,158,11,0.03)] animate-slide-in-up">
            <div className="flex items-center justify-between border-b border-amber-500/15 pb-2.5">
              <div className="flex items-center gap-2 select-none">
                <Sparkles className="h-4 w-4 text-amber-400 animate-pulse" />
                <span className="text-[9.5px] font-mono font-black text-amber-300 uppercase tracking-widest">Active Recall due list</span>
              </div>
              <span className="text-[8.5px] font-mono font-black text-amber-400 bg-amber-500/20 border border-amber-500/30 px-2.5 py-0.5 rounded-full select-none shadow-[0_2px_8px_rgba(0,0,0,0.2)]">
                {reviewQueueList.length} Due Tasks
              </span>
            </div>
            
            <div className="flex flex-col gap-2 max-h-[180px] overflow-y-auto custom-scrollbar pr-1">
              {reviewQueueList.map(task => (
                <div key={task.id} className="flex flex-col md:flex-row md:items-center justify-between gap-3 bg-white/[0.01] hover:bg-white/[0.025] border border-white/5 p-3 rounded-xl transition-all duration-300">
                  <div className="flex items-center gap-2.5 min-w-0">
                    {task.categoryId !== undefined && categoriesMap.has(task.categoryId) && (
                      <span 
                        className="shrink-0 text-[8px] font-mono font-black uppercase tracking-wider px-2 py-0.5 rounded-lg border" 
                        style={{ 
                          backgroundColor: `${categoriesMap.get(task.categoryId)!.color}15`, 
                          borderColor: `${categoriesMap.get(task.categoryId)!.color}30`,
                          color: categoriesMap.get(task.categoryId)!.color
                        }}
                      >
                        {categoriesMap.get(task.categoryId)!.name}
                      </span>
                    )}
                    <span className="text-xs text-white/95 font-semibold truncate select-none">{task.text}</span>
                  </div>

                  {/* Recall score grading buttons */}
                  <div className="flex items-center gap-1 shrink-0">
                    <span className="text-[8px] text-white/40 font-mono font-black uppercase tracking-widest mr-1.5 hidden sm:inline select-none">Recall grade:</span>
                    {[0, 1, 2, 3, 4, 5].map(q => (
                      <button
                        key={q}
                        onClick={() => submitRecallGrade(task, q)}
                        className="h-6 w-6 rounded-lg text-[10px] font-bold font-mono bg-white/5 hover:bg-amber-500/20 text-white/70 hover:text-white border border-white/10 hover:border-amber-500/35 transition-all cursor-pointer flex items-center justify-center active:scale-85"
                        title={
                          q === 0 ? "Forgot completely (Blackout)" :
                          q === 1 ? "Incorrect: recognized but failed recall" :
                          q === 2 ? "Incorrect: remembered with hints" :
                          q === 3 ? "Correct: recalled with difficulty" :
                          q === 4 ? "Correct: recalled easily" :
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
        <div className="flex-1 overflow-y-auto max-h-[350px] custom-scrollbar flex flex-col gap-2.5 pr-1">
          {activeTasksList.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 border border-dashed border-white/5 rounded-2xl bg-black/15 text-center my-2 select-none animate-fade-in">
              <div className="relative flex h-14 w-14 items-center justify-center rounded-2xl bg-white/[0.02] border border-white/5 mb-4 shadow-[0_4px_12px_rgba(0,0,0,0.1)]">
                <AlertCircle className="h-6 w-6 text-white/20" />
              </div>
              <p className="text-xs font-black text-slate-300 tracking-wide">
                Objectives list is clear
              </p>
              <p className="text-[8.5px] text-slate-500 max-w-[200px] mt-2 uppercase font-mono tracking-widest">
                Define targets to begin focus tracking
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
                      ? 'bg-white/[0.07] border-white/20 shadow-[0_8px_24px_-8px_rgba(0,0,0,0.4)] scale-[1.005]'
                      : 'bg-white/[0.015] border-white/5 hover:bg-white/[0.035] hover:border-white/12'
                  }`}
                  style={isActive && cat ? { borderColor: `${cat.color}45`, boxShadow: `0 0 20px ${cat.color}08` } : {}}
                >
                  <div className="flex items-center gap-3.5 w-full">
                    
                    {/* Checkbox */}
                    <div
                      onClick={e => { e.stopPropagation(); toggleTask(task.id!) }}
                      className={`flex h-5 w-5 shrink-0 cursor-pointer items-center justify-center rounded-lg border transition-all duration-300 ease-out bg-white/5 hover:scale-110 active:scale-90 ${
                        task.completed 
                          ? 'border-accent-green bg-accent-green/20 text-accent-green shadow-[0_0_10px_rgba(16,185,129,0.3)]'
                          : 'border-white/10 hover:border-white/20 hover:bg-white/10'
                      }`}
                    >
                      {task.completed && <Check className="h-3.5 w-3.5 stroke-[3]" />}
                    </div>
                    
                    {/* Subject tag */}
                    {cat && (
                      <span 
                        className="shrink-0 text-[8px] font-mono font-black uppercase tracking-widest px-2 py-0.5 rounded-lg border text-white/90" 
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
                      <span className={`shrink-0 text-[8px] font-mono font-black uppercase tracking-widest px-2 py-0.5 rounded-lg border ${
                        task.priority === 'high' 
                          ? 'bg-red-500/10 text-red-400 border-red-500/25 shadow-[0_0_8px_rgba(239,68,68,0.15)]' 
                          : task.priority === 'low' 
                          ? 'bg-blue-500/10 text-blue-400 border-blue-500/25' 
                          : 'bg-white/5 text-white/50 border-white/10'
                      }`}>
                        {task.priority}
                      </span>
                    )}

                    {/* Task Content text */}
                    <span className={`flex-1 truncate text-xs font-bold select-none transition-colors leading-none ${
                      isActive ? 'text-white' : 'text-white/80'
                    }`}>
                      {task.text}
                    </span>

                    {/* Cycles metrics */}
                    <span className="shrink-0 text-[9px] font-mono font-bold text-white/60 flex items-center gap-1.5 bg-white/5 px-2.5 py-1.5 rounded-xl border border-white/10 shadow-[0_2px_6px_rgba(0,0,0,0.15)]">
                      <Target className="h-3.5 w-3.5 text-white/40" />
                      <span>{task.actualCycles ?? 0}/{task.estimatedCycles ?? 1} cycles</span>
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
