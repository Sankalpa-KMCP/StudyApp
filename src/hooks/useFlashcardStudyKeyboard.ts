import { useEffect } from 'react'

interface UseFlashcardStudyKeyboardOptions {
  enabled: boolean
  isFlipped: boolean
  sessionCompleted: boolean
  onFlip: () => void
  onGrade: (grade: number) => void
  onClose: () => void
}

function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false
  const tag = target.tagName
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || target.isContentEditable
}

export function useFlashcardStudyKeyboard({
  enabled,
  isFlipped,
  sessionCompleted,
  onFlip,
  onGrade,
  onClose,
}: UseFlashcardStudyKeyboardOptions) {
  useEffect(() => {
    if (!enabled) return

    const onKeyDown = (e: KeyboardEvent) => {
      if (isTypingTarget(e.target)) return

      if (e.key === 'Escape') {
        e.preventDefault()
        onClose()
        return
      }

      if (sessionCompleted) return

      if (e.key === ' ' || e.code === 'Space') {
        e.preventDefault()
        onFlip()
        return
      }

      if (!isFlipped) return

      const gradeMap: Record<string, number> = { '1': 1, '2': 2, '4': 4, '5': 5 }
      const grade = gradeMap[e.key]
      if (grade !== undefined) {
        e.preventDefault()
        onGrade(grade)
      }
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [enabled, isFlipped, sessionCompleted, onFlip, onGrade, onClose])
}
