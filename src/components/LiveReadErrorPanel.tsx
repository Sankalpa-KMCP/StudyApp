export type LiveReadErrorPanelProps = {
  message: string
  onRetry: () => void
}

/**
 * Accessible live-read failure presentation with an explicit Retry action.
 * Copy is supplied by the owning workspace (App vs Goals).
 */
export function LiveReadErrorPanel({ message, onRetry }: LiveReadErrorPanelProps) {
  return (
    <section className="loading-panel live-read-error-panel" role="alert">
      <div className="live-read-error-copy">
        <p>{message}</p>
        <button className="primary-command" type="button" onClick={onRetry}>
          Retry
        </button>
      </div>
    </section>
  )
}
