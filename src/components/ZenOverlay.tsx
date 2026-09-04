import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import type { ActiveFocusSession, StudySubject } from '../db/types'
import { ConfirmDialog } from './ConfirmDialog'
import { formatMinutes } from '../appUtils'
import type { ZenCompletionOutcome } from '../App'

function formatTimer(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds))
  const hours = Math.floor(s / 3600)
  const minutes = Math.floor((s % 3600) / 60)
  const seconds = s % 60
  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
  }
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
}

export type ZenOverlayProps = {
  phase: 'active' | 'completed'
  activeSession: ActiveFocusSession | null
  completionOutcome?: ZenCompletionOutcome
  subjectMap: Map<string, StudySubject>
  elapsedSeconds: number
  remainingSeconds: number
  onPause: () => Promise<void> | void
  onResume: () => Promise<void> | void
  onStop: () => Promise<void> | void
  onExit: () => void
  onDone: () => void
}

export function ZenOverlay({
  phase,
  activeSession,
  completionOutcome,
  subjectMap,
  elapsedSeconds,
  remainingSeconds,
  onPause,
  onResume,
  onStop,
  onExit,
  onDone,
}: ZenOverlayProps) {
  const [confirmStopOpen, setConfirmStopOpen] = useState(false)
  const titleId = useId()
  const primaryButtonRef = useRef<HTMLButtonElement>(null)
  const doneButtonRef = useRef<HTMLButtonElement>(null)

  // Auto-focus primary action on mount or phase change
  useLayoutEffect(() => {
    const timeoutId = window.setTimeout(() => {
      if (phase === 'active') {
        primaryButtonRef.current?.focus()
      } else if (phase === 'completed') {
        doneButtonRef.current?.focus()
      }
    }, 0)
    return () => window.clearTimeout(timeoutId)
  }, [phase])

  // Lock body scroll while Zen overlay is mounted
  useEffect(() => {
    const originalOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = originalOverflow
    }
  }, [])

  // Escape key handler when ConfirmDialog is not capturing it
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      if (confirmStopOpen) return
      event.preventDefault()
      if (phase === 'active') {
        onExit()
      } else {
        onDone()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [confirmStopOpen, phase, onExit, onDone])

  const subjectName = activeSession?.subjectId
    ? (subjectMap.get(activeSession.subjectId)?.name ?? 'Subject')
    : 'General Focus'

  const isTimed = (activeSession?.plannedMinutes ?? 0) > 0
  const plannedMinutes = activeSession?.plannedMinutes ?? 0
  const targetSeconds = plannedMinutes * 60
  const progressPercent = isTimed && targetSeconds > 0
    ? Math.min(100, Math.round((elapsedSeconds / targetSeconds) * 100))
    : 0

  const status = activeSession?.status ?? 'running'

  return createPortal(
    <div
      className="zen-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
    >
      <div className="zen-header">
        <span className="zen-subject-badge">{phase === 'active' ? subjectName : 'Focus session'}</span>
        {phase === 'active' ? (
          <button
            className="secondary-command zen-exit-btn"
            type="button"
            onClick={onExit}
          >
            Exit Zen
          </button>
        ) : null}
      </div>

      {phase === 'active' ? (
        <div className="zen-canvas">
          <h2 id={titleId} className="zen-subject-title">{subjectName}</h2>
          <div className="zen-timer" aria-label={`Timer: ${isTimed ? formatTimer(remainingSeconds) + ' remaining' : formatTimer(elapsedSeconds) + ' elapsed'}`}>
            {isTimed ? formatTimer(remainingSeconds) : formatTimer(elapsedSeconds)}
          </div>
          {isTimed ? (
            <div
              className="zen-progress-bar"
              role="progressbar"
              aria-valuenow={progressPercent}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label="Session progress"
            >
              <div className="zen-progress-fill" style={{ width: `${progressPercent}%` }} />
            </div>
          ) : null}
          <div className="zen-context">
            {isTimed ? (
              <span>{formatTimer(elapsedSeconds)} elapsed · {formatMinutes(plannedMinutes)} target</span>
            ) : (
              <span>Open-ended focus</span>
            )}
          </div>
          <div className="zen-controls">
            <button
              ref={primaryButtonRef}
              className="primary-command zen-primary-btn"
              type="button"
              onClick={status === 'running' ? () => void onPause() : () => void onResume()}
            >
              {status === 'running' ? 'Pause' : 'Resume'}
            </button>
            <button
              className="text-command zen-stop-btn"
              type="button"
              onClick={() => setConfirmStopOpen(true)}
            >
              Stop session
            </button>
          </div>
        </div>
      ) : (
        <div className="zen-completed-canvas">
          <h2 id={titleId} className="zen-completed-title">
            {completionOutcome?.outcome === 'completed' ? 'Focus complete' : 'Session stopped'}
          </h2>
          <p className="zen-summary-text">
            <strong>{completionOutcome?.minutes ?? 0}m</strong> logged to {completionOutcome?.subjectName ?? 'General'}
          </p>
          <p className="zen-logged-hint">Logged to Progress journal.</p>
          <div className="zen-controls">
            <button
              ref={doneButtonRef}
              className="primary-command zen-primary-btn"
              type="button"
              onClick={onDone}
            >
              Done
            </button>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={confirmStopOpen}
        title="End this focus session?"
        description="Your completed study time will be saved."
        confirmLabel="End session"
        cancelLabel="Keep focusing"
        destructive
        onConfirm={async () => {
          setConfirmStopOpen(false)
          await onStop()
        }}
        onCancel={() => setConfirmStopOpen(false)}
      />
    </div>,
    document.body,
  )
}
