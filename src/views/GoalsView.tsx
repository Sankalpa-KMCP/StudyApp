import { useState } from 'react'
import { Target } from 'lucide-react'
import type { StudyGoal, StudySession, GoalPeriod, GoalMetric } from '../db/types'
import { createId, nowIso, studyDb } from '../db/studyDb'
import { calculateGoalProgress, clamp, isDerivedGoal } from '../appUtils'
import { PanelHeader, TextInput, NumberInput, EditorActions, ProgressBar, RowActionButtons, EmptyState } from '../components/ui'

export function GoalsView({
  goals,
  dailyGoalMinutes,
  studySessions,
}: {
  goals: StudyGoal[]
  dailyGoalMinutes: number
  studySessions: StudySession[]
}) {
  const [editingGoalId, setEditingGoalId] = useState<string | null>(null)
  const [draft, setDraft] = useState<{
    title: string
    target: number
    progress: number
    period: GoalPeriod
    metric: GoalMetric
  }>({
    title: '',
    target: dailyGoalMinutes,
    progress: 0,
    period: 'daily',
    metric: 'manual',
  })

  const openEditor = (goal?: StudyGoal) => {
    setEditingGoalId(goal?.id ?? 'new')
    setDraft({
      title: goal?.title ?? '',
      target: goal?.target ?? dailyGoalMinutes,
      progress: goal?.progress ?? 0,
      period: goal?.period ?? 'daily',
      metric: goal?.metric ?? 'manual',
    })
  }

  const saveGoal = async () => {
    const title = draft.title.trim()
    if (!title) return
    const timestamp = nowIso()
    const payload = {
      ...draft,
      title,
      target: clamp(draft.target, 1, 10_000),
      progress: clamp(draft.progress, 0, draft.target),
      metric: draft.metric,
      updatedAt: timestamp,
    }
    if (editingGoalId && editingGoalId !== 'new') await studyDb.goals.update(editingGoalId, payload)
    else await studyDb.goals.add({ id: createId('goal'), ...payload, createdAt: timestamp })
    if (draft.period === 'daily' && title.toLowerCase().includes('focus')) await studyDb.settings.put({ key: 'dailyGoalMinutes', value: draft.target })
    setEditingGoalId(null)
  }

  return (
    <section className="workspace-panel" aria-labelledby="goals-workspace-title">
      <PanelHeader title="Goals" description="Turn study intentions into measurable targets." actionLabel="New goal" onAction={() => openEditor()} />
      {editingGoalId ? (
        <div className="editor-card">
          <TextInput label="Goal title" value={draft.title} onChange={(title) => setDraft({ ...draft, title })} />
          <NumberInput label="Target" value={draft.target} min={1} max={10_000} onChange={(target) => setDraft({ ...draft, target })} />
          <NumberInput label="Progress" value={draft.progress} min={0} max={10_000} onChange={(progress) => setDraft({ ...draft, progress })} />
          <label className="field">
            <span>Period</span>
            <select value={draft.period} onChange={(event) => setDraft({ ...draft, period: event.target.value as GoalPeriod })}>
              <option value="daily">Daily</option>
              <option value="weekly">Weekly</option>
              <option value="monthly">Monthly</option>
            </select>
          </label>
          <EditorActions onSave={() => void saveGoal()} onCancel={() => setEditingGoalId(null)} />
        </div>
      ) : null}
      {goals.length > 0 ? (
        <div className="card-grid">
          {goals.map((goal) => {
            const progress = calculateGoalProgress(goal, studySessions)
            return (
              <article className="detail-card" key={goal.id}>
                <span className="pill">{isDerivedGoal(goal) ? `${goal.period} - derived` : goal.period}</span>
                <h3>{goal.title}</h3>
                <ProgressBar value={progress.percentage} label={`${progress.current}/${progress.target}`} />
                <RowActionButtons label={goal.title} onEdit={() => openEditor(goal)} onDelete={() => void studyDb.goals.delete(goal.id)} />
              </article>
            )
          })}
        </div>
      ) : (
        <EmptyState icon={Target} title="No goals yet" body="Set focus, review, or weekly study goals and track progress here." actionLabel="Create first goal" onAction={() => openEditor()} />
      )}
    </section>
  )
}
