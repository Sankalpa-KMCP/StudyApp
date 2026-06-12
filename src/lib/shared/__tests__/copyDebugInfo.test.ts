import { describe, it, expect, vi, beforeEach } from 'vitest'
import { copyDebugInfo } from '../copyDebugInfo'

const writeTextMock = vi.fn().mockResolvedValue(undefined)

describe('copyDebugInfo', () => {
  beforeEach(() => {
    writeTextMock.mockClear()
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText: writeTextMock },
      configurable: true,
    })
  })

  it('writes text to clipboard', async () => {
    await copyDebugInfo('message: boom')
    expect(writeTextMock).toHaveBeenCalledWith('message: boom')
  })

  it('falls back to textarea copy when clipboard fails', async () => {
    writeTextMock.mockRejectedValueOnce(new Error('denied'))
    const execCommand = vi.fn().mockReturnValue(true)
    Object.defineProperty(document, 'execCommand', {
      value: execCommand,
      configurable: true,
    })

    await copyDebugInfo('message: boom')

    expect(execCommand).toHaveBeenCalledWith('copy')
  })
})
