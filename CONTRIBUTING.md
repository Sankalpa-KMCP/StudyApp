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
| `npm run test:e2e` | Playwright user journeys (Chromium, mobile, Firefox smoke) |
| `npm run lint` | ESLint including jsx-a11y rules (errors on CI) |
| `npm run check:bundle` | Gzip budget on main JS chunk (~512 KB) |
| `npm run screenshots` | Regenerate README images in `docs/screenshots/` |

## README screenshots

```bash
npm run screenshots
```

Regenerates the four tab captures used in README (`focus`, `cards`, `analytics`, `settings`) into `docs/screenshots/`.

On pushes to `master` (excluding screenshot-only commits), CI rebuilds the app, captures against the production preview URL, and auto-commits updated PNGs when they change.

## List virtualization

`TaskList` and `FlashcardRegistry` virtualize when count exceeds 100. `NoteListPanel` virtualizes above 50 notes. Completed tasks cap at 20 with a **Show more** control (+20 per click).

## CSV export safety

`useSessionBackup` prefixes formula-like note fields (`=`, `+`, `-`, `@`) with `'` before CSV quoting to prevent spreadsheet injection.

## Dexie migrations

1. Bump `this.version(N)` in [`src/db/db.ts`](src/db/db.ts).
2. Add `.stores({ ... })` and optional `.upgrade()` handler.
3. Add or extend tests in [`src/db/__tests__/db.migration.test.ts`](src/db/__tests__/db.migration.test.ts).

**v8 note:** On upgrade from v7, missing `flashcardsEnabled` is set to `true` (preserves Cards tab for existing users). Fresh installs default to `false` via `SETTINGS_DEFAULTS`.

## E2E helpers

Shared utilities live in [`e2e/helpers/studyApp.ts`](e2e/helpers/studyApp.ts):

- `enableFlashcards(page)` — required before any spec that clicks the Cards tab (new installs hide it by default)
- `clearStudyDatabase(page)` + `freshVisitStorage` — for first-install scenarios (`flashcards-optional.spec.ts`)

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
5. Specs that use the Cards tab must call `enableFlashcards(page)` from `e2e/helpers/studyApp.ts`.

## Storybook

```bash
npm run storybook
```

Stories live next to components as `*.stories.tsx`. The a11y addon runs in Storybook dev and build.
