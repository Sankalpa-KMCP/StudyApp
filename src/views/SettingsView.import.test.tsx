import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { DataOperationCoordinator } from '../db/dataCoordinator'
import { getDatabaseGeneration } from '../db/databaseGeneration'
import { exportStudyData, getStudyData, importStudyData, parseAndNormalizeStudyExport, studyDb } from '../db/studyDb'
import { MAX_STUDY_EXPORT_IMPORT_BYTES } from '../db/studyExportLimits'
import { prepareStudyBackup } from '../db/prepareStudyBackup'
import { makeEmptyExport } from '../test/backupTestHelpers'
import { SettingsView } from './SettingsView'
import { DataOperationBusyError } from '../hooks/useStudyBackup'

function backup(payload: unknown = makeEmptyExport(), name = 'backup.json') {
  const text = typeof payload === 'string' ? payload : JSON.stringify(payload)
  const file = new File([text], name, { type: 'application/json' })
  Object.defineProperty(file, 'text', { value: vi.fn(async () => text), configurable: true })
  return file
}

function setup(onImport = vi.fn(async (file: File) => importStudyData(await file.text())), onExport = vi.fn(async () => { await exportStudyData() })) {
  const view = render(<SettingsView onImport={onImport} onExport={onExport} onClear={vi.fn()} onShowOnboardingChecklist={vi.fn()}
    theme="monochrome" onThemeChange={vi.fn()} profileNotice="" coordinatorState={new DataOperationCoordinator().getSnapshot()} />)
  return { ...view, onImport, onExport, input: screen.getByLabelText('Import data'), user: userEvent.setup() }
}

