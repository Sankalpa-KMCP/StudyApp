import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import App from './App'
import { studyDb } from './db/studyDb'
import { flushDeferredAppWork, resetAppTestEnvironment } from './test/appTestSetup'

describe('App goals', () => {
  beforeEach(async () => {
    await resetAppTestEnvironment()
  })

  afterEach(async () => {
    await flushDeferredAppWork()
  })

  it('creates and manages goals', async () => {
    const user = userEvent.setup()
    render(<App />)

    await user.click(await screen.findByRole('button', { name: 'Goals' }))
    await user.click(screen.getByRole('button', { name: 'New goal' }))
    await user.type(screen.getByLabelText('Goal title'), 'Study 2 hours daily')
    await user.click(screen.getByRole('button', { name: 'Save' }))

    expect(await screen.findByText('Study 2 hours daily')).toBeInTheDocument()
    expect(screen.getByText('Manual progress')).toBeInTheDocument()

    const goals = await studyDb.goals.toArray()
    expect(goals).toHaveLength(1)
    expect(goals[0].title).toBe('Study 2 hours daily')
    expect(goals[0].metric).toBe('manual')
  })

  it('supports explicit goal metrics in the editor and cards', async () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date(2026, 6, 13, 15, 0))
    const user = userEvent.setup()
    const timestamp = new Date().toISOString()
    await studyDb.settings.put({ key: 'dailyGoalMinutes', value: 120 })
    await studyDb.studySessions.add({
      id: 'session-goal-ui',
      subjectId: '',
      startedAt: new Date(2026, 6, 13, 10, 0).toISOString(),
      endedAt: new Date(2026, 6, 13, 10, 45).toISOString(),
      minutes: 45,
      note: '',
    })

    render(<App />)
    await user.click(await screen.findByRole('button', { name: 'Goals' }))

    await user.click(screen.getByRole('button', { name: 'New goal' }))
    expect(screen.getByLabelText('Metric')).toHaveValue('manual')
    expect(screen.getByText('Update this goal yourself.')).toBeInTheDocument()
    await user.type(screen.getByLabelText('Goal title'), 'Study every day')
    await user.clear(screen.getByLabelText(/Target \(points\)/))
    await user.type(screen.getByLabelText(/Target \(points\)/), '90')
    await user.clear(screen.getByLabelText('Progress (points)'))
    await user.type(screen.getByLabelText('Progress (points)'), '12')
    await user.click(screen.getByRole('button', { name: 'Save' }))

    await waitFor(async () => {
      expect((await studyDb.goals.toArray()).some((goal) => goal.title === 'Study every day')).toBe(true)
    })
    const manualCard = (await screen.findByText('Study every day')).closest('article') as HTMLElement
    expect(within(manualCard).getByText('Manual progress')).toBeInTheDocument()
    expect(within(manualCard).getByText('Daily')).toBeInTheDocument()
    expect(within(manualCard).getByText('12/90 points')).toBeInTheDocument()
    expect((await studyDb.goals.toArray()).find((goal) => goal.title === 'Study every day')).toMatchObject({
      metric: 'manual',
      progress: 12,
      target: 90,
    })
    expect((await studyDb.settings.get('dailyGoalMinutes'))?.value).toBe(120)

    await user.click(screen.getByRole('button', { name: 'New goal' }))
    await user.type(screen.getByLabelText('Goal title'), 'Weekly target')
    await user.selectOptions(screen.getByLabelText('Metric'), 'study_time')
    expect(screen.getByText('Calculated automatically from recorded study sessions.')).toBeInTheDocument()
    expect(screen.queryByLabelText('Progress (points)')).not.toBeInTheDocument()
    await user.selectOptions(screen.getByLabelText('Period'), 'weekly')
    expect(screen.getByLabelText(/Target \(hours\)/)).toBeInTheDocument()
    await user.clear(screen.getByLabelText(/Target \(hours\)/))
    await user.type(screen.getByLabelText(/Target \(hours\)/), '5')
    await user.click(screen.getByRole('button', { name: 'Save' }))

    const studyCard = (await screen.findByText('Weekly target')).closest('article') as HTMLElement
    expect(within(studyCard).getByText('Study time')).toBeInTheDocument()
    expect(within(studyCard).getByText('Weekly')).toBeInTheDocument()
    expect(within(studyCard).getByText('1/5 hours')).toBeInTheDocument()

    await user.click(within(studyCard).getByRole('button', { name: 'Edit Weekly target' }))
    expect(screen.getByLabelText('Metric')).toHaveValue('study_time')
    await user.clear(screen.getByLabelText('Goal title'))
    await user.type(screen.getByLabelText('Goal title'), 'Renamed weekly target')
    await user.click(screen.getByRole('button', { name: 'Save' }))
    expect((await studyDb.goals.toArray()).find((goal) => goal.title === 'Renamed weekly target')).toMatchObject({
      metric: 'study_time',
      period: 'weekly',
    })

    await user.click(screen.getByRole('button', { name: 'New goal' }))
    await user.type(screen.getByLabelText('Goal title'), 'Daily target')
    await user.selectOptions(screen.getByLabelText('Metric'), 'study_time')
    await user.selectOptions(screen.getByLabelText('Period'), 'daily')
    await user.clear(screen.getByLabelText(/Target \(minutes\)/))
    await user.type(screen.getByLabelText(/Target \(minutes\)/), '75')
    await user.click(screen.getByRole('button', { name: 'Save' }))
    expect((await studyDb.settings.get('dailyGoalMinutes'))?.value).toBe(75)

    await user.click(screen.getByRole('button', { name: 'New goal' }))
    await user.type(screen.getByLabelText('Goal title'), 'Daily focus manual')
    await user.selectOptions(screen.getByLabelText('Metric'), 'manual')
    await user.selectOptions(screen.getByLabelText('Period'), 'daily')
    await user.clear(screen.getByLabelText(/Target \(points\)/))
    await user.type(screen.getByLabelText(/Target \(points\)/), '80')
    await user.click(screen.getByRole('button', { name: 'Save' }))
    expect((await studyDb.settings.get('dailyGoalMinutes'))?.value).toBe(75)

    await user.click(screen.getByRole('button', { name: 'New goal' }))
    await user.selectOptions(screen.getByLabelText('Metric'), 'manual')
    await user.selectOptions(screen.getByLabelText('Metric'), 'study_time')
    expect(screen.queryByLabelText('Progress (points)')).not.toBeInTheDocument()
    await user.selectOptions(screen.getByLabelText('Metric'), 'manual')
    expect(screen.getByLabelText('Progress (points)')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Cancel' }))

    await user.click(screen.getByRole('button', { name: 'New goal' }))
    await user.click(screen.getByRole('button', { name: 'Save' }))
    expect(screen.getByRole('alert')).toHaveTextContent('Enter a goal title.')
    await user.type(screen.getByLabelText('Goal title'), 'Invalid target goal')
    const targetInput = screen.getByLabelText(/Target \(points\)/)
    fireEvent.change(targetInput, { target: { value: '' } })
    await user.click(screen.getByRole('button', { name: 'Save' }))
    expect(screen.getByRole('alert')).toHaveTextContent('Target must be a number greater than zero.')
    fireEvent.change(targetInput, { target: { value: '0' } })
    await user.click(screen.getByRole('button', { name: 'Save' }))
    expect(screen.getByRole('alert')).toHaveTextContent('Target must be a number greater than zero.')
    fireEvent.change(targetInput, { target: { value: '-3' } })
    await user.click(screen.getByRole('button', { name: 'Save' }))
    expect(screen.getByRole('alert')).toHaveTextContent('Target must be a number greater than zero.')
    fireEvent.change(targetInput, { target: { value: '10' } })
    await user.click(screen.getByRole('button', { name: 'Save' }))
    expect(await studyDb.goals.toArray()).toEqual(expect.arrayContaining([
      expect.objectContaining({ title: 'Invalid target goal', target: 10, metric: 'manual' }),
    ]))

    await studyDb.goals.add({
      id: 'goal-persisted-metric',
      title: 'Persisted study goal',
      target: 4,
      progress: 99,
      period: 'weekly',
      metric: 'study_time',
      createdAt: timestamp,
      updatedAt: timestamp,
    })
    await waitFor(() => expect(screen.getByRole('button', { name: 'Edit Persisted study goal' })).toBeInTheDocument())
    await user.click(screen.getByRole('button', { name: 'Edit Persisted study goal' }))
    expect(screen.getByLabelText('Metric')).toHaveValue('study_time')
    expect(screen.queryByLabelText('Progress (points)')).not.toBeInTheDocument()
  }, 20_000)

  it('prevents duplicate goal create while save is pending', async () => {
    const user = userEvent.setup()
    let releaseAdd!: () => void
    const gate = new Promise<void>((resolve) => {
      releaseAdd = resolve
    })
    const originalAdd = studyDb.goals.add.bind(studyDb.goals)
    const addSpy = vi.spyOn(studyDb.goals, 'add').mockImplementation(async (goal) => {
      await gate
      return originalAdd(goal)
    })

    render(<App />)
    await user.click(await screen.findByRole('button', { name: 'Goals' }))
    await user.click(screen.getByRole('button', { name: 'New goal' }))
    await user.type(screen.getByLabelText('Goal title'), 'Pending goal')
    fireEvent.change(screen.getByLabelText(/Target \(points\)/), { target: { value: '40' } })
    await user.click(screen.getByRole('button', { name: 'Save' }))

    const savingButton = await screen.findByRole('button', { name: 'Creating goal...' })
    expect(savingButton).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeDisabled()
    expect(screen.getByLabelText('Metric')).toBeDisabled()
    await user.click(savingButton)
    expect(addSpy).toHaveBeenCalledTimes(1)

    releaseAdd()
    expect(await screen.findByText('Pending goal')).toBeInTheDocument()
    expect(await screen.findByRole('status')).toHaveTextContent('Goal created.')
    expect(await studyDb.goals.count()).toBe(1)
  })

  it('preserves goal draft after a failed create and allows retry', async () => {
    const user = userEvent.setup()
    vi.spyOn(console, 'error').mockImplementation(() => undefined)
    const originalAdd = studyDb.goals.add.bind(studyDb.goals)
    const addSpy = vi.spyOn(studyDb.goals, 'add')
      .mockRejectedValueOnce(new Error('IndexedDB goal write failed'))
      .mockImplementation(async (goal) => originalAdd(goal))

    render(<App />)
    await user.click(await screen.findByRole('button', { name: 'Goals' }))
    await user.click(screen.getByRole('button', { name: 'New goal' }))
    await user.type(screen.getByLabelText('Goal title'), 'Retry goal')
    await user.selectOptions(screen.getByLabelText('Metric'), 'manual')
    await user.selectOptions(screen.getByLabelText('Period'), 'weekly')
    fireEvent.change(screen.getByLabelText(/Target \(points\)/), { target: { value: '55' } })
    fireEvent.change(screen.getByLabelText('Progress (points)'), { target: { value: '11' } })
    await user.click(screen.getByRole('button', { name: 'Save' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('Goal could not be saved. Your details are still in the form.')
    expect(screen.getByLabelText('Goal title')).toHaveValue('Retry goal')
    expect(screen.getByLabelText('Goal title')).not.toHaveAttribute('aria-invalid', 'true')
    expect(screen.getByLabelText(/Target \(points\)/)).not.toHaveAttribute('aria-invalid', 'true')
    expect(screen.getByLabelText('Metric')).toHaveValue('manual')
    expect(screen.getByLabelText('Period')).toHaveValue('weekly')
    expect(screen.getByLabelText(/Target \(points\)/)).toHaveValue(55)
    expect(screen.getByLabelText('Progress (points)')).toHaveValue(11)
    expect(screen.getByRole('button', { name: 'Save' })).toBeEnabled()

    await user.click(screen.getByRole('button', { name: 'Save' }))
    expect(await screen.findByText('Retry goal')).toBeInTheDocument()
    expect(await screen.findByRole('status')).toHaveTextContent('Goal created.')
    expect(addSpy).toHaveBeenCalledTimes(2)
    expect((await studyDb.goals.toArray())[0]).toMatchObject({
      title: 'Retry goal',
      metric: 'manual',
      period: 'weekly',
      target: 55,
      progress: 11,
    })
  })

  it('associates goal validation errors with the responsible controls across metrics', async () => {
    const user = userEvent.setup()
    render(<App />)

    await user.click(await screen.findByRole('button', { name: 'Goals' }))
    await user.click(screen.getByRole('button', { name: 'New goal' }))
    await user.click(screen.getByRole('button', { name: 'Save' }))

    const titleInput = screen.getByLabelText('Goal title')
    const titleError = screen.getByRole('alert')
    expect(titleError).toHaveTextContent('Enter a goal title.')
    expect(titleError).toHaveAttribute('id', 'goal-title-error')
    expect(titleInput).toHaveAttribute('aria-invalid', 'true')
    expect(titleInput).toHaveAttribute('aria-describedby', 'goal-title-error')
    expect(await studyDb.goals.count()).toBe(0)

    await user.type(titleInput, 'Manual association goal')
    const targetInput = screen.getByLabelText(/Target \(points\)/)
    fireEvent.change(targetInput, { target: { value: '0' } })
    await user.click(screen.getByRole('button', { name: 'Save' }))

    const targetError = screen.getByRole('alert')
    expect(targetError).toHaveTextContent('Target must be a number greater than zero.')
    expect(targetError).toHaveAttribute('id', 'goal-target-error')
    expect(targetInput).toHaveAttribute('aria-invalid', 'true')
    expect(targetInput).toHaveAttribute('aria-describedby', 'goal-target-error')
    expect(titleInput).not.toHaveAttribute('aria-invalid', 'true')
    expect(await studyDb.goals.count()).toBe(0)

    await user.selectOptions(screen.getByLabelText('Metric'), 'study_time')
    expect(screen.queryByLabelText('Progress (points)')).not.toBeInTheDocument()
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    expect(screen.getByLabelText(/Target \(minutes\)/)).not.toHaveAttribute('aria-invalid', 'true')

    fireEvent.change(screen.getByLabelText(/Target \(minutes\)/), { target: { value: '' } })
    await user.click(screen.getByRole('button', { name: 'Save' }))

    const studyTarget = screen.getByLabelText(/Target \(minutes\)/)
    const studyTargetError = screen.getByRole('alert')
    expect(studyTargetError).toHaveTextContent('Target must be a number greater than zero.')
    expect(studyTarget).toHaveAttribute('aria-invalid', 'true')
    expect(studyTarget).toHaveAttribute('aria-describedby', 'goal-target-error')
    expect(await studyDb.goals.count()).toBe(0)

    fireEvent.change(studyTarget, { target: { value: '45' } })
    await user.click(screen.getByRole('button', { name: 'Save' }))

    expect(await screen.findByText('Manual association goal')).toBeInTheDocument()
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    expect((await studyDb.goals.toArray())[0]).toMatchObject({
      title: 'Manual association goal',
      metric: 'study_time',
      period: 'daily',
      target: 45,
    })
    expect((await studyDb.settings.get('dailyGoalMinutes'))?.value).toBe(45)
  })

  it('treats a missing-row goal edit as failure and keeps the editor open', async () => {
    const user = userEvent.setup()
    const timestamp = '2026-06-29T00:00:00.000Z'
    await studyDb.goals.add({
      id: 'goal-missing-edit',
      title: 'Existing goal',
      target: 30,
      progress: 5,
      period: 'daily',
      metric: 'manual',
      createdAt: timestamp,
      updatedAt: timestamp,
    })
    vi.spyOn(console, 'error').mockImplementation(() => undefined)
    vi.spyOn(studyDb.goals, 'update').mockResolvedValueOnce(0)

    render(<App />)
    await user.click(await screen.findByRole('button', { name: 'Goals' }))
    await user.click(await screen.findByLabelText('Edit Existing goal'))
    await user.clear(screen.getByLabelText('Goal title'))
    await user.type(screen.getByLabelText('Goal title'), 'Edited goal')
    fireEvent.change(screen.getByLabelText(/Target \(points\)/), { target: { value: '45' } })
    fireEvent.change(screen.getByLabelText('Progress (points)'), { target: { value: '9' } })
    await user.click(screen.getByRole('button', { name: 'Save' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('Goal could not be saved. Your details are still in the form.')
    expect(screen.getByLabelText('Goal title')).toHaveValue('Edited goal')
    expect(screen.getByLabelText('Metric')).toHaveValue('manual')
    expect(screen.getByLabelText(/Target \(points\)/)).toHaveValue(45)
    expect(screen.getByLabelText('Progress (points)')).toHaveValue(9)
  })

  it('rolls back daily study-time goal writes when dailyGoalMinutes update fails', async () => {
    const user = userEvent.setup()
    vi.spyOn(console, 'error').mockImplementation(() => undefined)
    await studyDb.settings.put({ key: 'dailyGoalMinutes', value: 120 })
    const originalPut = studyDb.settings.put.bind(studyDb.settings)
    vi.spyOn(studyDb.settings, 'put').mockImplementation(async (entry) => {
      if (entry.key === 'dailyGoalMinutes' && entry.value === 90) {
        throw new Error('settings write failed')
      }
      return originalPut(entry)
    })

    render(<App />)
    await user.click(await screen.findByRole('button', { name: 'Goals' }))
    await user.click(screen.getByRole('button', { name: 'New goal' }))
    await user.type(screen.getByLabelText('Goal title'), 'Atomic daily target')
    await user.selectOptions(screen.getByLabelText('Metric'), 'study_time')
    await user.selectOptions(screen.getByLabelText('Period'), 'daily')
    fireEvent.change(screen.getByLabelText(/Target \(minutes\)/), { target: { value: '90' } })
    await user.click(screen.getByRole('button', { name: 'Save' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('Goal could not be saved. Your details are still in the form.')
    expect(screen.getByLabelText('Goal title')).toHaveValue('Atomic daily target')
    expect(await studyDb.goals.count()).toBe(0)
    expect((await studyDb.settings.get('dailyGoalMinutes'))?.value).toBe(120)
  })

  it('updates dailyGoalMinutes only for successful daily study-time goal saves', async () => {
    const user = userEvent.setup()
    await studyDb.settings.put({ key: 'dailyGoalMinutes', value: 100 })

    render(<App />)
    await user.click(await screen.findByRole('button', { name: 'Goals' }))
    await user.click(screen.getByRole('button', { name: 'New goal' }))
    await user.type(screen.getByLabelText('Goal title'), 'Daily study minutes')
    await user.selectOptions(screen.getByLabelText('Metric'), 'study_time')
    await user.selectOptions(screen.getByLabelText('Period'), 'daily')
    fireEvent.change(screen.getByLabelText(/Target \(minutes\)/), { target: { value: '80' } })
    await user.click(screen.getByRole('button', { name: 'Save' }))

    expect(await screen.findByRole('status')).toHaveTextContent('Goal created.')
    expect((await studyDb.settings.get('dailyGoalMinutes'))?.value).toBe(80)

    await user.click(screen.getByRole('button', { name: 'New goal' }))
    await user.type(screen.getByLabelText('Goal title'), 'Daily focus manual')
    await user.selectOptions(screen.getByLabelText('Metric'), 'manual')
    await user.selectOptions(screen.getByLabelText('Period'), 'daily')
    fireEvent.change(screen.getByLabelText(/Target \(points\)/), { target: { value: '70' } })
    await user.click(screen.getByRole('button', { name: 'Save' }))

    expect(await screen.findByText('Daily focus manual')).toBeInTheDocument()
    expect((await studyDb.settings.get('dailyGoalMinutes'))?.value).toBe(80)
  })

  it('keeps a goal visible when confirmed deletion fails and blocks duplicate deletes', async () => {
    const user = userEvent.setup()
    const timestamp = '2026-06-29T00:00:00.000Z'
    await studyDb.goals.add({
      id: 'goal-delete-fail',
      title: 'Sticky goal',
      target: 20,
      progress: 2,
      period: 'daily',
      metric: 'manual',
      createdAt: timestamp,
      updatedAt: timestamp,
    })
    vi.spyOn(console, 'error').mockImplementation(() => undefined)

    let releaseDelete!: () => void
    const gate = new Promise<void>((resolve) => {
      releaseDelete = resolve
    })
    const originalDelete = studyDb.goals.delete.bind(studyDb.goals)
    const deleteSpy = vi.spyOn(studyDb.goals, 'delete').mockImplementation(async () => {
      await gate
      throw new Error('delete failed')
    })
    const confirmDelete = vi.spyOn(window, 'confirm').mockReturnValue(true)

    render(<App />)
    await user.click(await screen.findByRole('button', { name: 'Goals' }))
    await user.click(await screen.findByLabelText('Delete Sticky goal'))

    expect(await screen.findByLabelText('Deleting Sticky goal')).toBeDisabled()
    expect(screen.getByLabelText('Edit Sticky goal')).toBeDisabled()
    await user.click(screen.getByLabelText('Deleting Sticky goal'))
    expect(deleteSpy).toHaveBeenCalledTimes(1)

    releaseDelete()
    expect(await screen.findByRole('alert')).toHaveTextContent('Goal could not be deleted. Please try again.')
    expect(screen.getByText('Sticky goal')).toBeInTheDocument()

    deleteSpy.mockImplementation(async (id) => originalDelete(id))
    await user.click(screen.getByLabelText('Delete Sticky goal'))
    await waitFor(() => expect(screen.queryByText('Sticky goal')).not.toBeInTheDocument())
    expect(await screen.findByRole('status')).toHaveTextContent('Goal deleted.')
    confirmDelete.mockRestore()
  })
})
