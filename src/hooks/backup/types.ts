export type StudyBackupExportDestination = 'auto' | 'download' | 'folder'

export interface StudyBackupExportOptions {
  destination?: StudyBackupExportDestination
  encrypt?: boolean
  passphrase?: string
}

export type StudyBackupImportMode = 'replace' | 'merge'

export interface StudyBackupImportOptions {
  mode?: StudyBackupImportMode
  passphrase?: string
}

export type PushToast = (key: string, message: string) => void
