import type { Flashcard, StudyData, StudyGoal, StudySession, StudySubject } from './db/types'

export type WeeklyStudyDay = {
  key: string
  label: string
  hours: number
}

export type SearchResult = {
  id: string
  type: 'Task' | 'Note' | 'Subject' | 'Event' | 'Flashcard'
  title: string
  meta: string
  view: 'Tasks' | 'Notes' | 'Subjects' | 'Calendar' | 'Flashcards'
}

export function getTodayFocusMinutes(sessions: StudySession[]) {
  const today = new Date().toISOString().slice(0, 10)
  return sessions.filter((session) => session.endedAt.slice(0, 10) === today).reduce((sum, session) => sum + session.minutes, 0)
}

export function getSubjectStudyMinutes(subjectId: string, sessions: StudySession[]) {
  return sessions.filter((session) => session.subjectId === subjectId).reduce((sum, session) => sum + session.minutes, 0)
}

export function getSubjectProgress(subject: StudySubject, sessions: StudySession[]) {
  const targetMinutes = Math.max(1, subject.targetHours * 60)
  const loggedMinutes = getSubjectStudyMinutes(subject.id, sessions)
  return loggedMinutes > 0 ? percent(loggedMinutes, targetMinutes) : subject.progress
}

export function getGoalProgress(goal: StudyGoal, todayFocusMinutes: number, weeklyStudyHours: number) {
  const title = goal.title.toLowerCase()
  if (goal.period === 'daily' && title.includes('focus')) return clamp(todayFocusMinutes, 0, goal.target)
  if (goal.period === 'weekly' && (title.includes('study') || title.includes('focus'))) return clamp(Math.round(weeklyStudyHours), 0, goal.target)
  return goal.progress
}

export function isDerivedGoal(goal: StudyGoal) {
  const title = goal.title.toLowerCase()
  return (goal.period === 'daily' && title.includes('focus')) || (goal.period === 'weekly' && (title.includes('study') || title.includes('focus')))
}

export function isFlashcardDue(card: Flashcard, now = new Date()) {
  if (!card.dueAt) return true
  return new Date(card.dueAt).getTime() <= now.getTime()
}

export function nextFlashcardSchedule(card: Flashcard, result: 'learning' | 'remembered', now = new Date()) {
  const previousInterval = Math.max(0, card.intervalDays ?? 0)
  const intervalDays = result === 'learning' ? 1 : previousInterval > 0 ? Math.min(previousInterval * 2, 30) : 3
  const due = new Date(now)
  due.setDate(due.getDate() + intervalDays)
  return {
    intervalDays,
    dueAt: due.toISOString(),
    reviewCount: (card.reviewCount ?? 0) + 1,
  }
}

export function formatFlashcardDue(card: Flashcard, now = new Date()) {
  if (isFlashcardDue(card, now)) return 'Due now'
  if (!card.dueAt) return 'Due now'
  return `Next review ${formatDate(card.dueAt)}`
}

export function getWeeklyStudyDays(sessions: StudySession[]): WeeklyStudyDay[] {
  const today = new Date()
  return Array.from({ length: 7 }, (_, index) => {
    const date = new Date(today)
    date.setDate(today.getDate() - (6 - index))
    const key = date.toISOString().slice(0, 10)
    return {
      key,
      label: new Intl.DateTimeFormat('en-US', { weekday: 'short' }).format(date),
      hours: sessions.filter((session) => session.endedAt.slice(0, 10) === key).reduce((sum, session) => sum + session.minutes, 0) / 60,
    }
  })
}

export function buildSearchResults(data: StudyData, subjectMap: Map<string, StudySubject>, query: string): SearchResult[] {
  const normalized = query.trim().toLowerCase()
  if (!normalized) return []

  const subjectName = (subjectId: string) => subjectMap.get(subjectId)?.name ?? 'General'
  const matches = (...values: Array<string | number>) => values.join(' ').toLowerCase().includes(normalized)

  return [
    ...data.tasks
      .filter((task) => matches(task.title, task.priority, task.status, subjectName(task.subjectId)))
      .map((task): SearchResult => ({ id: task.id, type: 'Task', title: task.title, meta: `${subjectName(task.subjectId)} - ${task.status}`, view: 'Tasks' })),
    ...data.notes
      .filter((note) => matches(note.title, note.body, note.tags.join(' '), subjectName(note.subjectId)))
      .map((note): SearchResult => ({ id: note.id, type: 'Note', title: note.title, meta: subjectName(note.subjectId), view: 'Notes' })),
    ...data.subjects
      .filter((subject) => matches(subject.name, subject.progress, subject.targetHours))
      .map((subject): SearchResult => ({ id: subject.id, type: 'Subject', title: subject.name, meta: `${subject.progress}% progress`, view: 'Subjects' })),
    ...data.events
      .filter((event) => matches(event.title, event.location, subjectName(event.subjectId)))
      .map((event): SearchResult => ({ id: event.id, type: 'Event', title: event.title, meta: `${formatDateTime(event.startAt)} - ${subjectName(event.subjectId)}`, view: 'Calendar' })),
    ...data.flashcards
      .filter((card) => matches(card.front, card.back, card.status, subjectName(card.subjectId)))
      .map((card): SearchResult => ({ id: card.id, type: 'Flashcard', title: card.front, meta: `${subjectName(card.subjectId)} - ${card.status}`, view: 'Flashcards' })),
  ].slice(0, 8)
}

export function calculateStreak(sessions: StudySession[]) {
  const daysWithSessions = new Set(sessions.map((session) => session.endedAt.slice(0, 10)))
  let streak = 0
  const cursor = new Date()
  while (daysWithSessions.has(cursor.toISOString().slice(0, 10))) {
    streak += 1
    cursor.setDate(cursor.getDate() - 1)
  }
  return streak
}

export function startOfToday() {
  const date = new Date()
  date.setHours(0, 0, 0, 0)
  return date.getTime()
}

export function todayInputValue() {
  return toInputDate(new Date())
}

export function toInputDate(date: Date) {
  return date.toISOString().slice(0, 10)
}

export function toInputTime(date: Date) {
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`
}

export function parseTags(value: string) {
  return value.split(',').map((tag) => tag.trim()).filter(Boolean)
}

export function formatMinutes(minutes: number) {
  const hours = Math.floor(minutes / 60)
  const rest = minutes % 60
  if (hours === 0) return `${rest}m`
  return rest === 0 ? `${hours}h` : `${hours}h ${rest}m`
}

export function formatHours(hours: number) {
  const fullHours = Math.floor(hours)
  const minutes = Math.round((hours - fullHours) * 60)
  return minutes === 0 ? `${fullHours}h` : `${fullHours}h ${minutes}m`
}

export function formatElapsed(seconds: number) {
  const minutes = Math.floor(seconds / 60)
  const rest = seconds % 60
  return `${String(minutes).padStart(2, '0')}:${String(rest).padStart(2, '0')}`
}

export function formatDate(value: string) {
  return value ? new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' }).format(new Date(value)) : 'Today'
}

export function formatDateTime(value: string) {
  return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }).format(new Date(value))
}

export function formatShortTime(value: string) {
  return new Intl.DateTimeFormat('en-US', { hour: 'numeric', minute: '2-digit' }).format(new Date(value))
}

export function linePoints(values: number[]) {
  return values.map((value, index) => `${index * 52 + 24},${146 - Math.min(value, 8) * 16}`).join(' ')
}

export function percent(value: number, total: number) {
  if (total <= 0) return 0
  return clamp((value / total) * 100, 0, 100)
}

export function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, Number.isFinite(value) ? value : min))
}
