import { describe, it, expect, vi, afterEach } from 'vitest'
import { canSendFocusNotification, sendFocusBlockCompleteNotification } from '../focusNotifications'

describe('focusNotifications', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('no-ops when Notification permission is not granted', () => {
    expect(canSendFocusNotification()).toBe(false)
    expect(() => sendFocusBlockCompleteNotification('study')).not.toThrow()
  })

  it('creates a notification when permission is granted', () => {
    const instances: unknown[] = []
    class MockNotification {
      static permission = 'granted'
      constructor() {
        instances.push(this)
      }
    }
    vi.stubGlobal('Notification', MockNotification)

    sendFocusBlockCompleteNotification('break')
    expect(instances).toHaveLength(1)
  })
})
