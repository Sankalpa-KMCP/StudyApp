export function canSendFocusNotification(): boolean {
  return typeof Notification !== 'undefined' && Notification.permission === 'granted'
}

export function sendFocusBlockCompleteNotification(
  timerMode: 'study' | 'break',
  options?: { useDesktopNative?: boolean },
): void {
  const title = timerMode === 'study' ? 'Focus block complete' : 'Break complete'
  const body = timerMode === 'study'
    ? 'Take a break or start your next study block.'
    : 'Ready to start your next focus block?'

  if (options?.useDesktopNative) {
    void import('./tauri').then(({ isTauri, sendDesktopNotification }) => {
      if (isTauri()) void sendDesktopNotification(title, body)
    })
    return
  }

  if (!canSendFocusNotification()) return
  new Notification(title, { body, tag: timerMode === 'study' ? 'focus-block-complete' : 'break-complete' })
}
