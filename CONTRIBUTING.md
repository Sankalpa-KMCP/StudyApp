# Contributing

## Setup

Use the supported toolchain declared in `package.json`, `.nvmrc`, and `.node-version`:

- **Node.js** 22 (`engines.node`: `^22.0.0`)
- **npm** 10.9.2 (`packageManager`: `npm@10.9.2`)

These declarations are compatibility guidance for local work and CI. Strict engine rejection is not enabled (`.npmrc` has `engine-strict=false`).

```bash
node --version   # expect v22.x
npm --version    # expect 10.9.2
npm ci
npm run dev
```

CI (`.github/workflows/ci.yml`) installs Node from `.nvmrc` and pins `npm@10.9.2` before `npm ci`.

For the recorded Phase 0 clean-install, validation, and preview baseline (including coverage affinity and Lighthouse notes), see [docs/phase-0-baseline.md](docs/phase-0-baseline.md). For v1.5.0 release scope and feature-freeze rules, see [docs/release-v1.5.0-contract.md](docs/release-v1.5.0-contract.md).

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
| `src/App.navigation.test.tsx` | Widget and view navigation, URL sync, popstate, unknown-path fallback |
| `src/App.workspaces.test.tsx` | Tasks / Notes / Subjects / Calendar / Flashcards |
| `src/App.progress.test.tsx` | Progress study journal |

Shared App suite reset lives in `src/test/appTestSetup.ts` (plus small focus/backup/home helpers). Prefer the matching feature suite when adding App-level coverage.

Coverage (`vitest.config.ts`) instruments all production `src/**/*.{ts,tsx}` files and excludes tests, `src/test/**`, and `*.d.ts`. Thresholds stay at 80% lines/functions/statements and 70% branches. Do not lower those thresholds to green a change. CI enforces this gate with `npm run test:coverage` (not a separate plain `npm test` step). GitHub Pages deploys only from that CI workflow after `check` succeeds on `master` (`push` or `workflow_dispatch`). `V2` continues to run CI checks but does not deploy. The hosted Pages site is currently a preview/testing deployment. Pull requests never deploy.

## Data Safety

Study data is local-first and stored in IndexedDB through Dexie. Keep destructive flows confirmed by the user and covered by tests.

Backup import validates size, shape/version, uniqueness, subject references, semantic integrity, known settings, and record-count limits **before** any IndexedDB clear/write. Reject invalid payloads entirely; do not silently repair duplicates, orphans, or out-of-range values. Failed imports must leave existing data and visible focus ownership intact. When changing import rules, inspect `useStudyBackup.ts`, `studyExportLimits.ts`, `studyExportValidation.ts`, and `studyDb.ts` together (see `AGENTS.md` Backups).

Settings import and clear-all operations are strictly serialized via `DataOperationCoordinator`. Any changes to this flow must preserve the mutual exclusion invariant and ensure the focused regression tests in `src/db/dataCoordinator.test.ts` and `e2e/dataCoordinator.spec.ts` continue to pass. A dedicated Playwright scenario that rejects an invalid import through Settings remains optional; unit and App suites already cover rejection and focus preservation.

Optional fields on stored records should stay backward-compatible with older IndexedDB rows and JSON exports. For example, flashcard scheduling fields are optional so older cards remain due immediately. Unknown settings keys on import stay accepted for forward compatibility.

## Dependency Hygiene

The app uses plain CSS, Vite, React, and Dexie. Icons are local React components under `src/components/icons/`, derived from a Lucide subset — reuse or extend that set rather than importing `lucide-react` (it is not an installed dependency). When adding icons, keep the required attribution in `src/components/icons/LICENSE.txt`. Do not add a UI/charting/state dependency unless the product code imports it and the bundle budget still passes.

## Adding an E2E spec

1. Create `e2e/<feature>.spec.ts` beside existing specs.
2. Start with `page.goto('/')` (or a workspace path such as `/tasks`) and wait for the matching workspace heading. Home uses the greeting heading (`Good morning`, `Good afternoon`, or `Good evening` — see `HOME_GREETING_HEADING` in `e2e/a11yHelpers.ts`).
3. Run `npm run test:e2e -- e2e/<feature>.spec.ts` locally before pushing.

## Shared UI components

Cover shared primitives with Vitest/Testing Library tests beside the components (for example `src/components/ui.test.tsx`). Do not add Storybook or other optional UI harnesses unless explicitly requested.

## Release Archive Hygiene

Do not create a release package by compressing the working directory. A generic filesystem ZIP could accidentally include ignored logs, `.mcp.json`, and other local files.

Use a committed-tree archive instead:
```bash
git archive HEAD --format=zip -o StudyApp-release.zip
```
This ensures the archive contains tracked committed files only. Ignored and untracked local files such as `.mcp.json`, development logs, generated output, and local AI/tooling configuration are not release inputs. Note that GitHub Pages deployment remains separately generated from `dist`.
