import React from 'react'
import { Plus } from 'lucide-react'
import type { CategoryItem } from '../../db/types'

interface TaskCreateFormProps {
  taskText: string
  setTaskText: (v: string) => void
  taskCategory: string
  setTaskCategory: (v: string) => void
  taskPriority: 'low' | 'medium' | 'high'
  setTaskPriority: (v: 'low' | 'medium' | 'high') => void
  taskCycleCount: number
  setTaskCycleCount: (n: number) => void
  taskIsStudySubject: boolean
  setTaskIsStudySubject: (v: boolean) => void
  categories: CategoryItem[]
  onSubmit: () => void
}

export function TaskCreateForm({
  taskText,
  setTaskText,
  taskCategory,
  setTaskCategory,
  taskPriority,
  setTaskPriority,
  taskCycleCount,
  setTaskCycleCount,
  taskIsStudySubject,
  setTaskIsStudySubject,
  categories,
  onSubmit,
}: TaskCreateFormProps) {
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') onSubmit()
  }

  return (
    <div className="flex flex-wrap items-center gap-2 mb-5 bg-black/20 border border-white/5 p-2 rounded-[20px]">
      <input
        type="text"
        value={taskText}
        onChange={e => setTaskText(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="What do you want to focus on?"
        className="flex-1 min-w-[200px] rounded-xl bg-transparent px-4 py-3 text-sm text-white placeholder:text-white/30 outline-none font-semibold"
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
          aria-label="Task priority"
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
          {[1, 2, 3, 4, 5, 6, 7, 8].map(n => (
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
          type="button"
          onClick={onSubmit}
          aria-label="Add task"
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-accent-blue hover:bg-accent-blue/90 text-white transition-all ios-active-scale cursor-pointer shadow-md shadow-accent-blue/15"
        >
          <Plus className="h-4.5 w-4.5" />
        </button>
      </div>
    </div>
  )
}
