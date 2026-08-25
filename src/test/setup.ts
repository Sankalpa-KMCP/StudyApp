import '@testing-library/jest-dom/vitest'
import 'fake-indexeddb/auto'
import { cleanup } from '@testing-library/react'
import { afterEach, beforeEach } from 'vitest'
import { installInMemoryLockAdapter, resetTestLockManager } from '../db/crossTabLock'

beforeEach(() => {
  installInMemoryLockAdapter()
})

afterEach(() => {
  cleanup()
  resetTestLockManager()
})
