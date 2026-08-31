import { act, screen, within } from '@testing-library/react'
import type { UserEvent } from '@testing-library/user-event'
import { vi } from 'vitest'
import { installInMemoryLockAdapter } from '../db/crossTabLock'
import { studyDb } from '../db/studyDb'

/** Reset timers, mocks, preference storage, theme meta, URL, and IndexedDB for App suites. */
export async function resetAppTestEnvironment(): Promise<void> {
  installInMemoryLockAdapter()
  vi.useRealTimers()
  vi.restoreAllMocks()
  localStorage.clear()
  window.history.replaceState(null, '', '/')
  document.documentElement.dataset.theme = 'monochrome'
  let themeColorMeta = document.querySelector('meta[name="theme-color"]')
  if (!themeColorMeta) {
    themeColorMeta = document.createElement('meta')
    themeColorMeta.setAttribute('name', 'theme-color')
    document.head.append(themeColorMeta)
  }
  themeColorMeta.setAttribute('content', '#111111')
  await studyDb.delete()
  await studyDb.open()
}

/** Let deferred focus settle macrotasks finish before the next test wipes IndexedDB. */
export async function flushDeferredAppWork(): Promise<void> {
  vi.useRealTimers()
  await act(async () => {
    await new Promise((resolve) => window.setTimeout(resolve, 0))
  })
}

/** Confirm the open ConfirmDialog destructive action. */
export async function confirmOpenDeletion(user: UserEvent) {
  const dialog = await screen.findByRole('dialog', { name: 'Confirm deletion' })
  await user.click(within(dialog).getByRole('button', { name: 'Delete' }))
}

/** Cancel the open ConfirmDialog. */
export async function cancelOpenDeletion(user: UserEvent) {
  const dialog = await screen.findByRole('dialog', { name: 'Confirm deletion' })
  await user.click(within(dialog).getByRole('button', { name: 'Cancel' }))
}
