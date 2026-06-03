import React, { useMemo, useState } from 'react'
import { Plus, Check, Target, AlertCircle } from 'lucide-react'
import type { TaskItem, CategoryItem } from '../db/types'

interface TaskRegistryProps {
  tasks: TaskItem[]
  categories: CategoryItem[]
  activeTaskId: number | null
  setActiveTaskId: (id: number | null) => void
  toggleTask: (id: number) => Promise<void>
  handleAddTask: (text: string, categoryId?: number, estimatedCycles?: number, priority?: 'low' | 'medium' | 'high', isStudySubject?: boolean) => void
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
  const [taskIsStudySubject, setTaskIsStudySubject] = useState(false)

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
    return tasks.filter(t => t.completed && t.isStudySubject && (!t.nextReviewDate || t.nextReviewDate <= todayStr))
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
    handleAddTask(trimmed, catId, taskCycleCount, taskPriority, taskIsStudySubject)
    setTaskText('')
    setTaskIsStudySubject(false)
  }

  const activeTask = useMemo(() => {
    if (activeTaskId === null) return null
    return tasks.find(t => t.id === activeTaskId && !t.completed) || null
  }, [activeTaskId, tasks])

  return (
    <div className="flex flex-col gap-6 h-full w-full">
      <div className="border border-white/5 bg-white/[0.02] rounded-[28px] p-5 md:p-6 flex flex-col h-full shadow-2xl backdrop-blur-3xl">
        
        {/* Header Section */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-5 border-b border-white/5 pb-4">
          <div className="select-none">
            <span className="text-[9px] font-bold uppercase tracking-wider text-white/40">02 / Study Objectives</span>
            <p className="text-sm font-bold text-white mt-1">Focus Registry</p>
          </div>
          
          {timerMode === 'study' && (
            <div className="flex items-center gap-2.5">
              <span className="text-[9px] font-bold text-white/40 uppercase tracking-wide select-none">Subject Focus:</span>
              <select
                value={timerCategoryId ?? ''}
                onChange={e => setTimerCategoryId(e.target.value ? Number(e.target.value) : undefined)}
                className="rounded-full border border-white/10 bg-white/5 px-3.5 py-1.5 text-xs font-bold text-white outline-none cursor-pointer hover:bg-white/10 transition-colors"
              >
                <option value="" className="bg-[#11131e] text-white/40">General / None</option>
                {categories.map(cat => (
                  <option key={cat.id} value={cat.id} className="bg-[#11131e] text-white">{cat.name}</option>
                ))}
              </select>
            </div>
          )}
        </div>

        {/* Active Task Target Indicator */}
        {activeTask && (
          <div className="mb-5 flex items-center gap-3.5 rounded-[20px] border border-white/5 bg-black/20 p-4 shadow-md animate-slide-in-up">
            <div className="h-2 w-2 rounded-full bg-accent-blue" />
            <div className="flex-1 min-w-0">
              <p className="text-[9px] uppercase font-bold text-white/40">Active Target</p>
              <p className="truncate text-xs font-bold text-white mt-0.5 whitespace-pre-wrap">{activeTask.text}</p>
            </div>
            <span className="whitespace-nowrap text-xs font-mono font-bold text-white/75 flex items-center gap-1.5 bg-white/10 px-3 py-1.5 rounded-full border border-white/5">
              <Target className="h-3.5 w-3.5 text-white/40" />
              <span>{activeTask.actualCycles ?? 0}/{activeTask.estimatedCycles ?? 1}</span>
            </span>
          </div>
        )}

        {/* Add Task Input Form */}
        <div className="flex flex-wrap items-center gap-2 mb-5 bg-black/20 border border-white/5 p-2 rounded-[20px]">
          <input
            type="text"
            value={taskText}
            onChange={e => setTaskText(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Create focus target..."
            className="flex-1 min-w-[200px] rounded-lg bg-transparent px-3 py-2 text-xs text-white placeholder:text-white/20 outline-none font-semibold"
          />
          
          <div className="flex items-center gap-1.5">
            <select
              value={taskCategory}
              onChange={e => setTaskCategory(e.target.value)}
              className="rounded-full bg-white/5 border border-white/10 px-3.5 py-2 text-[10px] text-white/80 outline-none cursor-pointer hover:bg-white/10 transition-colors font-semibold"
            >
              <option value="" className="bg-[#11131e] text-white/40">No Subject</option>
              {categories.map(cat => (
                <option key={cat.id} value={cat.id} className="bg-[#11131e] text-white">{cat.name}</option>
              ))}
            </select>
            
            <select
              value={taskPriority}
              onChange={e => setTaskPriority(e.target.value as 'low' | 'medium' | 'high')}
              className="rounded-full bg-white/5 border border-white/10 px-3.5 py-2 text-[10px] text-white/80 outline-none cursor-pointer hover:bg-white/10 transition-colors font-semibold"
            >
              <option value="medium" className="bg-[#11131e] text-accent-amber">Medium</option>
              <option value="high" className="bg-[#11131e] text-red-400 font-semibold">High</option>
              <option value="low" className="bg-[#11131e] text-accent-blue">Low</option>
            </select>
            
            <select
              value={taskCycleCount}
              onChange={e => setTaskCycleCount(Number(e.target.value))}
              className="rounded-full bg-white/5 border border-white/10 px-3.5 py-2 text-[10px] text-white/80 outline-none cursor-pointer hover:bg-white/10 transition-colors font-bold"
            >
              {[1,2,3,4,5,6,7,8].map(n => (
                <option key={n} value={n} className="bg-[#11131e]">🎯 {n}</option>
              ))}
            </select>

            <button
              type="button"
              onClick={() => setTaskIsStudySubject(!taskIsStudySubject)}
              className={`rounded-full border px-3 py-2 text-[10px] font-semibold transition-all cursor-pointer ios-active-scale ${
                taskIsStudySubject
                  ? 'bg-accent-purple/15 text-accent-purple border-accent-purple/30'
                  : 'bg-white/5 text-white/60 border-white/10 hover:text-white'
              }`}
              title="Toggle Spaced Repetition review schedule on completion"
            >
              🔄 SR Review
            </button>
            
            <button
              onClick={submitNewTask}
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-accent-blue hover:bg-accent-blue/90 text-white transition-all ios-active-scale cursor-pointer shadow-md shadow-accent-blue/15"
            >
              <Plus className="h-4.5 w-4.5" />
            </button>
          </div>
        </div>

        {/* Due for Review Spaced Repetition Queue */}
        {reviewQueueList.length > 0 && (
          <div className="mb-6 p-4 rounded-[20px] bg-black/20 border border-white/5 flex flex-col gap-3 shadow-md animate-slide-in-up">
            <div className="flex items-center justify-between border-b border-white/5 pb-2">
              <span className="text-[9.5px] font-bold text-white/40 uppercase tracking-wider">Spaced Repetition Review</span>
              <span className="text-[8.5px] font-bold text-accent-amber bg-accent-amber/10 border border-accent-amber/20 px-2.5 py-0.5 rounded-full select-none">
                {reviewQueueList.length} Due
              </span>
            </div>
            
            <div className="flex flex-col gap-1 max-h-[185px] overflow-y-auto custom-scrollbar pr-1">
              {reviewQueueList.map(task => (
                <div key={task.id} className="flex flex-col md:flex-row md:items-center justify-between gap-3 py-2 border-b border-white/5 last:border-b-0 hover:bg-white/[0.03] px-1 rounded-xl transition-colors duration-200">
                  <div className="flex items-center gap-2.5 min-w-0">
                    {task.categoryId !== undefined && categoriesMap.has(task.categoryId) && (
                      <span 
                        className="shrink-0 text-[8px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border" 
                        style={{ 
                          backgroundColor: `${categoriesMap.get(task.categoryId)!.color}10`, 
                          borderColor: `${categoriesMap.get(task.categoryId)!.color}20`,
                          color: categoriesMap.get(task.categoryId)!.color
                        }}
                      >
                        {categoriesMap.get(task.categoryId)!.name}
                      </span>
                    )}
                    <span className="text-xs text-white/90 font-semibold truncate select-none">{task.text}</span>
                  </div>

                  {/* Recall score grading buttons */}
                  <div className="flex items-center gap-1 shrink-0">
                    <span className="text-[8px] text-white/40 font-bold uppercase tracking-wider mr-1.5 hidden sm:inline select-none">Recall:</span>
                    {[0, 1, 2, 3, 4, 5].map(q => (
                      <button
                        key={q}
                        onClick={() => submitRecallGrade(task, q)}
                        className="h-6 w-6 rounded-full text-[9px] font-bold font-mono bg-white/5 hover:bg-white/10 text-white/80 border border-white/10 transition-all ios-active-scale cursor-pointer flex items-center justify-center"
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

        {/* Active Objectives Scroll List (Clean borderless table items) */}
        <div className="flex-1 overflow-y-auto max-h-[350px] custom-scrollbar flex flex-col pr-1">
          {activeTasksList.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 border border-dashed border-white/10 rounded-[24px] bg-black/20 text-center my-2 select-none animate-fade-in">
              <div className="flex h-10 w-10 items-center justify-center rounded-[10px] bg-white/5 mb-3 text-white/40">
                <AlertCircle className="h-5 w-5" />
              </div>
              <p className="text-xs font-bold text-white/60">
                Objectives list is clear
              </p>
              <p className="text-[8.5px] text-white/30 uppercase tracking-wider mt-1.5 font-bold">
                Define targets to begin focus tracking
              </p>
            </div>
          ) : (
            <div className="flex flex-col">
              {activeTasksList.map(task => {
                const isActive = activeTaskId === task.id
                const cat = task.categoryId !== undefined ? categoriesMap.get(task.categoryId) : undefined
                return (
                  <div
                    key={task.id}
                    onClick={() => { if (!task.completed) setActiveTaskId(activeTaskId === task.id ? null : task.id!) }}
                    className={`flex items-center justify-between gap-3.5 py-3.5 border-b border-white/5 last:border-b-0 px-3.5 rounded-2xl transition-colors duration-200 cursor-pointer ${
                      isActive
                        ? 'bg-white/10'
                        : 'hover:bg-white/[0.03]'
                    }`}
                  >
                    <div className="flex items-center gap-3 w-full min-w-0">
                      
                      {/* Checkbox */}
                      <div
                        onClick={e => { e.stopPropagation(); toggleTask(task.id!) }}
                        className={`flex h-5 w-5 shrink-0 cursor-pointer items-center justify-center rounded-full border transition-all duration-250 ease-out ios-active-scale ${
                          task.completed 
                            ? 'border-accent-green bg-accent-green text-white shadow-sm'
                            : 'border-white/20 hover:border-accent-blue hover:bg-white/5'
                        }`}
                      >
                        {task.completed && <Check className="h-3 w-3 stroke-[2.5]" />}
                      </div>
                      
                      {/* Subject tag */}
                      {cat && (
                        <span 
                          className="shrink-0 text-[8px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full border" 
                          style={{ 
                            backgroundColor: 'transparent', 
                            borderColor: cat.color,
                            color: cat.color
                          }}
                        >
                          {cat.name}
                        </span>
                      )}

                      {/* Priority Indicator Tag */}
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

                      {/* Task Content text */}
                      <span className={`flex-1 truncate text-xs font-semibold select-none transition-colors ${
                        isActive ? 'text-white' : 'text-white/80'
                      }`}>
                        {task.text}
                      </span>
                    </div>

                    {/* Cycles metrics */}
                    <span className="shrink-0 text-[9px] font-mono font-bold text-white/60 flex items-center gap-1 bg-white/5 px-2.5 py-1 rounded-full border border-white/5">
                      <Target className="h-3.5 w-3.5 text-white/30" />
                      <span>{task.actualCycles ?? 0}/{task.estimatedCycles ?? 1}</span>
                    </span>
                  </div>
                )
              })}
            </div>
          )}
        </div>
        
      </div>
    </div>
  )
}
