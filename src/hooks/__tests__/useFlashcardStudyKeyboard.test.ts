import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook } from '@testing-library/react'
import { useFlashcardStudyKeyboard } from '../useFlashcardStudyKeyboard'

describe('useFlashcardStudyKeyboard', () => {
  const onFlip = vi.fn()
  const onGrade = vi.fn()
  const onClose = vi.fn()

  beforeEach(() => {
    onFlip.mockClear()
    onGrade.mockClear()
    onClose.mockClear()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  function renderKeyboard(overrides: Partial<Parameters<typeof useFlashcardStudyKeyboard>[0]> = {}) {
    return renderHook(props => useFlashcardStudyKeyboard(props), {
      initialProps: {
        enabled: true,
        isFlipped: false,
        sessionCompleted: false,
        onFlip,
        onGrade,
        onClose,
        ...overrides,
      },
    })
  }

  it('flips on Space when session is active', () => {
    renderKeyboard()
    window.dispatchEvent(new KeyboardEvent('keydown', { key: ' ', code: 'Space', bubbles: true }))
    expect(onFlip).toHaveBeenCalledTimes(1)
  })

  it('grades with number keys when flipped', () => {
    renderKeyboard({ isFlipped: true })
    window.dispatchEvent(new KeyboardEvent('keydown', { key: '4', bubbles: true }))
    expect(onGrade).toHaveBeenCalledWith(4)

    onGrade.mockClear()
    window.dispatchEvent(new KeyboardEvent('keydown', { key: '1', bubbles: true }))
    expect(onGrade).toHaveBeenCalledWith(1)
  })

  it('closes on Escape', () => {
    renderKeyboard()
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('ignores shortcuts when typing in an input', () => {
    renderKeyboard({ isFlipped: true })
    const input = document.createElement('input')
    document.body.appendChild(input)
    input.dispatchEvent(new KeyboardEvent('keydown', { key: '4', bubbles: true }))
    expect(onGrade).not.toHaveBeenCalled()
    input.remove()
  })
})
