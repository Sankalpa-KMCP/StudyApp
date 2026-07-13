import { useState } from 'react'

export function useBackupVaultPanelState() {
  const [sweepTasks, setSweepTasks] = useState(false)
  const [sweepHistory, setSweepHistory] = useState(false)
  const [sweepCategories, setSweepCategories] = useState(false)
  const [sweepNotes, setSweepNotes] = useState(false)
  const [storageKey, setStorageKey] = useState(0)
  const [encryptPassphrase, setEncryptPassphrase] = useState('')
  const [importPassphrase, setImportPassphrase] = useState('')
  const [importMode, setImportMode] = useState<'replace' | 'merge'>('replace')

  function resetSweepFlags() {
    setSweepTasks(false)
    setSweepHistory(false)
    setSweepCategories(false)
    setSweepNotes(false)
  }

  function bumpStorageKey() {
    setStorageKey(k => k + 1)
  }

  function prepareImportSession() {
    sessionStorage.setItem('backup_import_mode', importMode)
    sessionStorage.setItem('backup_import_passphrase', importPassphrase)
  }

  return {
    sweepTasks,
    setSweepTasks,
    sweepHistory,
    setSweepHistory,
    sweepCategories,
    setSweepCategories,
    sweepNotes,
    setSweepNotes,
    storageKey,
    encryptPassphrase,
    setEncryptPassphrase,
    importPassphrase,
    setImportPassphrase,
    importMode,
    setImportMode,
    resetSweepFlags,
    bumpStorageKey,
    prepareImportSession,
  }
}
