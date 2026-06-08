import { useMemo } from 'react'
import type { DailyLog, TaskItem, FlashcardItem } from '../../db/types'
import type { ThemeProfile } from '../../types/app'

export function useRetentionData(tasks: TaskItem[], flashcards: FlashcardItem[] = []) {
  return useMemo(() => {
    const gradedTasks = tasks.filter(t => t.completed && t.latestGrade !== undefined)
    const gradedCards = flashcards.filter(c => c.latestGrade !== undefined)
    const groupedByDate: Record<string, { sum: number; count: number }> = {}

    const processItem = (item: { createdAt: number; latestGrade?: number }) => {
      const d = new Date(item.createdAt)
      const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
      if (!groupedByDate[dateStr]) groupedByDate[dateStr] = { sum: 0, count: 0 }
      groupedByDate[dateStr].sum += item.latestGrade!
      groupedByDate[dateStr].count += 1
    }

    gradedTasks.forEach(processItem)
    gradedCards.forEach(processItem)

    return Object.keys(groupedByDate)
      .sort()
      .map(dateStr => {
        const g = groupedByDate[dateStr]
        return {
          date: dateStr.substring(5),
          avgGrade: parseFloat((g.sum / g.count).toFixed(1)),
        }
      })
  }, [tasks, flashcards])
}

export function useHeatmapData(allLogs: DailyLog[]) {
  return useMemo(() => {
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
  }, [allLogs])
}

export function useEstimationInsight(tasks: TaskItem[]) {
  return useMemo(() => {
    const completedTasks = tasks.filter(t => t.completed && t.estimatedCycles > 0)
    if (completedTasks.length === 0) return 'No data'

    let totalEstimated = 0
    let totalActual = 0
    completedTasks.forEach(t => {
      totalEstimated += t.estimatedCycles
      totalActual += t.actualCycles
    })

    const diff = Math.abs(totalActual - totalEstimated)
    const errorRate = Math.round((diff / totalEstimated) * 100)
    if (totalActual === totalEstimated) return '0% Dev (Perfect)'
    return `${errorRate}% Dev (${totalActual > totalEstimated ? 'Under' : 'Over'})`
  }, [tasks])
}

export function useMoodDistribution(monthLogs: DailyLog[], activeThemeVars: ThemeProfile) {
  return useMemo(() => {
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
        name: key.charAt(0).toUpperCase() + key.slice(1),
        value: count,
        percentage,
        color: colors[key],
        emoji: emojis[key],
      }
    })
  }, [monthLogs, activeThemeVars])
}
