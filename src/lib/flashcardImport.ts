export interface FlashcardImportRow {
  front: string
  back: string
  category?: string
}

function parseCsvLine(line: string): string[] {
  const fields: string[] = []
  let current = ''
  let inQuotes = false
  for (let i = 0; i < line.length; i += 1) {
    const char = line[i]
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"'
        i += 1
      } else {
        inQuotes = !inQuotes
      }
    } else if (char === ',' && !inQuotes) {
      fields.push(current.trim())
      current = ''
    } else {
      current += char
    }
  }
  fields.push(current.trim())
  return fields
}

export function parseFlashcardCsv(text: string): FlashcardImportRow[] {
  const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean)
  if (lines.length === 0) return []

  const firstFields = parseCsvLine(lines[0]).map(f => f.toLowerCase())
  const hasHeader =
    firstFields.includes('front') ||
    firstFields.includes('question') ||
    (firstFields[0]?.includes('front') ?? false)

  const dataLines = hasHeader ? lines.slice(1) : lines
  const rows: FlashcardImportRow[] = []

  for (const line of dataLines) {
    const [front, back, category] = parseCsvLine(line)
    if (!front?.trim() || !back?.trim()) continue
    rows.push({
      front: front.trim(),
      back: back.trim(),
      category: category?.trim() || undefined,
    })
  }

  return rows
}

function parseTsvLine(line: string): string[] {
  return line.split('\t').map(f => f.trim())
}

export function parseFlashcardTsv(text: string): FlashcardImportRow[] {
  const lines = text.split(/\r?\n/).map(l => l.trim()).filter(l => l && !l.startsWith('#'))
  if (lines.length === 0) return []

  const firstFields = parseTsvLine(lines[0]).map(f => f.toLowerCase())
  const hasHeader =
    firstFields.includes('front') ||
    firstFields.includes('question') ||
    firstFields[0] === 'front'

  const dataLines = hasHeader ? lines.slice(1) : lines
  const rows: FlashcardImportRow[] = []

  for (const line of dataLines) {
    const [front, back, category] = parseTsvLine(line)
    if (!front?.trim() || !back?.trim()) continue
    rows.push({
      front: front.trim(),
      back: back.trim(),
      category: category?.trim() || undefined,
    })
  }

  return rows
}

/** Detect CSV vs tab-separated (Anki plain-text export) by delimiter density. */
export function parseFlashcardImport(text: string, filename?: string): FlashcardImportRow[] {
  const ext = filename?.split('.').pop()?.toLowerCase()
  if (ext === 'txt' || ext === 'tsv') return parseFlashcardTsv(text)
  if (ext === 'csv') return parseFlashcardCsv(text)

  const sample = text.split(/\r?\n/).find(l => l.trim() && !l.trim().startsWith('#')) ?? ''
  const tabCount = (sample.match(/\t/g) ?? []).length
  const commaCount = (sample.match(/,/g) ?? []).length
  return tabCount > commaCount ? parseFlashcardTsv(text) : parseFlashcardCsv(text)
}
