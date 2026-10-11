import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { HomeView } from './HomeView'

type SaveQuickNotes = Parameters<typeof HomeView>[0]['onQuickNotesChange']

function setup(onChange: SaveQuickNotes = vi.fn(async () => {}), notes: string[] = [], density: 'comfortable' | 'compact' = 'comfortable') {
  const props: Parameters<typeof HomeView>[0] = {
    notes: [], events: [], tasks: [], studySessions: [], subjectMap: new Map(), weeklyStudyDays: [],
    quickNotes: notes, dailyGoalMinutes: 60, databaseGeneration: 1, onboardingChecklistDismissed: true,
    todayFocusMinutes: 0, currentDate: new Date('2026-10-11T12:00:00Z'), activeSession: null,
    staleFocusSession: null, staleFocusSubjectName: '', sessionLimitSeconds: 0, sessionNotice: '',
    canStartFocus: true, focusTransitionPending: false, subjects: [], focusSubjectId: '', focusDurationMinutes: 25,
    onFocusSubjectChange: vi.fn(), onFocusDurationChange: vi.fn(), onQuickNotesChange: onChange,
    onStartSession: vi.fn(), onPauseSession: vi.fn(), onResumeSession: vi.fn(), onStopSession: vi.fn(async () => {}),
    onAcceptStaleFocusSession: vi.fn(), onDiscardStaleFocusSession: vi.fn(), onNavigate: vi.fn(),
    onCreateSubject: vi.fn(), onCreateTask: vi.fn(), onRevealFocusSession: vi.fn(),
    onDismissOnboardingChecklist: vi.fn(async () => {}), density,
  }
  const view = render(<HomeView {...props} />)
  if (density === 'compact') fireEvent.click(view.container.querySelector('summary')!)
  return { ...view, onChange, textarea: screen.getByLabelText('Quick notes', { selector: 'textarea' }), props }
}
const advance = async (ms = 250) => { await act(async () => { await vi.advanceTimersByTimeAsync(ms) }) }
const change = (textarea: HTMLElement, value: string) => fireEvent.change(textarea, { target: { value } })

