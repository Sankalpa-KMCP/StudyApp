import { Component, type ErrorInfo, type ReactNode } from 'react'

type LiveReadErrorBoundaryProps = {
  children: ReactNode
  fallback: ReactNode
}

type LiveReadErrorBoundaryState = {
  hasError: boolean
}

/**
 * Catches render-time failures from Dexie `useLiveQuery` (and other render errors).
 * Parent remounts this boundary via `key` to Retry with a fresh subscription.
 */
export class LiveReadErrorBoundary extends Component<LiveReadErrorBoundaryProps, LiveReadErrorBoundaryState> {
  state: LiveReadErrorBoundaryState = { hasError: false }

  static getDerivedStateFromError(): LiveReadErrorBoundaryState {
    return { hasError: true }
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error('Study live-read failed', error, info.componentStack)
  }

  render(): ReactNode {
    if (this.state.hasError) return this.props.fallback
    return this.props.children
  }
}
