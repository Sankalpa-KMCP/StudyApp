export function canSendFocusNotification(): boolean {
  return typeof Notification !== 'undefined' && Notification.permission === 'granted'
}

export function sendFocusBlockCompleteNotification(timerMode: 'study' | 'break'): void {
  if (!canSendFocusNotification()) return
  if (timerMode === 'study') {
    new Notification('Focus block complete', {
      body: 'Take a break or start your next study block.',
      tag: 'focus-block-complete',
    })
  } else {
    new Notification('Break complete', {
      body: 'Ready to start your next focus block?',
      tag: 'break-complete',
    })
  }
}
