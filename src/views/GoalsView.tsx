import { useState } from 'react'
import { Target } from 'lucide-react'
import { isGoalMetric, type StudyGoal, type StudySession, type GoalPeriod, type GoalMetric } from '../db/types'
import { createId, nowIso, studyDb } from '../db/studyDb'
import {
  calculateGoalProgress,
  clamp,
  formatGoalMetricLabel,
  formatGoalPeriodLabel,
  getGoalTargetUnit,
} from '../appUtils'
import { PanelHeader, TextInput, EditorActions, ProgressBar, RowActionButtons, EmptyState } from '../components/ui'

type GoalDraft = {
  title: string
  target: number
  progress: number
  period: GoalPeriod
  metric: GoalMetric
}

type GoalFeedback = { tone: 'error'; message: string }

function createGoalDraft(dailyGoalMinutes: number, goal?: StudyGoal): GoalDraft {
  return {
    title: goal?.title ?? '',
    target: goal?.target ?? dailyGoalMinutes,
    progress: goal?.progress ?? 0,
    period: goal?.period ?? 'daily',
    metric: goal?.metric ?? 'manual',
  }
}

function isValidGoalTarget(target: number) {
  return Number.isFinite(target) && target > 0
}

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
  const [draft, setDraft] = useState<GoalDraft>(() => createGoalDraft(dailyGoalMinutes))
  const [feedback, setFeedback] = useState<GoalFeedback | null>(null)

  const openEditor = (goal?: StudyGoal) => {
    setEditingGoalId(goal?.id ?? 'new')
    setDraft(createGoalDraft(dailyGoalMinutes, goal))
    setFeedback(null)
  }

  const saveGoal = async () => {
    const title = draft.title.trim()
    if (!title) {
      setFeedback({ tone: 'error', message: 'Enter a goal title.' })
      return
    }
    if (!isGoalMetric(draft.metric)) {
      setFeedback({ tone: 'error', message: 'Choose a valid metric.' })
      return
    }
    if (!isValidGoalTarget(draft.target)) {
      setFeedback({ tone: 'error', message: 'Target must be a number greater than zero.' })
      return
    }

    const timestamp = nowIso()
    const target = clamp(Math.round(draft.target), 1, 10_000)
    const payload = {
      title,
      target,
      progress: draft.metric === 'manual'
        ? clamp(Math.round(Number.isFinite(draft.progress) ? draft.progress : 0), 0, target)
        : draft.progress,
      period: draft.period,
      metric: draft.metric,
      updatedAt: timestamp,
    }

    try {
      if (editingGoalId && editingGoalId !== 'new') await studyDb.goals.update(editingGoalId, payload)
      else await studyDb.goals.add({ id: createId('goal'), ...payload, createdAt: timestamp })
      if (draft.metric === 'study_time' && draft.period === 'daily') {
        await studyDb.settings.put({ key: 'dailyGoalMinutes', value: target })
      }
      setEditingGoalId(null)
      setFeedback(null)
    } catch {
      setFeedback({ tone: 'error', message: 'Could not save this goal. Try again.' })
    }
  }

  const targetUnit = getGoalTargetUnit(draft.metric, draft.period)
  const metricHelpId = 'goal-metric-help'

  return (
    <section className="workspace-panel" aria-labelledby="goals-workspace-title">
      <PanelHeader title="Goals" description="Turn study intentions into measurable targets." actionLabel="New goal" onAction={() => openEditor()} />
      {feedback && !editingGoalId ? (
        <p className="settings-feedback error" role="alert">{feedback.message}</p>
      ) : null}
      {editingGoalId ? (
        <div className="editor-card">
          <TextInput label="Goal title" value={draft.title} onChange={(title) => setDraft({ ...draft, title })} />
          <label className="field" htmlFor="goal-metric">
            <span>Metric</span>
            <select
              id="goal-metric"
              value={draft.metric}
              required
              aria-required="true"
              aria-describedby={metricHelpId}
              onChange={(event) => setDraft({ ...draft, metric: event.target.value as GoalMetric })}
            >
              <option value="manual">Manual progress</option>
              <option value="study_time">Study time</option>
            </select>
          </label>
          <p className="settings-feedback" id={metricHelpId}>
            {draft.metric === 'manual' ? 'Update this goal yourself.' : 'Calculated automatically from recorded study sessions.'}
          </p>
          <label className="field">
            <span>Period</span>
            <select value={draft.period} onChange={(event) => setDraft({ ...draft, period: event.target.value as GoalPeriod })}>
              <option value="daily">Daily</option>
              <option value="weekly">Weekly</option>
              <option value="monthly">Monthly</option>
            </select>
          </label>
          <label className="field">
            <span>Target ({targetUnit})</span>
            <input
              type="number"
              min={1}
              max={10_000}
              required
              value={Number.isFinite(draft.target) ? draft.target : ''}
              onChange={(event) => setDraft({ ...draft, target: Number(event.target.value) })}
            />
          </label>
          {draft.metric === 'manual' ? (
            <label className="field">
              <span>Progress (points)</span>
              <input
                type="number"
                min={0}
                max={10_000}
                value={Number.isFinite(draft.progress) ? draft.progress : ''}
                onChange={(event) => setDraft({ ...draft, progress: Number(event.target.value) })}
              />
            </label>
          ) : null}
          {feedback ? <p className="settings-feedback error" role="alert">{feedback.message}</p> : null}
          <EditorActions onSave={() => void saveGoal()} onCancel={() => { setEditingGoalId(null); setFeedback(null) }} />
        </div>
      ) : null}
      {goals.length > 0 ? (
        <div className="card-grid">
          {goals.map((goal) => {
            const progress = calculateGoalProgress(goal, studySessions)
            const progressLabel = `${progress.current}/${progress.target} ${progress.unit}`
            return (
              <article className="detail-card" key={goal.id}>
                <div>
                  <span className="pill">{formatGoalMetricLabel(goal.metric)}</span>
                  {' '}
                  <span className="pill">{formatGoalPeriodLabel(goal.period)}</span>
                </div>
                <h3>{goal.title}</h3>
                <p>{progressLabel}</p>
                <ProgressBar value={progress.percentage} label={`${Math.round(progress.percentage)}%`} />
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
