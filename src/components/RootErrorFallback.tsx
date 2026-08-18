export const ROOT_ERROR_MESSAGE =
  'Something went wrong while showing this page. Your study data is still on this device.'

export type RootErrorFallbackProps = {
  onReload: () => void
}

/**
 * Full-page fallback for unexpected render failures. Reload only — no data mutation.
 */
export function RootErrorFallback({ onReload }: RootErrorFallbackProps) {
  return (
    <main className="root-error-shell" aria-label="Application error">
      <section className="loading-panel live-read-error-panel root-error-panel" role="alert">
        <div className="live-read-error-copy">
          <p>{ROOT_ERROR_MESSAGE}</p>
          <button className="primary-command" type="button" onClick={onReload}>
            Reload
          </button>
        </div>
      </section>
    </main>
  )
}
