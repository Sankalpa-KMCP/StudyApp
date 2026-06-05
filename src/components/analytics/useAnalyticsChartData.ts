import { useMemo } from 'react'
import type { DailyLog, TaskItem } from '../../db/types'

export function useRetentionData(tasks: TaskItem[]) {
  return useMemo(() => {
    const gradedTasks = tasks.filter(t => t.completed && t.latestGrade !== undefined)
    const groupedByDate: Record<string, { sum: number; count: number }> = {}

    gradedTasks.forEach(t => {
      const d = new Date(t.createdAt)
      const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
      if (!groupedByDate[dateStr]) groupedByDate[dateStr] = { sum: 0, count: 0 }
      groupedByDate[dateStr].sum += t.latestGrade!
      groupedByDate[dateStr].count += 1
    })

    return Object.keys(groupedByDate)
      .sort()
      .map(dateStr => {
        const g = groupedByDate[dateStr]
        return {
          date: dateStr.substring(5),
          avgGrade: parseFloat((g.sum / g.count).toFixed(1)),
        }
      })
  }, [tasks])
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
