import type { CategoryItem, DailyLog, TaskItem } from '../../db/types'

export function escapeCsvField(value: string): string {
  const needsFormulaGuard = /^[=+\-@]/.test(value)
  const sanitized = needsFormulaGuard ? `'${value}` : value
  return `"${sanitized.replace(/"/g, '""')}"`
}

export function buildStudyLogsCsv(logs: DailyLog[]): string {
  let csv = 'Date,Study Minutes,Break Minutes,Mood,Notes\n'
  logs.forEach(l => {
    const notes = l.notes ? escapeCsvField(l.notes) : ''
    csv += `${l.dateString},${l.studyMinutes},${l.breakMinutes},${l.mood || ''},${notes}\n`
  })
  return csv
}

export function buildTaskCompletionCsv(tasks: TaskItem[], categories: CategoryItem[]): string {
  const catMap = new Map(categories.map(c => [c.id, c.name]))
  let csv = 'Task ID,Task Text,Status,Priority,Category,Created At,Estimated Cycles,Actual Cycles,Subtasks Progress,Subtasks Detail\n'
  tasks.forEach(t => {
    const text = t.text ? escapeCsvField(t.text) : ''
    const status = t.completed ? 'Completed' : 'Active'
    const priority = t.priority || 'medium'
    const category = t.categoryId ? (catMap.get(t.categoryId) || '') : ''
    const dateStr = new Date(t.createdAt).toISOString().slice(0, 10)
    const subtasksCount = t.subtasks?.length || 0
    const subtasksCompleted = t.subtasks?.filter(s => s.completed).length || 0
    const progress = subtasksCount > 0 ? `${subtasksCompleted}/${subtasksCount}` : 'N/A'
    const detail = t.subtasks ? `"${t.subtasks.map(s => `[${s.completed ? 'x' : ' '}] ${s.text}`).join('; ').replace(/"/g, '""')}"` : ''
    csv += `${t.id || ''},${text},${status},${priority},${category},${dateStr},${t.estimatedCycles},${t.actualCycles},${progress},${detail}\n`
  })
  return csv
}

export function downloadCsvBlob(csv: string, filename: string): void {
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}
