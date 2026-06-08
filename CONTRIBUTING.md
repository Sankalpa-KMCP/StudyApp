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
| `npm run test:coverage` | Main coverage gate (80% lines, 65% branches) |
| `npm run test:coverage:components` | Shared/analytics component gate (50%) |
| `npm run test:e2e` | Playwright user journeys (Chromium, mobile, Firefox smoke) |
| `npm run lint` | ESLint including jsx-a11y rules (errors on CI) |
| `npm run check:bundle` | Gzip budget on main JS chunk (~512 KB) |
| `npm run screenshots` | Regenerate README images in `docs/screenshots/` |

## README screenshots

```bash
npm run screenshots
```

Commits the four tab captures used in README (`focus`, `cards`, `analytics`, `settings`).

## List virtualization

`TaskList` and `FlashcardRegistry` render the first 50 items when count exceeds 100, with a **Show more** control (+50 per click).

## CSV export safety

`useSessionBackup` prefixes formula-like note fields (`=`, `+`, `-`, `@`) with `'` before CSV quoting to prevent spreadsheet injection.

## Dexie migrations

1. Bump `this.version(N)` in [`src/db/db.ts`](src/db/db.ts).
2. Add `.stores({ ... })` and optional `.upgrade()` handler.
3. Add or extend tests in [`src/db/__tests__/db.migration.test.ts`](src/db/__tests__/db.migration.test.ts).

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

## Storybook

```bash
npm run storybook
```

Stories live next to components as `*.stories.tsx`. The a11y addon runs in Storybook dev and build.
