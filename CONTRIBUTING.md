# Contributing

## Setup

```bash
npm ci
npm run dev
```

## Tests

| Command | Purpose |
|---------|---------|
| `npm test` | Vitest unit and component tests (full suite; currently 274 cases) |
| `npm run test:coverage` | Main coverage gate (`App.tsx` + extracted App orchestration hooks) |
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

Coverage thresholds (`vitest.config.ts`) include `src/App.tsx` and the five extracted orchestration hooks (`useThemePreference`, `useSidebarPreference`, `useAppSearch`, `useFocusSession`, `useStudyBackup`) at 80% lines/functions/statements and 70% branches. Do not lower those thresholds to green a change.

## Data Safety

Study data is local-first and stored in IndexedDB through Dexie. Keep destructive flows confirmed by the user and covered by tests.

Settings clear-all is not currently serialized with an in-flight backup import (pre-existing behavior). Prefer not to expand that race; treat any fix as a dedicated hardening change with explicit product approval.

Optional fields on stored records should stay backward-compatible with older IndexedDB rows and JSON exports. For example, flashcard scheduling fields are optional so older cards remain due immediately.

## Dependency Hygiene

The app uses plain CSS, Vite, React, Dexie, and lucide icons. Do not add a UI/charting/state dependency unless the product code imports it and the bundle budget still passes.

## Adding an E2E spec

1. Create `e2e/<feature>.spec.ts` beside existing specs.
2. Start with `page.goto('/')` and wait for the Home greeting heading (`Good morning`, `Good afternoon`, or `Good evening` — see `HOME_GREETING_HEADING` in `e2e/a11yHelpers.ts`).
3. Run `npm run test:e2e -- e2e/<feature>.spec.ts` locally before pushing.

## Shared UI components

Cover shared primitives with Vitest/Testing Library tests beside the components (for example `src/components/ui.test.tsx`). Do not add Storybook or other optional UI harnesses unless explicitly requested.
