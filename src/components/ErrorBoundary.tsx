import { Component, type ErrorInfo, type ReactNode } from 'react'
import { db } from '../db/db'

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

  private handleCopyDebug = async () => {
    const debugInfo = [
      `message: ${this.state.message}`,
      `stack: ${this.state.stack ?? 'n/a'}`,
      `userAgent: ${navigator.userAgent}`,
      `dbSchemaVersion: ${db.verno}`,
      `timestamp: ${new Date().toISOString()}`,
    ].join('\n')
    try {
      await navigator.clipboard.writeText(debugInfo)
    } catch {
      // fallback for older browsers
      const textarea = document.createElement('textarea')
      textarea.value = debugInfo
      document.body.appendChild(textarea)
      textarea.select()
      document.execCommand('copy')
      document.body.removeChild(textarea)
    }
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex min-h-screen items-center justify-center bg-[#06070a] p-6">
          <div className="max-w-md rounded-2xl border border-white/10 bg-white/5 p-8 text-center backdrop-blur-xl">
            <h1 className="text-lg font-bold text-white mb-2">Something went wrong</h1>
            <p className="text-sm text-white/60 font-mono mb-6">{this.state.message}</p>
            <div className="flex flex-wrap gap-3 justify-center">
              <button
                type="button"
                onClick={this.handleRetry}
                className="px-4 py-2 rounded-lg bg-white/10 text-white text-sm hover:bg-white/20"
              >
                Try again
              </button>
              <button
                type="button"
                onClick={this.handleCopyDebug}
                className="px-4 py-2 rounded-lg bg-white/10 text-white text-sm hover:bg-white/20"
              >
                Copy debug info
              </button>
              <button
                type="button"
                onClick={this.handleReload}
                className="px-4 py-2 rounded-lg bg-accent-blue text-white text-sm hover:opacity-90"
              >
                Reload app
              </button>
            </div>
          </div>
        </div>
      )
    }
    return this.props.children
  }
}
