import type { Flashcard, GoalMetric, GoalPeriod, StudyData, StudyGoal, StudySession, StudySubject } from './db/types'

export type WeeklyStudyDay = {
  key: string
  label: string
  hours: number
}

export type StudySessionGroup = {
  key: string
  label: string
  sessions: StudySession[]
}

export type SearchResult = {
  id: string
  type: 'Task' | 'Note' | 'Subject' | 'Event' | 'Flashcard'
  title: string
  meta: string
  view: 'Tasks' | 'Notes' | 'Subjects' | 'Calendar' | 'Flashcards'
}

export type GoalProgressUnit = 'minutes' | 'hours' | 'points'

export type GoalProgressResult = {
  current: number
  target: number
  percentage: number
  unit: GoalProgressUnit
}

const GOAL_METRIC_LABELS: Record<GoalMetric, string> = {
  manual: 'Manual progress',
  study_time: 'Study time',
}

const GOAL_PERIOD_LABELS: Record<GoalPeriod, string> = {
  daily: 'Daily',
  weekly: 'Weekly',
  monthly: 'Monthly',
}

export function formatGoalMetricLabel(metric: GoalMetric) {
  return GOAL_METRIC_LABELS[metric]
}

export function formatGoalPeriodLabel(period: GoalPeriod) {
  return GOAL_PERIOD_LABELS[period]
}

export function getGoalTargetUnit(metric: GoalMetric, period: GoalPeriod): GoalProgressUnit {
  if (metric === 'manual') return 'points'
  if (period === 'daily') return 'minutes'
  return 'hours'
}

export function getTodayFocusMinutes(sessions: StudySession[]) {
  const today = localDateKey(new Date())
  return sessions.filter((session) => localDateKey(session.endedAt) === today).reduce((sum, session) => sum + session.minutes, 0)
}

export function getSubjectStudyMinutes(subjectId: string, sessions: StudySession[]) {
  return sessions.filter((session) => session.subjectId === subjectId).reduce((sum, session) => sum + session.minutes, 0)
}

export function getSubjectProgress(subject: StudySubject, sessions: StudySession[]) {
  const targetMinutes = Math.max(1, subject.targetHours * 60)
  const loggedMinutes = getSubjectStudyMinutes(subject.id, sessions)
  return loggedMinutes > 0 ? percent(loggedMinutes, targetMinutes) : subject.progress
}

/** True when progress is computed from finalized study sessions rather than stored manual progress. */
export function isDerivedGoal(goal: StudyGoal) {
  return goal.metric === 'study_time'
}

export function isStudyTimeGoal(goal: StudyGoal) {
  return goal.metric === 'study_time'
}

export function getGoalUnit(goal: StudyGoal): GoalProgressUnit {
  return getGoalTargetUnit(goal.metric, goal.period)
}

function isCreditedStudySession(session: StudySession, now: Date) {
  const endedAtMs = new Date(session.endedAt).getTime()
  return !Number.isNaN(endedAtMs) && endedAtMs <= now.getTime()
}

/** Daily study-time total in minutes for the local calendar day containing `now`. */
export function getDailyStudyMinutes(sessions: StudySession[], now = new Date()) {
  const today = localDateKey(now)
  return sessions
    .filter((session) => isCreditedStudySession(session, now))
    .filter((session) => localDateKey(session.endedAt) === today)
    .reduce((sum, session) => sum + session.minutes, 0)
}

/** Rolling seven-local-day study total in hours ending on `now`'s calendar day. */
export function getRollingWeeklyStudyHours(sessions: StudySession[], now = new Date()) {
  const credited = sessions.filter((session) => isCreditedStudySession(session, now))
  return getWeeklyStudyDays(credited, now).reduce((sum, day) => sum + day.hours, 0)
}

/** Current local-calendar-month study total in hours. */
export function getMonthlyStudyHours(sessions: StudySession[], now = new Date()) {
  const month = now.getMonth()
  const year = now.getFullYear()
  const totalMinutes = sessions
    .filter((session) => isCreditedStudySession(session, now))
    .filter((session) => {
      const ended = new Date(session.endedAt)
      return ended.getMonth() === month && ended.getFullYear() === year
    })
    .reduce((sum, session) => sum + session.minutes, 0)
  return totalMinutes / 60
}

