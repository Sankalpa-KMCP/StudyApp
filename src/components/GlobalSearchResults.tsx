import type { SearchResult } from '../appUtils'

export function GlobalSearchResults({
  id,
  query,
  results,
  activeIndex,
  onHoverIndex,
  onSelect,
}: {
  id: string
  query: string
  results: SearchResult[]
  activeIndex: number
  onHoverIndex: (index: number) => void
  onSelect: (result: SearchResult) => void
}) {
  const trimmed = query.trim()
  const statusLabel = results.length === 0
    ? `No matches for "${trimmed}"`
    : `${results.length} match${results.length === 1 ? '' : 'es'} for "${trimmed}"`

  return (
    <div className="global-search-panel">
      <p className="sr-only" role="status" aria-live="polite">
        {statusLabel}
      </p>
      <div
        id={id}
        className="global-search-results"
        role="listbox"
        aria-label={statusLabel}
      >
        {results.length === 0 ? (
          <div className="global-search-empty" role="presentation">
            <strong>No matches found</strong>
            <span>No tasks, notes, subjects, or events match that search.</span>
          </div>
        ) : (
          results.map((result, index) => {
            const optionId = `${id}-option-${index}`
            const selected = index === activeIndex
            return (
              <div
                key={`${result.type}-${result.id}`}
                id={optionId}
                className={selected ? 'global-search-option is-active' : 'global-search-option'}
                role="option"
                tabIndex={-1}
                aria-selected={selected}
                onMouseEnter={() => onHoverIndex(index)}
                onMouseDown={(event) => {
                  event.preventDefault()
                  onSelect(result)
                }}
              >
                <span className="pill">{result.type}</span>
                <span className="global-search-option-text">
                  <strong>{result.title}</strong>
                  <small>{result.meta}</small>
                </span>
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}
