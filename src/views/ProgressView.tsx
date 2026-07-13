import type { StudyData, StudySubject } from '../db/types'
import { formatHours, percent, type WeeklyStudyDay } from '../appUtils'
import { PanelHeader, MetricCard } from '../components/ui'
import { StudyTime, SubjectDistribution } from '../components/RightColumn'

export function ProgressView(props: {
  data: StudyData
  weeklyStudyDays: WeeklyStudyDay[]
  dailyGoalMinutes: number
  todayFocusMinutes: number
  subjectMap: Map<string, StudySubject>
  onLogSession: () => void
}) {
  const completed = props.data.tasks.filter((task) => task.status === 'done').length
  const weeklyHours = props.weeklyStudyDays.reduce((sum, day) => sum + day.hours, 0)
  return (
    <section className="workspace-panel" aria-labelledby="progress-workspace-title">
      <PanelHeader title="Progress" description="See where your study time and effort are going." actionLabel="Log session" onAction={props.onLogSession} />
      <div className="metric-grid">
        <MetricCard label="Weekly study" value={formatHours(weeklyHours)} />
        <MetricCard label="Tasks complete" value={`${completed}/${props.data.tasks.length}`} />
        <MetricCard label="Focus target" value={`${Math.round(percent(props.todayFocusMinutes, props.dailyGoalMinutes))}%`} />
        <MetricCard label="Cards remembered" value={`${props.data.flashcards.filter((card) => card.status === 'remembered').length}`} />
      </div>
      <StudyTime days={props.weeklyStudyDays} />
      <SubjectDistribution subjects={props.data.subjects} sessions={props.data.studySessions} subjectMap={props.subjectMap} />
    </section>
  )
}
