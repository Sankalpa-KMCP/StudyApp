import { t } from '../../i18n'
import type { TranslationKey } from '../../i18n'
import type { DailyLog, TaskItem } from '../../db/types'
import type { ThemeProfile } from '../../types/app'

const MOOD_LABEL_KEYS: Record<string, TranslationKey> = {
  focused: 'analyticsMoodFocused',
  energetic: 'analyticsMoodEnergetic',
  tired: 'analyticsMoodTired',
  distracted: 'analyticsMoodDistracted',
}

export function buildRetentionData(tasks: TaskItem[]) {
  const gradedTasks = tasks.filter(t => t.completed && t.latestGrade !== undefined)
  const groupedByDate: Record<string, { sum: number; count: number }> = {}

  const processItem = (item: { createdAt: number; latestGrade?: number }) => {
    const d = new Date(item.createdAt)
    const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
    if (!groupedByDate[dateStr]) groupedByDate[dateStr] = { sum: 0, count: 0 }
    groupedByDate[dateStr].sum += item.latestGrade!
    groupedByDate[dateStr].count += 1
  }

  gradedTasks.forEach(processItem)

  return Object.keys(groupedByDate)
    .sort()
    .map(dateStr => {
      const g = groupedByDate[dateStr]
      return {
        date: dateStr.substring(5),
        avgGrade: parseFloat((g.sum / g.count).toFixed(1)),
      }
    })
}

export function buildHeatmapData(allLogs: DailyLog[]) {
  const today = new Date()
  const startDate = new Date()
  startDate.setDate(today.getDate() - 364)
  const startDayOfWeek = startDate.getDay()
  startDate.setDate(startDate.getDate() - startDayOfWeek)

  const logsMap = new Map<string, number>()
  allLogs.forEach(log => {
    logsMap.set(log.dateString, log.studyMinutes || 0)
  })

  const days: Array<{ dateStr: string; minutes: number }> = []
  const tempDate = new Date(startDate)
  const endAlignmentDate = new Date(today)
  endAlignmentDate.setDate(today.getDate() + (6 - today.getDay()))

  while (tempDate <= endAlignmentDate) {
    const dateStr = `${tempDate.getFullYear()}-${String(tempDate.getMonth() + 1).padStart(2, '0')}-${String(tempDate.getDate()).padStart(2, '0')}`
    days.push({ dateStr, minutes: logsMap.get(dateStr) ?? 0 })
    tempDate.setDate(tempDate.getDate() + 1)
  }

  return days
}

export function buildEstimationInsight(tasks: TaskItem[]) {
  const completedTasks = tasks.filter(t => t.completed && t.estimatedCycles > 0)
  if (completedTasks.length === 0) return t('commonNoData')

  let totalEstimated = 0
  let totalActual = 0
  completedTasks.forEach(t => {
    totalEstimated += t.estimatedCycles
    totalActual += t.actualCycles
  })

  const diff = Math.abs(totalActual - totalEstimated)
  const errorRate = Math.round((diff / totalEstimated) * 100)
  if (totalActual === totalEstimated) return t('analyticsEstimationPerfect')
  return t('analyticsEstimationDev', {
    rate: errorRate,
    direction: totalActual > totalEstimated ? t('analyticsEstimationUnder') : t('analyticsEstimationOver'),
  })
}

export function buildMoodDistribution(monthLogs: DailyLog[], activeThemeVars: ThemeProfile) {
  const counts: Record<string, number> = {
    focused: 0,
    energetic: 0,
    tired: 0,
    distracted: 0,
  }
  let totalLogged = 0

  monthLogs.forEach(log => {
    if (log.mood && counts[log.mood] !== undefined) {
      counts[log.mood]++
      totalLogged++
    }
  })

  const colors: Record<string, string> = {
    focused: activeThemeVars.accentBlue,
    energetic: activeThemeVars.accentGreen,
    tired: activeThemeVars.accentAmber,
    distracted: '#ef4444',
  }

  const emojis: Record<string, string> = {
    focused: '🧠',
    energetic: '⚡',
    tired: '🥱',
    distracted: '🌪',
  }

  return Object.keys(counts).map(key => {
    const count = counts[key]
    const percentage = totalLogged > 0 ? Math.round((count / totalLogged) * 100) : 0
    return {
      name: t(MOOD_LABEL_KEYS[key]),
      value: count,
      percentage,
      color: colors[key],
      emoji: emojis[key],
    }
  })
}

export function getHeatmapIntensityLabel(minutes: number): string {
  if (minutes < 60) return t('analyticsIntensityLow')
  if (minutes < 120) return t('analyticsIntensityMed')
  if (minutes < 180) return t('analyticsIntensityHigh')
  return t('analyticsIntensityEpic')
}