describe('backup review and confirmed replacement', () => {
  beforeEach(async () => {
    vi.restoreAllMocks()
    await studyDb.delete()
    await studyDb.open()
    await studyDb.settings.put({ key: 'quickNotes', value: ['Keep private current data'] })
  })

  it('validates without writes, shows counts and warning, exports without importing, and cancels with focus restoration', async () => {
    const before = await getStudyData()
    const exported: unknown[] = []
    const ui = setup(undefined, vi.fn(async () => { exported.push(await exportStudyData()) }))
    await ui.user.upload(ui.input, backup(makeEmptyExport({ settings: [{ key: 'quickNotes', value: ['Imported private text'] }] }), 'my-study.json'))
    const dialog = await screen.findByRole('dialog', { name: 'Review study backup' })
    expect(dialog).toHaveAccessibleDescription(/replaces all current local study data/)
    expect(within(dialog).getByText('my-study.json')).toBeInTheDocument()
    expect(within(dialog).getByText(/Settings: 1/)).toBeInTheDocument()
    expect(within(dialog).getByText(/Total records: 1/)).toBeInTheDocument()
    expect(screen.queryByText('Imported private text')).not.toBeInTheDocument()
    expect(ui.onImport).not.toHaveBeenCalled()
    expect(await getStudyData()).toEqual(before)
    await waitFor(() => expect(within(dialog).getByRole('button', { name: 'Cancel' })).toHaveFocus())
    await ui.user.click(within(dialog).getByRole('button', { name: 'Export current data first' }))
    expect(exported).toHaveLength(1)
    expect(parseAndNormalizeStudyExport(exported[0]).settings).toContainEqual({ key: 'quickNotes', value: ['Keep private current data'] })
    expect(ui.onImport).not.toHaveBeenCalled()
    await ui.user.keyboard('{Escape}')
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(ui.input).toHaveFocus()
    expect(await getStudyData()).toEqual(before)
    expect(await getDatabaseGeneration(studyDb.settings)).toBe(1)
    expect(screen.getByRole('status')).toHaveTextContent('Import cancelled.')
  })

  it.each([1, 2, 3, 4])('reviews legacy/current format %s and replaces only after confirmation', async (version) => {
    const before = await getStudyData()
    const ui = setup()
    await ui.user.upload(ui.input, backup(makeEmptyExport({ version })))
    expect(await screen.findByRole('dialog')).toHaveTextContent(`Backup format: version ${version}`)
    expect(await getStudyData()).toEqual(before)
    await ui.user.click(screen.getByRole('button', { name: 'Replace my study data' }))
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('Study data imported.'))
    expect(await studyDb.settings.get('quickNotes')).toBeUndefined()
    expect(await getDatabaseGeneration(studyDb.settings)).toBe(2)
    expect(ui.onImport).toHaveBeenCalledTimes(1)
  })

  it.each(['not json', { version: 99 }, makeEmptyExport({ settings: [{ key: 'activeFocusSession', value: {} }] })])('rejects invalid input without a confirmation or mutation (%j)', async (payload) => {
    const before = await getStudyData()
    const ui = setup()
    await ui.user.upload(ui.input, backup(payload))
    expect(await screen.findByRole('alert')).toHaveTextContent('Import failed.')
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(ui.onImport).not.toHaveBeenCalled()
    expect(await getStudyData()).toEqual(before)
  })

  it('rejects an oversized file before reading and preserves parser error codes', async () => {
    const file = backup()
    Object.defineProperty(file, 'size', { value: MAX_STUDY_EXPORT_IMPORT_BYTES + 1 })
    const before = await getStudyData()
    const ui = setup()
    await ui.user.upload(ui.input, file)
    expect(await screen.findByRole('alert')).toHaveTextContent('Import failed.')
    expect(file.text).not.toHaveBeenCalled()
    expect(await getStudyData()).toEqual(before)
    await expect(prepareStudyBackup(backup('not json'))).rejects.toMatchObject({ code: 'invalid_json' })
    await expect(prepareStudyBackup(backup(makeEmptyExport({ version: 99 })))).rejects.toMatchObject({ code: 'future_version' })
  })

  it.each(['success', 'error'])('ignores older validation %s after a newer selection', async (outcome) => {
    const ui = setup()
    let settle!: (value: string) => void
    let reject!: (error: Error) => void
    const old = backup(undefined, 'old.json')
    Object.defineProperty(old, 'text', { value: () => new Promise<string>((resolve, fail) => { settle = resolve; reject = fail }) })
    await ui.user.upload(ui.input, old)
    await ui.user.upload(ui.input, backup(undefined, 'new.json'))
    expect(await screen.findByRole('dialog')).toHaveTextContent('new.json')
    await act(async () => { if (outcome === 'success') settle(JSON.stringify(makeEmptyExport())); else reject(new Error('Old read failed')) })
    expect(screen.getByRole('dialog')).toHaveTextContent('new.json')
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    expect(ui.onImport).not.toHaveBeenCalled()
  })

  it.each(['cancel', 'unmount'])('does not reopen or import when delayed validation settles after %s', async (action) => {
    const before = await getStudyData()
    const ui = setup()
    let release!: (value: string) => void
    const file = backup()
    Object.defineProperty(file, 'text', { value: () => new Promise<string>((resolve) => { release = resolve }) })
    await ui.user.upload(ui.input, file)
    if (action === 'cancel') await ui.user.click(screen.getByRole('button', { name: 'Cancel validation' }))
    else ui.unmount()
    await act(async () => { release(JSON.stringify(makeEmptyExport())) })
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(ui.onImport).not.toHaveBeenCalled()
    expect(await getStudyData()).toEqual(before)
  })

  it('blocks rapid duplicate confirmation and cancellation after replacement starts', async () => {
    let release!: () => void
    const gate = new Promise<void>((resolve) => { release = resolve })
    const onImport = vi.fn(async (file: File) => { await gate; return importStudyData(await file.text()) })
    const ui = setup(onImport)
    await ui.user.upload(ui.input, backup())
    const confirm = await screen.findByRole('button', { name: 'Replace my study data' })
    act(() => { fireEvent.click(confirm); fireEvent.click(confirm) })
    expect(onImport).toHaveBeenCalledTimes(1)
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeDisabled()
    expect(ui.input).toBeDisabled()
    await ui.user.keyboard('{Escape}')
    expect(screen.getByRole('dialog')).toBeInTheDocument()
    await act(async () => { release(); await onImport.mock.results[0].value })
    expect(await getDatabaseGeneration(studyDb.settings)).toBe(2)
    expect(screen.getByRole('status')).toHaveTextContent('Study data imported.')
  })

  it('rolls back failed confirmed replacement and permits a new selection', async () => {
    const before = await getStudyData()
    const onImport = vi.fn(async (file: File) => importStudyData(await file.text(), { abortTransaction: true }))
    const ui = setup(onImport)
    await ui.user.upload(ui.input, backup())
    await ui.user.click(await screen.findByRole('button', { name: 'Replace my study data' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Import failed.')
    expect(await getStudyData()).toEqual(before)
    expect(await getDatabaseGeneration(studyDb.settings)).toBe(1)
    await ui.user.upload(ui.input, backup())
    expect(await screen.findByRole('dialog')).toBeInTheDocument()
  })

  it('blocks replacement while optional export is pending and still permits cancellation', async () => {
    let release!: () => void
    const gate = new Promise<void>((resolve) => { release = resolve })
    const ui = setup(undefined, vi.fn(async () => gate))
    const before = await getStudyData()
    await ui.user.upload(ui.input, backup())
    await ui.user.click(await screen.findByRole('button', { name: 'Export current data first' }))
    expect(screen.getByRole('button', { name: 'Replace my study data' })).toBeDisabled()
    await ui.user.click(screen.getByRole('button', { name: 'Cancel' }))
    await act(async () => { release() })
    expect(ui.onImport).not.toHaveBeenCalled()
    expect(await getStudyData()).toEqual(before)
    expect(screen.getByRole('status')).toHaveTextContent('Import cancelled.')
  })

  it('reports a coordinator conflict without suggesting that the valid backup is invalid', async () => {
    const onImport = vi.fn(async () => { throw new DataOperationBusyError() })
    const ui = setup(onImport)
    const before = await getStudyData()
    await ui.user.upload(ui.input, backup())
    await ui.user.click(await screen.findByRole('button', { name: 'Replace my study data' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('A data operation is currently in progress.')
    expect(await getStudyData()).toEqual(before)
  })
})
