# Contributing

## Setup

```bash
npm ci
npm run dev
```

## Tests

| Command | Purpose |
|---------|---------|
| `npm test` | Vitest unit and component tests |
| `npm run test:coverage` | Main coverage gate (80% lines, 74% branches) |
| `npm run test:coverage:components` | Shared/analytics component gate (65% lines, 50% branches) |
| `npm run test:coverage:settings` | Control-deck / settings widget gate (60% lines, 45% branches) |
| `npm run test:e2e` | Playwright user journeys (Chromium, mobile, Firefox smoke, folder sync) |
| `npm run lint` | ESLint including jsx-a11y rules (errors on CI) |
| `npm run check:bundle` | Gzip budget on main JS chunk (~512 KB) |
| `npm run screenshots` | Regenerate README images in `docs/screenshots/` |

## README screenshots

```bash
npm run screenshots
```

Regenerates the four tab captures used in README (`focus`, `analytics`, `journal`, `settings`) into `docs/screenshots/`.

On pushes to `master` (excluding screenshot-only commits), CI rebuilds the app, captures against the production preview URL, and auto-commits updated PNGs when they change.

## List virtualization

`TaskList` virtualizes when count exceeds 100. `NoteListPanel` virtualizes above 50 notes. Completed tasks cap at 20 with a **Show more** control (+20 per click).

## CSV export safety

`useSessionBackup` prefixes formula-like note fields (`=`, `+`, `-`, `@`) with `'` before CSV quoting to prevent spreadsheet injection.

## Dexie migrations

1. Bump `this.version(N)` in [`src/db/db.ts`](src/db/db.ts).
2. Add `.stores({ ... })` and optional `.upgrade()` handler.
3. Add or extend tests in [`src/db/__tests__/db.migration.test.ts`](src/db/__tests__/db.migration.test.ts).

**v12 note:** Drops the `flashcards` table, removes `flashcardsEnabled`, and filters `cards` from `lockoutAllowedTabs`. `#cards` URLs redirect to Focus.

**v9–v11:** v9 adds optional `taskId` on history entries; v10 adds `recurrenceParentId` on tasks; v11 adds folder sync. See [`src/db/db.ts`](src/db/db.ts) for full migration chain.

## E2E helpers

Shared utilities live in [`e2e/helpers/studyApp.ts`](e2e/helpers/studyApp.ts):

- `clearStudyDatabase(page)` + `freshVisitStorage` — for first-install scenarios

## Adding a setting key

1. Add default in settings repository / seed logic.
2. Wire through `StudyDataProvider` settings hook if UI-bound.
3. Add a `ToggleSetting`, `RangeSetting`, or Control Deck panel control.
4. Document default in README timer/settings tables.

## Adding an E2E spec

1. Create `e2e/<feature>.spec.ts` beside existing specs.
2. Start with `page.goto('/')` and wait for `Study Dashboard`.
3. For lazy tabs, assert loading fallback then content (`/loading analytics/i`).
4. Run `npm run test:e2e -- e2e/<feature>.spec.ts` locally before pushing.

Folder sync specs: `e2e/folder-sync.spec.ts`, `e2e/folder-sync-conflict.spec.ts` (mock adapter via `VITE_E2E_SYNC=1`).

## Storybook

```bash
npm run storybook
```

Stories live next to components as `*.stories.tsx`. The a11y addon runs in Storybook dev and build.
