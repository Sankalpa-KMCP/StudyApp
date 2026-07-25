# Contributing

## Setup

```bash
npm ci
npm run dev
```

## Tests

| Command | Purpose |
|---------|---------|
| `npm test` | Vitest unit and component tests (full suite) |
| `npm run test:coverage` | Main coverage gate (all production `src/**/*.{ts,tsx}`) |
| `npm run test:e2e` | Playwright user journeys for Chromium desktop and mobile projects |
| `npm run lint` | ESLint including jsx-a11y rules |
| `npm run build` | TypeScript and production Vite build |
| `npm run check:bundle` | Gzip budget on built JS chunks |

### App integration suites

| File | Ownership |
|------|-----------|
| `src/App.test.tsx` | App shell only (theme, sidebar, notices, global search keyboard) |
| `src/App.focus.test.tsx` | Focus restore/actions/races, import-focus sync, timer a11y |
| `src/App.backup.test.tsx` | Export, ordinary import, clear-all |
| `src/App.goals.test.tsx` | Goals metrics and CRUD |
| `src/App.home.test.tsx` | Checklist, Home search, quick notes, midnight, Home chart a11y |
| `src/App.navigation.test.tsx` | Widget and view navigation |
| `src/App.workspaces.test.tsx` | Tasks / Notes / Subjects / Calendar / Flashcards |
| `src/App.progress.test.tsx` | Progress study journal |

Shared App suite reset lives in `src/test/appTestSetup.ts` (plus small focus/backup/home helpers). Prefer the matching feature suite when adding App-level coverage.

Coverage (`vitest.config.ts`) instruments all production `src/**/*.{ts,tsx}` files and excludes tests, `src/test/**`, and `*.d.ts`. Thresholds stay at 80% lines/functions/statements and 70% branches. Do not lower those thresholds to green a change. CI enforces this gate with `npm run test:coverage` (not a separate plain `npm test` step).

## Data Safety

Study data is local-first and stored in IndexedDB through Dexie. Keep destructive flows confirmed by the user and covered by tests.

Backup import validates size, shape/version, uniqueness, subject references, semantic integrity, known settings, and record-count limits **before** any IndexedDB clear/write. Reject invalid payloads entirely; do not silently repair duplicates, orphans, or out-of-range values. Failed imports must leave existing data and visible focus ownership intact. When changing import rules, inspect `useStudyBackup.ts`, `studyExportLimits.ts`, `studyExportValidation.ts`, and `studyDb.ts` together (see `AGENTS.md` Backups).

Settings clear-all is not currently serialized with an in-flight backup import (pre-existing behavior). Prefer not to expand that race; treat any fix as a dedicated hardening change with explicit product approval. A dedicated Playwright scenario that rejects an invalid import through Settings remains optional; unit and App suites already cover rejection and focus preservation.

Optional fields on stored records should stay backward-compatible with older IndexedDB rows and JSON exports. For example, flashcard scheduling fields are optional so older cards remain due immediately. Unknown settings keys on import stay accepted for forward compatibility.

## Dependency Hygiene

The app uses plain CSS, Vite, React, Dexie, and lucide icons. Do not add a UI/charting/state dependency unless the product code imports it and the bundle budget still passes.

## Adding an E2E spec

1. Create `e2e/<feature>.spec.ts` beside existing specs.
2. Start with `page.goto('/')` and wait for the Home greeting heading (`Good morning`, `Good afternoon`, or `Good evening` — see `HOME_GREETING_HEADING` in `e2e/a11yHelpers.ts`).
3. Run `npm run test:e2e -- e2e/<feature>.spec.ts` locally before pushing.

## Shared UI components

Cover shared primitives with Vitest/Testing Library tests beside the components (for example `src/components/ui.test.tsx`). Do not add Storybook or other optional UI harnesses unless explicitly requested.
