import '@testing-library/jest-dom/vitest'
import 'fake-indexeddb/auto'
import { cleanup, configure } from '@testing-library/react'
import { afterEach } from 'vitest'

// App jointly awaits shell + Notes + Events + Flashcards live queries before first paint.
configure({ asyncUtilTimeout: 5_000 })

afterEach(() => {
  cleanup()
})
