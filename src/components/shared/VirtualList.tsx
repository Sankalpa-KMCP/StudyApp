import { useRef, type ReactNode } from 'react'
import { useVirtualizer } from '@tanstack/react-virtual'

interface VirtualListProps<T> {
  items: T[]
  estimateSize?: number
  overscan?: number
  className?: string
  enabled?: boolean
  id?: string
  listAriaLabel?: string
  renderItem: (item: T, index: number) => ReactNode
  getKey?: (item: T, index: number) => string | number
}

export function VirtualList<T>({
  items,
  estimateSize = 120,
  overscan = 5,
  className = '',
  enabled = true,
  id,
  listAriaLabel,
  renderItem,
  getKey,
}: VirtualListProps<T>) {
  const parentRef = useRef<HTMLDivElement>(null)

  const virtualizer = useVirtualizer({
    count: items.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => estimateSize,
    overscan,
    enabled: enabled && items.length > 0,
  })

  const listProps = listAriaLabel
    ? { role: 'list' as const, 'aria-label': listAriaLabel }
    : {}

  if (!enabled || items.length === 0) {
    return (
      <div className={className} id={id} {...listProps}>
        {items.map((item, index) => (
          <div key={getKey?.(item, index) ?? index}>{renderItem(item, index)}</div>
        ))}
      </div>
    )
  }

  return (
    <div
      ref={parentRef}
      id={id}
      className={`overflow-y-auto custom-scrollbar ${className}`.trim()}
      {...listProps}
    >
      <div
        style={{
          height: `${virtualizer.getTotalSize()}px`,
          width: '100%',
          position: 'relative',
        }}
      >
        {virtualizer.getVirtualItems().map(virtualRow => {
          const item = items[virtualRow.index]
          return (
            <div
              key={getKey?.(item, virtualRow.index) ?? virtualRow.key}
              data-index={virtualRow.index}
              ref={virtualizer.measureElement}
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                transform: `translateY(${virtualRow.start}px)`,
              }}
            >
              {renderItem(item, virtualRow.index)}
            </div>
          )
        })}
      </div>
    </div>
  )
}
