import { Component, type ErrorInfo, type ReactNode } from 'react'
import { ErrorFallback } from './ErrorFallback'

interface ErrorBoundaryProps {
  children: ReactNode
}

interface ErrorBoundaryState {
  hasError: boolean
  message: string
  stack?: string
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { hasError: false, message: '' }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, message: error.message || 'Unexpected error', stack: error.stack }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Study Dashboard error boundary:', error, info.componentStack)
  }

  private handleReload = () => {
    window.location.reload()
  }

  private handleRetry = () => {
    this.setState({ hasError: false, message: '', stack: undefined })
  }

  render() {
    if (this.state.hasError) {
      return (
        <ErrorFallback
          message={this.state.message}
          stack={this.state.stack}
          onRetry={this.handleRetry}
          onReload={this.handleReload}
        />
      )
    }
    return this.props.children
  }
}
