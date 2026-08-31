import {
  type DatabaseMutationContext,
  withGuardedMutation,
} from './databaseMutationGuard'
import { createId, nowIso, studyDb } from './studyDb'
import type { GoalMetric, GoalPeriod, StudyGoal } from './types'

/** Fields the Goals editor supplies after title/metric/target validation and clamping. */
export type GoalWriteFields = {
  title: string
  target: number
  progress: number
  period: GoalPeriod
  metric: GoalMetric
}

function shouldSyncDailyGoalMinutes(fields: GoalWriteFields) {
  return fields.metric === 'study_time' && fields.period === 'daily'
}

async function putDailyGoalMinutes(target: number) {
  await studyDb.settings.put({ key: 'dailyGoalMinutes', value: target })
}

/**
 * Persist a new goal under database generation guard. Owns id and created/updated timestamps.
 * When metric is study_time and period is daily, atomically syncs `dailyGoalMinutes` to `target`.
 */
export async function createGoal(
  fields: GoalWriteFields,
  context: DatabaseMutationContext,
): Promise<StudyGoal> {
  return withGuardedMutation(context, async () => {
    const timestamp = nowIso()
    const goal: StudyGoal = {
      id: createId('goal'),
      title: fields.title,
      target: fields.target,
      progress: fields.progress,
      period: fields.period,
      metric: fields.metric,
      createdAt: timestamp,
      updatedAt: timestamp,
    }

    if (shouldSyncDailyGoalMinutes(fields)) {
      await studyDb.transaction('rw', studyDb.goals, studyDb.settings, async () => {
        await studyDb.goals.add(goal)
        await putDailyGoalMinutes(fields.target)
      })
      return goal
    }

    await studyDb.goals.add(goal)
    return goal
  })
}

/**
 * Update an existing goal's editable fields and refresh `updatedAt` under database generation guard.
 * When metric is study_time and period is daily, atomically syncs `dailyGoalMinutes` to `target`.
 * Throws when no row matches `id`.
 */
export async function updateGoal(
  id: string,
  fields: GoalWriteFields,
  context: DatabaseMutationContext,
): Promise<void> {
  return withGuardedMutation(context, async () => {
    const changes = {
      title: fields.title,
      target: fields.target,
      progress: fields.progress,
      period: fields.period,
      metric: fields.metric,
      updatedAt: nowIso(),
    }

    const writeUpdate = async () => {
      const updated = await studyDb.goals.update(id, changes)
      if (updated === 0) throw new Error('Goal no longer exists.')
    }

    if (shouldSyncDailyGoalMinutes(fields)) {
      await studyDb.transaction('rw', studyDb.goals, studyDb.settings, async () => {
        await writeUpdate()
        await putDailyGoalMinutes(fields.target)
      })
      return
    }

    await writeUpdate()
  })
}

/**
 * Delete a goal by id under database generation guard. Missing rows are not treated as errors (Dexie delete is idempotent).
 * Never changes `dailyGoalMinutes`.
 */
export async function deleteGoal(
  id: string,
  context: DatabaseMutationContext,
): Promise<void> {
  return withGuardedMutation(context, async () => {
    await studyDb.goals.delete(id)
  })
}
