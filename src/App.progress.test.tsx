import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import App from './App'
import { formatShortTime, toInputDate, toInputTime } from './appUtils'
import { studyDb } from './db/studyDb'
import { flushDeferredAppWork, resetAppTestEnvironment } from './test/appTestSetup'

describe('App progress', () => {
  beforeEach(async () => {
    await resetAppTestEnvironment()
  })

  afterEach(async () => {
    await flushDeferredAppWork()
  })

  it('creates, edits, and deletes journal sessions while updating derived progress', async () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date(2026, 6, 13, 15, 0))
    const user = userEvent.setup()
    const timestamp = new Date().toISOString()
    await studyDb.subjects.add({
      id: 'subject-journal',
      name: 'Physics',
      color: '#2563eb',
      targetHours: 1,
      progress: 0,
      createdAt: timestamp,
      updatedAt: timestamp,
    })
    await studyDb.goals.add({
      id: 'goal-journal',
      title: 'Daily focus',
      target: 60,
      progress: 0,
      period: 'daily',
      metric: 'study_time',
      createdAt: timestamp,
      updatedAt: timestamp,
    })
    const start = new Date(2026, 6, 13, 13, 0)

    render(<App />)
    await user.click(await screen.findByRole('button', { name: 'Progress' }))
    await user.click(screen.getByRole('button', { name: 'Log session' }))
    await user.selectOptions(screen.getByLabelText('Subject'), 'subject-journal')
    await user.clear(screen.getByLabelText('Date'))
    await user.type(screen.getByLabelText('Date'), toInputDate(start))
    await user.clear(screen.getByLabelText('Start time'))
    await user.type(screen.getByLabelText('Start time'), toInputTime(start))
    await user.clear(screen.getByLabelText('Duration (minutes)'))
    await user.type(screen.getByLabelText('Duration (minutes)'), '30')
    await user.type(screen.getByLabelText('Note Optional'), 'Worked through momentum problems')
    await user.click(screen.getByRole('button', { name: 'Save session' }))

    expect(await screen.findByRole('status')).toHaveTextContent('Study session recorded.')
    const journal = screen.getByRole('region', { name: 'Study journal' })
    expect(within(journal).getByLabelText(/Physics, .*30m/)).toBeInTheDocument()
    expect(within(journal).getByText('Worked through momentum problems')).toBeInTheDocument()
    expect(within(screen.getByText('Weekly study').closest('article')! as HTMLElement).getByText('0h 30m')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Home' }))
    expect(within(screen.getByLabelText('Today overview')).getByText('30m')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Subjects' }))
    expect(screen.getByRole('progressbar', { name: '50%' })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Goals' }))
    expect(screen.getByText('30/60 minutes')).toBeInTheDocument()
    expect(screen.getByRole('progressbar', { name: '50%' })).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Progress' }))
    const editSessionButton = screen.getByLabelText(/Edit Physics session at/)
    await user.click(editSessionButton)
    await waitFor(() => expect(screen.getByLabelText('Subject')).toHaveFocus())
    await user.clear(screen.getByLabelText('Duration (minutes)'))
    await user.type(screen.getByLabelText('Duration (minutes)'), '35')
    await user.click(screen.getByRole('button', { name: 'Cancel' }))
    await waitFor(() => expect(editSessionButton).toHaveFocus())
    expect((await studyDb.studySessions.toArray())[0].minutes).toBe(30)

    await user.click(editSessionButton)
    await user.clear(screen.getByLabelText('Duration (minutes)'))
    await user.type(screen.getByLabelText('Duration (minutes)'), '45')
    await user.clear(screen.getByLabelText('Note Optional'))
    await user.type(screen.getByLabelText('Note Optional'), 'Momentum and force review')
    await user.click(screen.getByRole('button', { name: 'Update session' }))

    await waitFor(async () => expect((await studyDb.studySessions.toArray())[0]).toMatchObject({ minutes: 45, note: 'Momentum and force review' }))
    await waitFor(() => expect(screen.getByLabelText(/Physics, .*45m/)).toBeInTheDocument())
    await waitFor(() => expect(editSessionButton).toHaveFocus())

    const confirmDelete = vi.spyOn(window, 'confirm').mockReturnValueOnce(false).mockReturnValueOnce(true)
    await user.click(screen.getByLabelText(/Delete Physics session at/))
    expect(await studyDb.studySessions.count()).toBe(1)
    await user.click(screen.getByLabelText(/Delete Physics session at/))
    await waitFor(() => expect(screen.queryByLabelText(/Physics, .*45m/)).not.toBeInTheDocument())
    expect(screen.getByRole('status')).toHaveTextContent('Study session deleted.')
    expect(confirmDelete).toHaveBeenCalledWith(`Delete session from ${formatShortTime(start.toISOString())}? This cannot be undone.`)

    await user.click(screen.getByRole('button', { name: 'Home' }))
    expect(within(screen.getByLabelText('Today overview')).getByText('0m')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Goals' }))
    expect(screen.getByText('0/60 minutes')).toBeInTheDocument()
    expect(screen.getByRole('progressbar', { name: '0%' })).toBeInTheDocument()
  }, 15_000)

  it('groups cross-midnight sessions by local start date while crediting metrics on their local end date', async () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date(2026, 6, 13, 0, 30))
    const user = userEvent.setup()

    render(<App />)
    await user.click(await screen.findByRole('button', { name: 'Progress' }))
    await user.click(screen.getByRole('button', { name: 'Log session' }))
    fireEvent.change(screen.getByLabelText('Date'), { target: { value: '2026-07-12' } })
    fireEvent.change(screen.getByLabelText('Start time'), { target: { value: '23:45' } })
    await user.clear(screen.getByLabelText('Duration (minutes)'))
    await user.type(screen.getByLabelText('Duration (minutes)'), '25')
    await user.click(screen.getByRole('button', { name: 'Save session' }))

    expect(await screen.findByRole('status')).toHaveTextContent('Study session recorded.')
    const journal = screen.getByRole('region', { name: 'Study journal' })
    expect(within(journal).getByRole('region', { name: 'Yesterday' })).toBeInTheDocument()
    expect(within(journal).getByLabelText(/General, .*25m/)).toBeInTheDocument()
    expect(within(screen.getByText('Weekly study').closest('article')! as HTMLElement).getByText('0h 25m')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Home' }))
    expect(within(screen.getByLabelText('Today overview')).getByText('25m')).toBeInTheDocument()
  })

  it('validates manual session fields and rejects future end times', async () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date(2026, 6, 13, 15, 0))
    await studyDb.studySessions.add({
      id: 'session-needs-subject',
      subjectId: 'missing-subject',
      startedAt: new Date(2026, 6, 13, 14, 0).toISOString(),
      endedAt: new Date(2026, 6, 13, 14, 30).toISOString(),
      minutes: 30,
      note: '',
    })
    const user = userEvent.setup()
    render(<App />)

    await user.click(await screen.findByRole('button', { name: 'Progress' }))
    await user.click(screen.getByLabelText(/Edit Missing subject session at/))
    await user.click(screen.getByRole('button', { name: 'Update session' }))
    expect(screen.getByRole('alert')).toHaveTextContent('Choose an available subject or General.')
    expect(screen.getByLabelText('Subject')).toHaveFocus()

    await user.selectOptions(screen.getByLabelText('Subject'), '')
    await user.click(screen.getByRole('button', { name: 'Update session' }))
    expect(await screen.findByRole('status')).toHaveTextContent('Study session updated.')
    expect((await studyDb.studySessions.toArray())[0].subjectId).toBe('')

    await user.click(screen.getByRole('button', { name: 'Log session' }))
    await user.clear(screen.getByLabelText('Duration (minutes)'))
    await user.type(screen.getByLabelText('Duration (minutes)'), '0')
    await user.click(screen.getByRole('button', { name: 'Save session' }))
    expect(screen.getByRole('alert')).toHaveTextContent('Duration must be at least 1 minute.')
    expect(screen.getByLabelText('Duration (minutes)')).toHaveFocus()

    await user.clear(screen.getByLabelText('Date'))
    await user.clear(screen.getByLabelText('Duration (minutes)'))
    await user.type(screen.getByLabelText('Duration (minutes)'), '30')
    await user.click(screen.getByRole('button', { name: 'Save session' }))
    expect(screen.getByRole('alert')).toHaveTextContent('Enter a valid date and start time.')
    expect(screen.getByLabelText('Date')).toHaveFocus()

    const now = new Date()
    await user.type(screen.getByLabelText('Date'), toInputDate(now))
    await user.clear(screen.getByLabelText('Start time'))
    await user.type(screen.getByLabelText('Start time'), toInputTime(now))
    await user.clear(screen.getByLabelText('Duration (minutes)'))
    await user.type(screen.getByLabelText('Duration (minutes)'), '1')
    await user.click(screen.getByRole('button', { name: 'Save session' }))
    expect(screen.getByRole('alert')).toHaveTextContent('Session end time cannot be in the future.')
    expect(screen.getByLabelText('Duration (minutes)')).toHaveFocus()
    expect((await studyDb.studySessions.toArray()).map((session) => session.id)).toEqual(['session-needs-subject'])
  })

  it('does not invoke Dexie when manual session validation fails', async () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date(2026, 6, 13, 15, 0))
    const user = userEvent.setup()
    const addSpy = vi.spyOn(studyDb.studySessions, 'add')
    const updateSpy = vi.spyOn(studyDb.studySessions, 'update')

    render(<App />)
    await user.click(await screen.findByRole('button', { name: 'Progress' }))
    await user.click(screen.getByRole('button', { name: 'Log session' }))
    await user.clear(screen.getByLabelText('Duration (minutes)'))
    await user.type(screen.getByLabelText('Duration (minutes)'), '0')
    await user.click(screen.getByRole('button', { name: 'Save session' }))

    expect(screen.getByRole('alert')).toHaveTextContent('Duration must be at least 1 minute.')
    expect(addSpy).not.toHaveBeenCalled()
    expect(updateSpy).not.toHaveBeenCalled()
  })

  it('prevents duplicate session create while save is pending', async () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date(2026, 6, 13, 15, 0))
    const user = userEvent.setup()
    let releaseAdd!: () => void
    const gate = new Promise<void>((resolve) => {
      releaseAdd = resolve
    })
    const originalAdd = studyDb.studySessions.add.bind(studyDb.studySessions)
    const addSpy = vi.spyOn(studyDb.studySessions, 'add').mockImplementation(async (session) => {
      await gate
      return originalAdd(session)
    })

    render(<App />)
    await user.click(await screen.findByRole('button', { name: 'Progress' }))
    await user.click(screen.getByRole('button', { name: 'Log session' }))
    fireEvent.change(screen.getByLabelText('Date'), { target: { value: '2026-07-13' } })
    fireEvent.change(screen.getByLabelText('Start time'), { target: { value: '14:00' } })
    await user.clear(screen.getByLabelText('Duration (minutes)'))
    await user.type(screen.getByLabelText('Duration (minutes)'), '25')
    await user.click(screen.getByRole('button', { name: 'Save session' }))

    const savingButton = await screen.findByRole('button', { name: 'Recording session...' })
    expect(savingButton).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeDisabled()
    expect(screen.getByLabelText('Subject')).toBeDisabled()
    await user.click(savingButton)
    expect(addSpy).toHaveBeenCalledTimes(1)

    releaseAdd()
    expect(await screen.findByRole('status')).toHaveTextContent('Study session recorded.')
    expect(await studyDb.studySessions.count()).toBe(1)
  })

  it('preserves session draft after a failed create and allows retry', async () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date(2026, 6, 13, 15, 0))
    const user = userEvent.setup()
    vi.spyOn(console, 'error').mockImplementation(() => undefined)
    const originalAdd = studyDb.studySessions.add.bind(studyDb.studySessions)
    const addSpy = vi.spyOn(studyDb.studySessions, 'add')
      .mockRejectedValueOnce(new Error('IndexedDB session write failed'))
      .mockImplementation(async (session) => originalAdd(session))

    render(<App />)
    await user.click(await screen.findByRole('button', { name: 'Progress' }))
    await user.click(screen.getByRole('button', { name: 'Log session' }))
    fireEvent.change(screen.getByLabelText('Date'), { target: { value: '2026-07-13' } })
    fireEvent.change(screen.getByLabelText('Start time'), { target: { value: '13:15' } })
    await user.clear(screen.getByLabelText('Duration (minutes)'))
    await user.type(screen.getByLabelText('Duration (minutes)'), '40')
    await user.type(screen.getByLabelText('Note Optional'), 'Retry note')
    await user.click(screen.getByRole('button', { name: 'Save session' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('Study session could not be saved. Your details are still in the form.')
    expect(screen.getByLabelText('Date')).toHaveValue('2026-07-13')
    expect(screen.getByLabelText('Start time')).toHaveValue('13:15')
    expect(screen.getByLabelText('Duration (minutes)')).toHaveValue(40)
    expect(screen.getByLabelText('Note Optional')).toHaveValue('Retry note')
    expect(screen.getByRole('button', { name: 'Save session' })).toBeEnabled()

    await user.click(screen.getByRole('button', { name: 'Save session' }))
    expect(await screen.findByRole('status')).toHaveTextContent('Study session recorded.')
    expect(addSpy).toHaveBeenCalledTimes(2)
    expect((await studyDb.studySessions.toArray())[0]).toMatchObject({
      minutes: 40,
      note: 'Retry note',
    })
  })

  it('treats a missing-row session edit as failure and keeps the editor open', async () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date(2026, 6, 13, 15, 0))
    const user = userEvent.setup()
    await studyDb.studySessions.add({
      id: 'session-missing-edit',
      subjectId: '',
      startedAt: new Date(2026, 6, 13, 12, 0).toISOString(),
      endedAt: new Date(2026, 6, 13, 12, 30).toISOString(),
      minutes: 30,
      note: 'Original note',
    })
    vi.spyOn(console, 'error').mockImplementation(() => undefined)
    vi.spyOn(studyDb.studySessions, 'update').mockResolvedValueOnce(0)

    render(<App />)
    await user.click(await screen.findByRole('button', { name: 'Progress' }))
    await user.click(screen.getByLabelText(/Edit General session at/))
    await user.clear(screen.getByLabelText('Duration (minutes)'))
    await user.type(screen.getByLabelText('Duration (minutes)'), '55')
    await user.clear(screen.getByLabelText('Note Optional'))
    await user.type(screen.getByLabelText('Note Optional'), 'Edited note')
    await user.click(screen.getByRole('button', { name: 'Update session' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('Study session could not be saved. Your details are still in the form.')
    expect(screen.getByLabelText('Duration (minutes)')).toHaveValue(55)
    expect(screen.getByLabelText('Note Optional')).toHaveValue('Edited note')
    expect(screen.getByRole('heading', { name: 'Edit study session' })).toBeInTheDocument()
  })

  it('keeps a session visible when confirmed deletion fails and blocks duplicate deletes', async () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date(2026, 6, 13, 15, 0))
    const user = userEvent.setup()
    const timestamp = new Date().toISOString()
    await studyDb.goals.add({
      id: 'goal-session-delete',
      title: 'Daily focus',
      target: 60,
      progress: 0,
      period: 'daily',
      metric: 'study_time',
      createdAt: timestamp,
      updatedAt: timestamp,
    })
    await studyDb.studySessions.add({
      id: 'session-delete-fail',
      subjectId: '',
      startedAt: new Date(2026, 6, 13, 13, 0).toISOString(),
      endedAt: new Date(2026, 6, 13, 13, 30).toISOString(),
      minutes: 30,
      note: 'Sticky session',
    })
    vi.spyOn(console, 'error').mockImplementation(() => undefined)

    let releaseDelete!: () => void
    const gate = new Promise<void>((resolve) => {
      releaseDelete = resolve
    })
    const originalDelete = studyDb.studySessions.delete.bind(studyDb.studySessions)
    const deleteSpy = vi.spyOn(studyDb.studySessions, 'delete').mockImplementation(async () => {
      await gate
      throw new Error('delete failed')
    })
    const confirmDelete = vi.spyOn(window, 'confirm').mockReturnValue(true)

    render(<App />)
    await user.click(await screen.findByRole('button', { name: 'Progress' }))
    expect(within(screen.getByText('Weekly study').closest('article')! as HTMLElement).getByText('0h 30m')).toBeInTheDocument()
    await user.click(screen.getByLabelText(/Delete General session at/))

    expect(await screen.findByLabelText(/Deleting General session at/)).toBeDisabled()
    expect(screen.getByLabelText(/Edit General session at/)).toBeDisabled()
    await user.click(screen.getByLabelText(/Deleting General session at/))
    expect(deleteSpy).toHaveBeenCalledTimes(1)

    releaseDelete()
    expect(await screen.findByRole('alert')).toHaveTextContent('Study session could not be deleted. Please try again.')
    expect(screen.getByText('Sticky session')).toBeInTheDocument()
    expect(within(screen.getByText('Weekly study').closest('article')! as HTMLElement).getByText('0h 30m')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Goals' }))
    expect(screen.getByText('30/60 minutes')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Progress' }))
    deleteSpy.mockImplementation(async (id) => originalDelete(id))
    await user.click(screen.getByLabelText(/Delete General session at/))
    await waitFor(() => expect(screen.queryByText('Sticky session')).not.toBeInTheDocument())
    expect(await screen.findByRole('status')).toHaveTextContent('Study session deleted.')
    expect(within(screen.getByText('Weekly study').closest('article')! as HTMLElement).getByText('0h')).toBeInTheDocument()
    confirmDelete.mockRestore()
  })

  it('labels sessions whose subject no longer exists', async () => {
    const now = new Date()
    const startedAt = new Date(now.getTime() - 30 * 60_000)
    await studyDb.studySessions.add({
      id: 'session-missing-subject',
      subjectId: 'deleted-subject',
      startedAt: startedAt.toISOString(),
      endedAt: now.toISOString(),
      minutes: 30,
      note: 'Imported study record',
    })
    const user = userEvent.setup()
    render(<App />)

    await user.click(await screen.findByRole('button', { name: 'Progress' }))
    expect(screen.getByText('Missing subject')).toHaveClass('is-missing')
    expect(screen.getByText('Imported study record')).toBeInTheDocument()
  })
})
