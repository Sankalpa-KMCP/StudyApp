import { useCallback, useState } from 'react'
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
import {
  PanelHeader,
  TextInput,
  EditorActions,
  ProgressBar,
  RowActionButtons,
  EmptyState,
  MutationNotice,
} from '../components/ui'
import { useMutationState, type MutationPhase } from '../hooks/useMutationState'

type GoalDraft = {
  title: string
  target: number
  progress: number
  period: GoalPeriod
  metric: GoalMetric
}

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
  const [validationError, setValidationError] = useState<string | null>(null)
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null)
  const saveMutation = useMutationState()
  const rowMutation = useMutationState()
  const { clearFeedback: clearSaveFeedback, isPending: isSaving, phase: savePhase, message: saveMessage, run: runSave } = saveMutation
  const { clearFeedback: clearRowFeedback, isPending: isRowPending, phase: rowPhase, message: rowMessage, run: runRow } = rowMutation

  const noticePhase: MutationPhase = validationError
    ? 'error'
    : savePhase === 'success' || savePhase === 'error'
      ? savePhase
      : rowPhase === 'success' || rowPhase === 'error'
        ? rowPhase
        : 'idle'
  const noticeMessage = validationError
    ?? (savePhase === 'success' || savePhase === 'error' ? saveMessage : null)
    ?? (rowPhase === 'success' || rowPhase === 'error' ? rowMessage : null)

  const openEditor = useCallback((goal?: StudyGoal) => {
    setValidationError(null)
    clearSaveFeedback()
    setEditingGoalId(goal?.id ?? 'new')
    setDraft(createGoalDraft(dailyGoalMinutes, goal))
  }, [clearSaveFeedback, dailyGoalMinutes])

  const closeEditor = useCallback(() => {
    if (isSaving) return
    setEditingGoalId(null)
    setDraft(createGoalDraft(dailyGoalMinutes))
    setValidationError(null)
  }, [dailyGoalMinutes, isSaving])

  const dismissNotice = () => {
    setValidationError(null)
    clearSaveFeedback()
    clearRowFeedback()
  }

  const saveGoal = async () => {
    setValidationError(null)
    clearSaveFeedback()
    clearRowFeedback()

    const title = draft.title.trim()
    if (!title) {
      setValidationError('Enter a goal title.')
      return
    }
    if (!isGoalMetric(draft.metric)) {
      setValidationError('Choose a valid metric.')
      return
    }
    if (!isValidGoalTarget(draft.target)) {
      setValidationError('Target must be a number greater than zero.')
      return
    }

    const isEdit = Boolean(editingGoalId && editingGoalId !== 'new')
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
    const shouldUpdateDailyGoal = draft.metric === 'study_time' && draft.period === 'daily'

    await runSave(async () => {
      const writeGoal = async () => {
        if (isEdit && editingGoalId) {
          const updated = await studyDb.goals.update(editingGoalId, payload)
          if (updated === 0) throw new Error('Goal no longer exists.')
          return
        }

        await studyDb.goals.add({ id: createId('goal'), ...payload, createdAt: timestamp })
      }

      if (shouldUpdateDailyGoal) {
        await studyDb.transaction('rw', studyDb.goals, studyDb.settings, async () => {
          await writeGoal()
          await studyDb.settings.put({ key: 'dailyGoalMinutes', value: target })
        })
        return
      }

      await writeGoal()
    }, {
      successMessage: isEdit ? 'Goal updated.' : 'Goal created.',
      errorMessage: 'Goal could not be saved. Your details are still in the form.',
      onSuccess: () => {
        setEditingGoalId(null)
        setDraft(createGoalDraft(shouldUpdateDailyGoal ? target : dailyGoalMinutes))
        setValidationError(null)
      },
    })
  }

  const deleteGoal = async (goal: StudyGoal) => {
    if (pendingDeleteId || isSaving || isRowPending) return

    setValidationError(null)
    clearSaveFeedback()
    clearRowFeedback()
    setPendingDeleteId(goal.id)

    try {
      await runRow(async () => {
        await studyDb.goals.delete(goal.id)
      }, {
        successMessage: 'Goal deleted.',
        errorMessage: 'Goal could not be deleted. Please try again.',
        onSuccess: () => {
          if (editingGoalId === goal.id) {
            setEditingGoalId(null)
            setDraft(createGoalDraft(dailyGoalMinutes))
            setValidationError(null)
          }
        },
      })
    } finally {
      setPendingDeleteId(null)
    }
  }

  const targetUnit = getGoalTargetUnit(draft.metric, draft.period)
  const metricHelpId = 'goal-metric-help'
  const loadingLabel = editingGoalId && editingGoalId !== 'new' ? 'Saving goal...' : 'Creating goal...'
  const rowActionsLocked = isSaving || Boolean(pendingDeleteId)

  return (
    <section className="workspace-panel" aria-labelledby="goals-workspace-title">
      <PanelHeader title="Goals" description="Turn study intentions into measurable targets." actionLabel="New goal" onAction={() => openEditor()} />
      <MutationNotice phase={noticePhase} message={noticeMessage} onDismiss={dismissNotice} />
      {editingGoalId ? (
        <div className="editor-card" aria-busy={isSaving || undefined}>
          <TextInput label="Goal title" value={draft.title} onChange={(title) => setDraft({ ...draft, title })} />
          <label className="field" htmlFor="goal-metric">
            <span>Metric</span>
            <select
              id="goal-metric"
              value={draft.metric}
              required
              aria-required="true"
              aria-describedby={metricHelpId}
              disabled={isSaving}
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
            <select
              value={draft.period}
              disabled={isSaving}
              onChange={(event) => setDraft({ ...draft, period: event.target.value as GoalPeriod })}
            >
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
              disabled={isSaving}
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
                disabled={isSaving}
                value={Number.isFinite(draft.progress) ? draft.progress : ''}
                onChange={(event) => setDraft({ ...draft, progress: Number(event.target.value) })}
              />
            </label>
          ) : null}
          <EditorActions
            onSave={() => void saveGoal()}
            onCancel={closeEditor}
            isLoading={isSaving}
            loadingLabel={loadingLabel}
          />
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
                <RowActionButtons
                  label={goal.title}
                  onEdit={() => openEditor(goal)}
                  onDelete={() => void deleteGoal(goal)}
                  isDisabled={rowActionsLocked}
                  isDeleting={pendingDeleteId === goal.id}
                />
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
