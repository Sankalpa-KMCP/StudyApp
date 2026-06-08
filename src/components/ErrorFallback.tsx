import { useConfirm } from '../context/useConfirm'
import { db } from '../db/db'
import { Button } from './shared/Button'

interface ErrorFallbackProps {
  message: string
  stack?: string
  onRetry: () => void
  onReload: () => void
}

export function ErrorFallback({ message, stack, onRetry, onReload }: ErrorFallbackProps) {
  const { requestConfirm } = useConfirm()

  const handleCopyDebug = async () => {
    const debugInfo = [
      `message: ${message}`,
      `stack: ${stack ?? 'n/a'}`,
      `userAgent: ${navigator.userAgent}`,
      `dbSchemaVersion: ${db.verno}`,
      `timestamp: ${new Date().toISOString()}`,
    ].join('\n')
    try {
      await navigator.clipboard.writeText(debugInfo)
    } catch {
      const textarea = document.createElement('textarea')
      textarea.value = debugInfo
      document.body.appendChild(textarea)
      textarea.select()
      document.execCommand('copy')
      document.body.removeChild(textarea)
    }
  }

  const handleExportData = async () => {
    try {
      const [tasks, history, dailyLogs, settings, categories, flashcards, quickNotes] = await Promise.all([
        db.tasks.toArray(),
        db.history.toArray(),
        db.daily_logs.toArray(),
        db.settings.toArray(),
        db.categories.toArray(),
        db.flashcards.toArray(),
        db.quick_notes.toArray(),
      ])
      const data = {
        version: 2,
        exportedAt: new Date().toISOString(),
        tasks,
        history,
        dailyLogs,
        settings,
        categories,
        flashcards,
        quickNotes,
      }
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `study-emergency-export-${new Date().toISOString().slice(0, 10)}.studybackup`
      a.click()
      URL.revokeObjectURL(url)
    } catch (err) {
      console.error('Emergency export failed:', err)
    }
  }

  const handleResetDatabase = async () => {
    const ok = await requestConfirm({
      title: 'Reset database?',
      message: 'Export a backup first if you need your data.',
      confirmLabel: 'Reset',
      danger: true,
    })
    if (!ok) return
    try {
      await db.delete()
      await db.open()
      window.location.reload()
    } catch (err) {
      console.error('Database reset failed:', err)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#06070a] p-6">
      <div className="max-w-md rounded-2xl border border-white/10 bg-white/5 p-8 text-center backdrop-blur-xl">
        <h1 className="text-lg font-bold text-white mb-2">Something went wrong</h1>
        <p className="text-sm text-white/60 font-mono mb-6">{message}</p>
        <div className="flex flex-wrap gap-3 justify-center">
          <Button variant="secondary" size="sm" onClick={onRetry}>
            Try again
          </Button>
          <Button variant="secondary" size="sm" onClick={handleCopyDebug}>
            Copy debug info
          </Button>
          <Button variant="secondary" size="sm" onClick={handleExportData}>
            Export data
          </Button>
          <Button variant="danger" size="sm" onClick={handleResetDatabase}>
            Reset database
          </Button>
          <Button variant="primary" size="sm" onClick={onReload}>
            Reload app
          </Button>
        </div>
      </div>
    </div>
  )
}
