import { readFileSync, writeFileSync, readdirSync, statSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const webRoot = dirname(fileURLToPath(import.meta.url.replace('scripts/update-lib-imports.mjs', '')))
const root = join(dirname(fileURLToPath(import.meta.url)), '..', 'src')

const replacements = [
  ['lib/studyDashboard', 'lib/study/studyDashboard'],
  ['lib/backupExport', 'lib/backup/backupExport'],
  ['lib/backupMerge', 'lib/backup/backupMerge'],
  ['lib/backupCrypto', 'lib/backup/backupCrypto'],
  ['lib/backupChecksum', 'lib/backup/backupChecksum'],
  ['lib/backupMetadata', 'lib/backup/backupMetadata'],
  ['lib/backupShare', 'lib/backup/backupShare'],
  ['lib/backupTerms', 'lib/backup/backupTerms'],
  ['lib/icsExport', 'lib/export/icsExport'],
  ['lib/icsImport', 'lib/export/icsImport'],
  ['lib/weeklyReportExport', 'lib/export/weeklyReportExport'],
  ['lib/applyThemeVars', 'lib/theme/applyThemeVars'],
  ['lib/loadAppFonts', 'lib/theme/loadAppFonts'],
  ['lib/contrast', 'lib/theme/contrast'],
  ['lib/tauri', 'lib/desktop/tauri'],
  ['lib/focusNotifications', 'lib/desktop/focusNotifications'],
  ['lib/wakeLock', 'lib/desktop/wakeLock'],
  ['lib/ambientAudio', 'lib/audio/ambientAudio'],
  ['lib/appHashRouting', 'lib/routing/appHashRouting'],
  ['lib/activeTabSync', 'lib/routing/activeTabSync'],
  ['lib/journalNavigation', 'lib/routing/journalNavigation'],
  ['lib/prefetchTabChunks', 'lib/routing/prefetchTabChunks'],
  ['lib/commandPaletteSearch', 'lib/routing/commandPaletteSearch'],
  ['lib/settingsValidation', 'lib/settings/settingsValidation'],
  ['lib/settingsSections', 'lib/settings/settingsSections'],
  ['lib/recurrence', 'lib/study/recurrence'],
  ['lib/resolveTimerDurations', 'lib/study/resolveTimerDurations'],
  ['lib/focusLockout', 'lib/study/focusLockout'],
  ['lib/taskTemplates', 'lib/study/taskTemplates'],
  ['lib/setupChecklist', 'lib/study/setupChecklist'],
  ['lib/flashcardReviewPending', 'lib/study/flashcardReviewPending'],
  ['lib/flashcardImport', 'lib/study/flashcardImport'],
  ['lib/uxTerms', 'lib/shared/uxTerms'],
  ['lib/dateConstants', 'lib/shared/dateConstants'],
  ['lib/timerConstants', 'lib/shared/timerConstants'],
  ['lib/devLogger', 'lib/shared/devLogger'],
  ['lib/copyDebugInfo', 'lib/shared/copyDebugInfo'],
  ['lib/shortcutToasts', 'lib/shared/shortcutToasts'],
  ['lib/autoExportSchedule', 'lib/shared/autoExportSchedule'],
  ['lib/markdownRender', 'lib/shared/markdownRender'],
  // theme.ts last — avoid partial match on applyThemeVars etc.
  ["from './theme'", "from './theme/theme'"],
  ["from '../theme'", "from '../theme/theme'"],
  ["from '../../theme'", "from '../../theme/theme'"],
  ["from '../../../theme'", "from '../../../theme/theme'"],
  ['lib/theme', 'lib/theme/theme'],
]

function walk(dir, files = []) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name)
    if (statSync(p).isDirectory()) {
      if (name === 'node_modules' || name === 'dist') continue
      walk(p, files)
    } else if (/\.(ts|tsx|mjs|js)$/.test(name)) {
      files.push(p)
    }
  }
  return files
}

const dirs = [
  join(root),
  join(root, '..', 'e2e'),
  join(root, '..', 'vitest.components.config.ts'),
  join(root, '..', 'vitest.settings.config.ts'),
].filter(p => {
  try { statSync(p); return true } catch { return false }
})

let files = walk(root)
try {
  const e2e = join(root, '..', 'e2e')
  files = files.concat(walk(e2e))
} catch {}

for (const cfg of ['vitest.components.config.ts', 'vitest.settings.config.ts', 'vitest.config.ts']) {
  const p = join(root, '..', cfg)
  try { files.push(p) } catch {}
}

let changed = 0
for (const file of files) {
  let content = readFileSync(file, 'utf8')
  let next = content
  for (const [from, to] of replacements) {
    next = next.split(from).join(to)
  }
  if (next !== content) {
    writeFileSync(file, next)
    changed++
  }
}
console.log(`Updated ${changed} files`)
