import { Component, type ErrorInfo, type ReactNode } from 'react'
import { RootErrorFallback } from './RootErrorFallback'

export type RootErrorBoundaryProps = {
  children: ReactNode
  /** Defaults to `window.location.reload`. Injectable for tests. */
  onReload?: () => void
}

type RootErrorBoundaryState = {
  hasError: boolean
}

function defaultReload(): void {
  window.location.reload()
}

/**
 * Catches unexpected render/lifecycle failures that escape scoped live-read boundaries.
 * Recovery is an explicit browser reload — not a live-query remount Retry.
 */
export class RootErrorBoundary extends Component<RootErrorBoundaryProps, RootErrorBoundaryState> {
  state: RootErrorBoundaryState = { hasError: false }

  static getDerivedStateFromError(): RootErrorBoundaryState {
    return { hasError: true }
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error('Study app render failed', error, info.componentStack)
  }

  render(): ReactNode {
    if (this.state.hasError) {
      return <RootErrorFallback onReload={this.props.onReload ?? defaultReload} />
    }
    return this.props.children
  }
}
