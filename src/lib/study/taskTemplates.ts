import type { SubTask } from '../../db/types'

export interface TaskTemplate {
  id: string
  text: string
  estimatedCycles: number
  categoryId?: number
  priority?: 'low' | 'medium' | 'high'
  isStudySubject?: boolean
  subtasks?: SubTask[]
}

const STORAGE_KEY = 'task_templates'

export function loadTaskTemplates(): TaskTemplate[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as unknown
    if (!Array.isArray(parsed)) return []
    return parsed.filter(
      (t): t is TaskTemplate =>
        typeof t === 'object' &&
        t !== null &&
        typeof (t as TaskTemplate).id === 'string' &&
        typeof (t as TaskTemplate).text === 'string' &&
        typeof (t as TaskTemplate).estimatedCycles === 'number',
    )
  } catch {
    return []
  }
}

export function saveTaskTemplates(templates: TaskTemplate[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(templates))
}

export function addTaskTemplate(template: Omit<TaskTemplate, 'id'>): TaskTemplate[] {
  const next: TaskTemplate = { ...template, id: crypto.randomUUID() }
  const templates = [...loadTaskTemplates(), next]
  saveTaskTemplates(templates)
  return templates
}

export function deleteTaskTemplate(id: string): TaskTemplate[] {
  const templates = loadTaskTemplates().filter(t => t.id !== id)
  saveTaskTemplates(templates)
  return templates
}