function getStudyTimeCurrent(goal: StudyGoal, sessions: StudySession[], now: Date) {
  if (goal.period === 'daily') return getDailyStudyMinutes(sessions, now)
  if (goal.period === 'weekly') return Math.round(getRollingWeeklyStudyHours(sessions, now))
  return Math.round(getMonthlyStudyHours(sessions, now))
}

export function calculateGoalProgress(goal: StudyGoal, sessions: StudySession[], now = new Date()): GoalProgressResult {
  const target = Number.isFinite(goal.target) && goal.target > 0 ? goal.target : 0

  if (goal.metric === 'manual') {
    const current = Number.isFinite(goal.progress) ? goal.progress : 0
    return {
      current,
      target,
      percentage: percent(current, target),
      unit: 'points',
    }
  }

  const rawCurrent = getStudyTimeCurrent(goal, sessions, now)
  const current = target > 0 ? clamp(rawCurrent, 0, target) : 0
  return {
    current,
    target,
    percentage: percent(current, target),
    unit: getGoalUnit(goal),
  }
}

export function getGoalProgress(goal: StudyGoal, sessions: StudySession[], now = new Date()) {
  return calculateGoalProgress(goal, sessions, now).current
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

export function getWeeklyStudyDays(sessions: StudySession[], now = new Date()): WeeklyStudyDay[] {
  const today = now
  return Array.from({ length: 7 }, (_, index) => {
    const date = new Date(today)
    date.setDate(today.getDate() - (6 - index))
    const key = localDateKey(date)
    return {
      key,
      label: new Intl.DateTimeFormat('en-US', { weekday: 'short' }).format(date),
      hours: sessions.filter((session) => localDateKey(session.endedAt) === key).reduce((sum, session) => sum + session.minutes, 0) / 60,
    }
  })
}

export function groupStudySessionsByLocalDate(sessions: StudySession[], now = new Date()): StudySessionGroup[] {
  const sorted = [...sessions].sort((a, b) => dateTimestamp(b.startedAt) - dateTimestamp(a.startedAt))
  const groups = new Map<string, StudySession[]>()

  for (const session of sorted) {
    const key = localDateKey(session.startedAt) || 'unknown-date'
    const existing = groups.get(key)
    if (existing) existing.push(session)
    else groups.set(key, [session])
  }

  return Array.from(groups, ([key, groupedSessions]) => ({
    key,
    label: formatSessionGroupLabel(key, now),
    sessions: groupedSessions,
  }))
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
  const daysWithSessions = new Set(sessions.map((session) => localDateKey(session.endedAt)).filter(Boolean))
  let streak = 0
  const cursor = new Date()
  while (daysWithSessions.has(localDateKey(cursor))) {
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
  return localDateKey(date)
}

export function toInputTime(date: Date) {
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`
}

export function parseLocalDateTime(dateValue: string, timeValue: string) {
  const dateMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateValue)
  const timeMatch = /^(\d{2}):(\d{2})$/.exec(timeValue)
  if (!dateMatch || !timeMatch) return null

  const year = Number(dateMatch[1])
  const month = Number(dateMatch[2]) - 1
  const day = Number(dateMatch[3])
  const hours = Number(timeMatch[1])
  const minutes = Number(timeMatch[2])
  const parsed = new Date(year, month, day, hours, minutes, 0, 0)

  if (
    parsed.getFullYear() !== year ||
    parsed.getMonth() !== month ||
    parsed.getDate() !== day ||
    parsed.getHours() !== hours ||
    parsed.getMinutes() !== minutes
  ) return null

  return parsed
}

export function localDateKey(value: string | Date) {
  const date = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
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

function dateTimestamp(value: string) {
  const timestamp = new Date(value).getTime()
  return Number.isNaN(timestamp) ? Number.NEGATIVE_INFINITY : timestamp
}

function formatSessionGroupLabel(key: string, now: Date) {
  if (key === 'unknown-date') return 'Unknown date'
  if (key === localDateKey(now)) return 'Today'

  const yesterday = new Date(now)
  yesterday.setDate(yesterday.getDate() - 1)
  if (key === localDateKey(yesterday)) return 'Yesterday'

  const [year, month, day] = key.split('-').map(Number)
  const date = new Date(year, month - 1, day)
  return new Intl.DateTimeFormat('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: year === now.getFullYear() ? undefined : 'numeric',
  }).format(date)
}
