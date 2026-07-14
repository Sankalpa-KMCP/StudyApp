import { useEffect, useState } from 'react'
import { Button } from '../shared/Button'
import { ModalShell } from '../shared/ModalShell'
import {
  resolveSyncConflict,
  subscribeSyncConflict,
  type SyncConflictSnapshot,
} from '../../lib/sync'
import {
  syncConflictDescription,
  syncConflictKeepLocal,
  syncConflictKeepRemote,
  syncConflictMerge,
  syncConflictPreviewCategories,
  syncConflictPreviewDailyLogs,
  syncConflictPreviewHistory,
  syncConflictPreviewSettings,
  syncConflictPreviewTasksAdded,
  syncConflictPreviewTasksUpdated,
  syncConflictPreviewTitle,
  syncConflictTitle,
} from '../../lib/sync/syncTerms'

function MergePreviewDetails({ preview }: { preview: SyncConflictSnapshot['preview'] }) {
  const lines = [
    preview.tasksAdded > 0 ? syncConflictPreviewTasksAdded(preview.tasksAdded) : null,
    preview.tasksUpdated > 0 ? syncConflictPreviewTasksUpdated(preview.tasksUpdated) : null,
    preview.historyToAppend > 0 ? syncConflictPreviewHistory(preview.historyToAppend) : null,
    preview.settingsFromRemote > 0 ? syncConflictPreviewSettings(preview.settingsFromRemote) : null,
    preview.dailyLogDeltas > 0 ? syncConflictPreviewDailyLogs(preview.dailyLogDeltas) : null,
    preview.categoriesRemapped > 0 ? syncConflictPreviewCategories(preview.categoriesRemapped) : null,
  ].filter((line): line is string => line !== null)

  if (lines.length === 0) {
    return (
      <p className="text-caption text-secondary leading-relaxed">
        No overlapping changes detected — merge will combine both versions.
      </p>
    )
  }

  return (
    <ul className="text-caption text-secondary leading-relaxed space-y-1 list-disc list-inside">
      {lines.map(line => (
        <li key={line}>{line}</li>
      ))}
    </ul>
  )
}

export function SyncConflictModal() {
  const [conflict, setConflict] = useState<SyncConflictSnapshot | null>(null)
  const [showPreview, setShowPreview] = useState(false)
  const [isResolving, setIsResolving] = useState(false)

  useEffect(() => {
    return subscribeSyncConflict(snapshot => {
      setConflict(snapshot)
      if (!snapshot) setShowPreview(false)
    })
  }, [])

  const open = conflict !== null

  async function handleResolve(action: 'keepLocal' | 'keepRemote' | 'merge') {
    setIsResolving(true)
    try {
      await resolveSyncConflict(action)
    } finally {
      setIsResolving(false)
    }
  }

  return (
    <ModalShell
      open={open}
      closeOnBackdrop={false}
      role="alertdialog"
      zIndexClass="z-[110]"
      ariaLabelledby="sync-conflict-title"
      ariaDescribedby="sync-conflict-desc"
      panelClassName="p-6 max-w-lg"
    >
      <h2 id="sync-conflict-title" className="text-sm font-bold text-primary mb-2">
        {syncConflictTitle()}
      </h2>
      <p id="sync-conflict-desc" className="text-caption text-secondary leading-relaxed mb-4">
        {syncConflictDescription()}
      </p>

      {showPreview && conflict && (
        <div className="rounded-xl border border-card surface-subtle p-3 mb-4">
          <p className="text-label font-semibold text-primary mb-2">{syncConflictPreviewTitle()}</p>
          <MergePreviewDetails preview={conflict.preview} />
        </div>
      )}

      <div className="flex flex-wrap justify-end gap-2">
        <Button
          variant="secondary"
          size="md"
          disabled={isResolving}
          onClick={() => { void handleResolve('keepLocal') }}
        >
          {syncConflictKeepLocal()}
        </Button>
        <Button
          variant="secondary"
          size="md"
          disabled={isResolving}
          onClick={() => { void handleResolve('keepRemote') }}
        >
          {syncConflictKeepRemote()}
        </Button>
        {!showPreview ? (
          <Button
            variant="secondary"
            size="md"
            disabled={isResolving}
            onClick={() => setShowPreview(true)}
          >
            {syncConflictPreviewTitle()}
          </Button>
        ) : (
          <Button
            variant="primary"
            size="md"
            disabled={isResolving}
            onClick={() => { void handleResolve('merge') }}
          >
            {syncConflictMerge()}
          </Button>
        )}
      </div>
    </ModalShell>
  )
}
