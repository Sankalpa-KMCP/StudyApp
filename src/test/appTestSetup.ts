import { act } from '@testing-library/react'
import { vi } from 'vitest'
import { studyDb } from '../db/studyDb'

/** Reset timers, mocks, preference storage, theme meta, and IndexedDB for App suites. */
export async function resetAppTestEnvironment(): Promise<void> {
  vi.useRealTimers()
  vi.restoreAllMocks()
  localStorage.clear()
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
