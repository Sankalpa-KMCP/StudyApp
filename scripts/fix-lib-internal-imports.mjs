import { readFileSync, writeFileSync, readdirSync, statSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const libRoot = join(dirname(fileURLToPath(import.meta.url)), '..', 'src', 'lib')

const replacements = [
  // studyDashboard references from sibling folders
  ["from './studyDashboard'", "from '../study/studyDashboard'"],
  ["from \"./studyDashboard\"", "from '../study/studyDashboard'"],
  // db/types - add one more ..
  ["from '../db/", "from '../../db/"],
  ["from '../../db/", "from '../../../db/"],
  // types/app, navigation
  ["from '../types/", "from '../../types/"],
  ["from '../navigation/", "from '../../navigation/"],
  // shared constants from settings/study
  ["from './timerConstants'", "from '../shared/timerConstants'"],
  ["from '../dateConstants'", "from '../../shared/dateConstants'"],
  ["from './dateConstants'", "from '../shared/dateConstants'"],
  ["from './devLogger'", "from '../shared/devLogger'"],
  ["from './uxTerms'", "from '../shared/uxTerms'"],
  // settings cross-ref
  ["from './settingsSections'", "from '../settings/settingsSections'"],
  // theme self-ref fixes (over-corrected by first script)
  ["from './theme/theme'", "from './theme'"],
  ["from '../theme/theme'", "from '../theme'"],
  ["from '../../theme/theme'", "from '../../theme/theme'"],
  // studyDashboard internal db path (triple after first pass may be wrong - fix study folder)
  ["from '../../../db/types'", "from '../../../db/types'"],
]

// study/studyDashboard files need db at ../../../db
function walk(dir, files = []) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name)
    if (statSync(p).isDirectory()) walk(p, files)
    else if (/\.(ts|tsx)$/.test(name)) files.push(p)
  }
  return files
}

const files = walk(libRoot)
let changed = 0

for (const file of files) {
  let content = readFileSync(file, 'utf8')
  let next = content

  // Per-file fixes for study/studyDashboard (db was ../../db, needs ../../../db)
  if (file.includes('study\\studyDashboard') || file.includes('study/studyDashboard')) {
    next = next.replace(/from '\.\.\/\.\.\/db\//g, "from '../../../db/")
  }

  // study folder root files: ../db -> ../../db
  const rel = file.replace(libRoot, '').replace(/\\/g, '/')
  if (/^\/study\/[^/]+\.ts$/.test(rel)) {
    next = next.replace(/from '\.\.\/db\//g, "from '../../db/")
    next = next.replace(/from '\.\.\/types\//g, "from '../../types/")
  }

  for (const [from, to] of replacements) {
    next = next.split(from).join(to)
  }

  if (next !== content) {
    writeFileSync(file, next)
    changed++
  }
}
console.log(`Fixed ${changed} lib internal files`)