describe('Quick Notes autosave revisions', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => { cleanup(); vi.useRealTimers(); vi.restoreAllMocks() })

  it('stops after persistent failure, including blur and unmount, until explicit Retry', async () => {
    const onChange = vi.fn<() => Promise<void>>(async () => { throw new Error('Storage unavailable') })
    const ui = setup(onChange)
    change(ui.textarea, 'Keep full draft')
    await advance()
    expect(screen.getByRole('alert')).toHaveTextContent('could not be saved')
    await advance(5_000)
    fireEvent.blur(ui.textarea)
    await advance()
    expect(onChange).toHaveBeenCalledTimes(1)
    expect(ui.textarea).toHaveValue('Keep full draft')
    onChange.mockResolvedValueOnce(undefined)
    fireEvent.click(screen.getByRole('button', { name: 'Retry save' }))
    await advance(0)
    expect(onChange).toHaveBeenCalledTimes(2)
    expect(screen.getByText('Saved locally')).toBeInTheDocument()
    ui.unmount()
    expect(onChange).toHaveBeenCalledTimes(2)
  })

  it('allows a meaningful edit to save after failure, without retries of the unchanged failed draft', async () => {
    const onChange = vi.fn<SaveQuickNotes>(async () => {})
    onChange.mockRejectedValueOnce(new Error('Storage unavailable'))
    const ui = setup(onChange)
    change(ui.textarea, 'Failed')
    await advance()
    change(ui.textarea, 'Edited')
    expect(screen.getByText('Saving...')).toBeInTheDocument()
    await advance()
    expect(onChange.mock.calls.map(([value]) => value)).toEqual(['Failed', 'Edited'])
    expect(screen.getByText('Saved locally')).toBeInTheDocument()
  })

  it.each(['comfortable', 'compact'] as const)('retains nine lines and rejects persistence in %s mode', async (density) => {
    const ui = setup(undefined, ['Seed'], density)
    const nine = Array.from({ length: 9 }, (_, i) => `Line ${i}`).join('\n')
    change(ui.textarea, nine)
    expect(screen.getByRole('alert')).toHaveTextContent('8 nonblank lines')
    expect(ui.textarea).toHaveAttribute('aria-invalid', 'true')
    await advance(5_000)
    fireEvent.blur(ui.textarea)
    expect(ui.onChange).not.toHaveBeenCalled()
    expect(ui.textarea).toHaveValue(nine)
    expect(screen.queryByText('Saved locally')).not.toBeInTheDocument()
    const eight = nine.split('\n').slice(0, 8).join('\n')
    change(ui.textarea, eight)
    await advance()
    expect(ui.onChange).toHaveBeenCalledWith(eight, { expectedGeneration: 1 })
    expect(screen.getByText('Saved locally')).toBeInTheDocument()
  })

  it.each(['success', 'failure'] as const)('does not apply an old %s status to a newer invalid draft', async (outcome) => {
    let resolve!: () => void
    let reject!: (error: Error) => void
    const onChange = vi.fn(() => new Promise<void>((done, fail) => { resolve = done; reject = fail }))
    const ui = setup(onChange)
    change(ui.textarea, 'Old valid draft')
    await advance()
    const nine = Array(9).fill('Keep this line').join('\n')
    change(ui.textarea, nine)
    await act(async () => { if (outcome === 'success') resolve(); else reject(new Error('Storage unavailable')) })
    expect(ui.textarea).toHaveValue(nine)
    expect(screen.getByRole('alert')).toHaveTextContent('8 nonblank lines')
    expect(screen.queryByText('Saved locally')).not.toBeInTheDocument()
    await advance(1_000)
    expect(onChange).toHaveBeenCalledTimes(1)
  })

  it.each(['success', 'failure'] as const)('keeps the newer valid draft Saving when an older %s settles', async (outcome) => {
    let resolve!: () => void
    let reject!: (error: Error) => void
    let finishLatest!: () => void
    const onChange = vi.fn<(value: string) => Promise<void>>()
      .mockImplementationOnce(() => new Promise<void>((done, fail) => { resolve = done; reject = fail }))
      .mockImplementationOnce(() => new Promise<void>((done) => { finishLatest = done }))
    const ui = setup(onChange)
    change(ui.textarea, 'Old draft')
    await advance()
    change(ui.textarea, 'Latest draft')
    await advance()
    expect(onChange).toHaveBeenCalledTimes(1)
    await act(async () => { if (outcome === 'success') resolve(); else reject(new Error('Failed old write')) })
    expect(onChange).toHaveBeenCalledTimes(2)
    expect(ui.textarea).toHaveValue('Latest draft')
    expect(screen.getByText('Saving...')).toBeInTheDocument()
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    expect(screen.queryByText('Saved locally')).not.toBeInTheDocument()
    await act(async () => { finishLatest() })
    expect(screen.getByText('Saved locally')).toBeInTheDocument()
    await advance(1_000)
    expect(onChange.mock.calls.map(([value]) => value)).toEqual(['Old draft', 'Latest draft'])
  })

  it('does not retry a failed revision during unmount', async () => {
    const onChange = vi.fn<() => Promise<void>>(async () => { throw new Error('Storage unavailable') })
    const ui = setup(onChange)
    change(ui.textarea, 'Keep failed draft')
    await advance()
    ui.unmount()
    await advance(1_000)
    expect(onChange).toHaveBeenCalledTimes(1)
  })

  it('persists a reversion to the original text after an older write succeeds', async () => {
    let finish!: () => void
    const onChange = vi.fn<(value: string) => Promise<void>>()
      .mockImplementationOnce(() => new Promise<void>((done) => { finish = done }))
      .mockResolvedValue(undefined)
    const ui = setup(onChange, ['Original'])
    change(ui.textarea, 'Intermediate')
    await advance()
    change(ui.textarea, 'Original')
    await advance()
    await act(async () => { finish() })
    expect(onChange.mock.calls.map(([value]) => value)).toEqual(['Intermediate', 'Original'])
    expect(ui.textarea).toHaveValue('Original')
    expect(screen.getByText('Saved locally')).toBeInTheDocument()
  })

  it('recognizes already durable text when an obsolete write fails before the new debounce', async () => {
    let reject!: (error: Error) => void
    const onChange = vi.fn<(value: string) => Promise<void>>(() => new Promise<void>((_, fail) => { reject = fail }))
    const ui = setup(onChange, ['Original'])
    change(ui.textarea, 'Intermediate')
    await advance()
    change(ui.textarea, 'Original')
    await act(async () => { reject(new Error('Old write failed')) })
    expect(ui.textarea).toHaveValue('Original')
    expect(screen.getByText('Saved locally')).toBeInTheDocument()
    await advance(1_000)
    expect(onChange).toHaveBeenCalledTimes(1)
  })
})
