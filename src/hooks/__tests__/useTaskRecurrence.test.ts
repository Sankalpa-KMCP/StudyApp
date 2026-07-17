import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { TaskItem } from '../../db/types'
import { spawnNextRecurrence } from '../useTaskRecurrence'

const { addTask, updateTaskAfterRecurrenceSpawn } = vi.hoisted(() => ({
  addTask: vi.fn(),
  updateTaskAfterRecurrenceSpawn: vi.fn(),
}))

vi.mock('../../db/repositories/tasks', () => ({
  addTask,
  updateTaskAfterRecurrenceSpawn,
}))

const baseTask: TaskItem = {
  id: 1,
  text: 'Daily review',
  completed: true,
  createdAt: Date.now(),
  estimatedCycles: 2,
  actualCycles: 2,
  recurrenceRule: 'daily',
  studyBlockDurationMinutes: 25,
  shortBreakDurationMinutes: 5,
  longBreakDurationMinutes: 15,
}

describe('spawnNextRecurrence', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    addTask.mockResolvedValue(42)
    updateTaskAfterRecurrenceSpawn.mockResolvedValue(undefined)
  })

  it('returns null when task has no recurrence rule', async () => {
    await expect(spawnNextRecurrence({ ...baseTask, recurrenceRule: undefined })).resolves.toBeNull()
    expect(addTask).not.toHaveBeenCalled()
  })

  it('creates a new task and applies recurrence metadata', async () => {
    const id = await spawnNextRecurrence(baseTask)

    expect(id).toBe(42)
    expect(addTask).toHaveBeenCalledWith('Daily review', undefined, 2, undefined, undefined)
    expect(updateTaskAfterRecurrenceSpawn).toHaveBeenCalledWith(
      42,
      expect.objectContaining({
        recurrenceRule: 'daily',
        recurrenceParentId: 1,
        studyBlockDurationMinutes: 25,
        shortBreakDurationMinutes: 5,
        longBreakDurationMinutes: 15,
      }),
    )
  })

  it('preserves recurrenceParentId when already set', async () => {
    await spawnNextRecurrence({ ...baseTask, recurrenceParentId: 99 })

    expect(updateTaskAfterRecurrenceSpawn).toHaveBeenCalledWith(
      42,
      expect.objectContaining({ recurrenceParentId: 99 }),
    )
  })
})
