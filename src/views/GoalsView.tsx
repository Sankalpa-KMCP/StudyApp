import { useCallback, useRef, useState } from 'react'
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

type GoalValidationField = 'title' | 'metric' | 'target'

const GOAL_TITLE_ERROR_ID = 'goal-title-error'
const GOAL_METRIC_ERROR_ID = 'goal-metric-error'
const GOAL_TARGET_ERROR_ID = 'goal-target-error'

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

function composeDescribedBy(...ids: Array<string | undefined>) {
  const value = ids.filter(Boolean).join(' ')
  return value || undefined
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
  const [validationField, setValidationField] = useState<GoalValidationField | null>(null)
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null)
  const titleFieldRef = useRef<HTMLInputElement | null>(null)
  const metricFieldRef = useRef<HTMLSelectElement | null>(null)
  const targetFieldRef = useRef<HTMLInputElement | null>(null)
  const saveMutation = useMutationState()
  const rowMutation = useMutationState()
  const { clearFeedback: clearSaveFeedback, isPending: isSaving, phase: savePhase, message: saveMessage, run: runSave } = saveMutation
  const { clearFeedback: clearRowFeedback, isPending: isRowPending, phase: rowPhase, message: rowMessage, run: runRow } = rowMutation

  const noticePhase: MutationPhase = savePhase === 'success' || savePhase === 'error'
    ? savePhase
    : rowPhase === 'success' || rowPhase === 'error'
      ? rowPhase
      : 'idle'
  const noticeMessage = (savePhase === 'success' || savePhase === 'error' ? saveMessage : null)
    ?? (rowPhase === 'success' || rowPhase === 'error' ? rowMessage : null)

  const clearValidation = useCallback(() => {
    setValidationError(null)
    setValidationField(null)
  }, [])

  const openEditor = useCallback((goal?: StudyGoal) => {
    clearValidation()
    clearSaveFeedback()
    setEditingGoalId(goal?.id ?? 'new')
    setDraft(createGoalDraft(dailyGoalMinutes, goal))
  }, [clearSaveFeedback, clearValidation, dailyGoalMinutes])

  const closeEditor = useCallback(() => {
    if (isSaving) return
    setEditingGoalId(null)
    setDraft(createGoalDraft(dailyGoalMinutes))
    clearValidation()
  }, [clearValidation, dailyGoalMinutes, isSaving])

  const dismissNotice = () => {
    clearValidation()
    clearSaveFeedback()
    clearRowFeedback()
  }

  const saveGoal = async () => {
    clearValidation()
    clearSaveFeedback()
    clearRowFeedback()

    const title = draft.title.trim()
    if (!title) {
      setValidationField('title')
      setValidationError('Enter a goal title.')
      titleFieldRef.current?.focus()
      return
    }
    if (!isGoalMetric(draft.metric)) {
      setValidationField('metric')
      setValidationError('Choose a valid metric.')
      metricFieldRef.current?.focus()
      return
    }
    if (!isValidGoalTarget(draft.target)) {
      setValidationField('target')
      setValidationError('Target must be a number greater than zero.')
      targetFieldRef.current?.focus()
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
        clearValidation()
      },
    })
  }

  const deleteGoal = async (goal: StudyGoal) => {
    if (pendingDeleteId || isSaving || isRowPending) return

    clearValidation()
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
            clearValidation()
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
  const titleInvalid = validationField === 'title'
  const metricInvalid = validationField === 'metric'
  const targetInvalid = validationField === 'target'

  return (
    <section className="workspace-panel" aria-labelledby="goals-workspace-title">
      <PanelHeader title="Goals" description="Turn study intentions into measurable targets." actionLabel="New goal" onAction={() => openEditor()} />
      <MutationNotice phase={noticePhase} message={noticeMessage} onDismiss={dismissNotice} />
      {editingGoalId ? (
        <div className="editor-card" aria-busy={isSaving || undefined}>
          <TextInput
            id="goal-title"
            label="Goal title"
            value={draft.title}
            inputRef={titleFieldRef}
            invalid={titleInvalid}
            describedBy={titleInvalid ? GOAL_TITLE_ERROR_ID : undefined}
            onChange={(title) => setDraft({ ...draft, title })}
          />
          {titleInvalid ? (
            <p id={GOAL_TITLE_ERROR_ID} className="settings-feedback error" role="alert">
              {validationError}
            </p>
          ) : null}
          <label className="field" htmlFor="goal-metric">
            <span>Metric</span>
            <select
              id="goal-metric"
              ref={metricFieldRef}
              value={draft.metric}
              required
              aria-required="true"
              aria-invalid={metricInvalid || undefined}
              aria-describedby={composeDescribedBy(metricHelpId, metricInvalid ? GOAL_METRIC_ERROR_ID : undefined)}
              disabled={isSaving}
              onChange={(event) => {
                clearValidation()
                setDraft({ ...draft, metric: event.target.value as GoalMetric })
              }}
            >
              <option value="manual">Manual progress</option>
              <option value="study_time">Study time</option>
            </select>
          </label>
          <p className="settings-feedback" id={metricHelpId}>
            {draft.metric === 'manual' ? 'Update this goal yourself.' : 'Calculated automatically from recorded study sessions.'}
          </p>
          {metricInvalid ? (
            <p id={GOAL_METRIC_ERROR_ID} className="settings-feedback error" role="alert">
              {validationError}
            </p>
          ) : null}
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
          <label className="field" htmlFor="goal-target">
            <span>Target ({targetUnit})</span>
            <input
              id="goal-target"
              ref={targetFieldRef}
              type="number"
              min={1}
              max={10_000}
              required
              disabled={isSaving}
              aria-invalid={targetInvalid || undefined}
              aria-describedby={targetInvalid ? GOAL_TARGET_ERROR_ID : undefined}
              value={Number.isFinite(draft.target) ? draft.target : ''}
              onChange={(event) => setDraft({ ...draft, target: Number(event.target.value) })}
            />
          </label>
          {targetInvalid ? (
            <p id={GOAL_TARGET_ERROR_ID} className="settings-feedback error" role="alert">
              {validationError}
            </p>
          ) : null}
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
