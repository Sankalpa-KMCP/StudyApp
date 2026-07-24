/** Maximum backup import file size (5 MiB). Checked via `File.size` before reading. */
export const MAX_STUDY_EXPORT_IMPORT_BYTES = 5 * 1024 * 1024

/**
 * Maximum backup import text length after `file.text()`.
 * Defense in depth before `JSON.parse` when reported size is wrong or misleading.
 */
export const MAX_STUDY_EXPORT_IMPORT_CHARS = 5 * 1024 * 1024

/** Stable internal error; Settings maps failures to a fixed friendly message. */
export const STUDY_EXPORT_IMPORT_SIZE_ERROR = 'Import file exceeds the Study Dashboard size limit.'

export function assertStudyExportImportFileSize(file: Pick<File, 'size'>): void {
  if (file.size > MAX_STUDY_EXPORT_IMPORT_BYTES) {
    throw new Error(STUDY_EXPORT_IMPORT_SIZE_ERROR)
  }
}

export function assertStudyExportImportTextLength(text: string): void {
  if (text.length > MAX_STUDY_EXPORT_IMPORT_CHARS) {
    throw new Error(STUDY_EXPORT_IMPORT_SIZE_ERROR)
  }
}
